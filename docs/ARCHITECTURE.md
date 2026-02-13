# Seirei アーキテクチャ設計

> 作成日: 2026-02-10
> 最終更新: 2026-02-13

---

## 1. 設計原則

### 個別エージェント方式を採用

神視点のAIでワールドをtickするシミュレーションではなく、**個々の精霊を独立したAIエージェントとして動かす**。

| | 神視点tick | 個別エージェント（採用） |
|---|---|---|
| スケール | 全精霊を1回のLLM呼び出しで処理 → プロンプト爆発 | 精霊ごとに独立呼び出し → 線形スケール |
| 創発性 | 全体をコントロールするAIが「演出」 | 各精霊が独立判断 → 予測不能な創発 |
| コスト | 1 tick = 大きなプロンプト1回 | 1精霊 = 小さなプロンプト1回（Haiku $0.002） |
| 実装 | ワールド全体をプロンプトに圧縮する設計が困難 | ツール定義だけで済む |
| 障害 | 1回のエラーで全世界停止 | 1精霊のエラーは他に影響しない |

### ブラウザとサーバーの役割分離

精霊はユーザーがブラウザを閉じていても自律的に動く。したがって精霊のロジックはサーバー側で動き、ブラウザは描画に専念する。

### 視界はブラウザ不要

視界（Frustum Culling）はGPUやThree.jsを必要としない純粋な数学処理。Gribb/Hartmann法でFrustum6平面を抽出し、AABB交差判定 + NDC投影によるscreenOccupancy計算を行う。

### 開発方針: 面白さは試行錯誤で作る

「面白いか検証してから進む」のではなく、**作りながら面白くしていく**。

---

## 2. 技術スタック

### 採用: PicoClawフォーク (Go) + TypeScriptフロントエンド

```
┌──────────────── フロントエンド ─────────────────┐
│ React 19 + Three.js + React Three Fiber (実装済) │
│ ポーリング（2秒間隔で精霊位置取得、30秒間隔で時間帯取得）│
│                                                  │
│ Vite 7 / TypeScript                              │
└──────────────────── ↕ WebSocket/REST ────────────┘
┌──────── ワールドサーバー (TypeScript) ──────────┐
│ server/api.ts — Hono HTTP API (port 3001)        │
│ ├── ロケーション管理（座標 + BBox）              │
│ ├── 視界計算（純粋数学、GPU不要）                │
│ ├── 遭遇判定（距離ベース）                       │
│ ├── 時間システム（朝昼夕夜サイクル）             │
│ └── REST API（Viteプロキシ /api → localhost:3001）│
│                                                  │
│ 認証: X (Twitter) OAuth                          │
│ DB:   Supabase                                   │
└──────────────── ↕ HTTP localhost ────────────────┘
┌──────── 精霊エージェント (Go: spirits/) ────────┐
│ PicoClawフォーク改造 + コンポーネント利用        │
│                                                  │
│ ├── AgentLoop (NewCustomLoop で精霊用に改造)     │
│ │   セッション永続化・文脈圧縮・ツール実行ループ │
│ ├── GLMProvider / AnthropicProvider              │
│ │   LLM_PROVIDER env var で切替                  │
│ ├── ツール: observe, move_to, walk_to, look_at, say, set_goal, rest (think/report/remember: 未実装) │
│ └── オーケストレーター: 未実装（goroutine×1000） │
│                                                  │
│ LLM:  GLM-4.7（デフォルト）/ Anthropic API（代替）│
└──────────────────────────────────────────────────┘
```

### 空間コミュニケーションモデル

精霊の発話は**空間ブロードキャスト**方式。話しかける相手の意図（`to`）と、声の届く範囲（`volume`）を分離する。

| volume | 到達距離 | 用途 |
|--------|---------|------|
| whisper | 1.5m | ささやき、秘密の話 |
| normal | 5.0m | 通常の会話 |
| shout | 15.0m | 呼びかけ、叫び |

**配信ルール**: 発話位置から到達距離内の全精霊にメッセージが届く（`to`の有無に関わらず）

**受信時の表示例**:
```
届いた声:
  - Hikari（あなたに向かって）:「こんにちは！」(距離2.3)
  - Hikari（Kazeに向かって）:「あの木きれいだね」(距離4.8)
  - Kaze（独り言）:「噴水の音が心地いい…」(距離3.1)
```

この設計により以下の創発的行動が可能:
- **会話への割り込み**: 他の精霊宛の発言を聞いて返事する
- **盗み聞き**: 範囲内なら自分宛でなくても聞こえる
- **ささやき**: whisperで近くの精霊だけに秘密を伝える
- **呼びかけ**: shoutで遠くの精霊を呼ぶ

### 方針転換の経緯

当初はTypeScript統一を選択していたが、以下の理由でPicoClawフォークに変更:

| 観点 | TypeScript自前 | PicoClawフォーク (Go) |
|---|---|---|
| エージェントの核（ループ・圧縮・セッション） | **全部書く必要あり** | **既に実装済み** |
| 1000体並行 | async/awaitで頑張る | goroutineで自然 |
| 追加実装量 | 多い | ツール差し替え + オーケストレーター |
| 言語 | 1つ | 2つ（Go + TS） |

**決め手**: 「Anthropic APIを直接叩く」と言った時点で、エージェントループ・コンテキスト圧縮・セッション管理を全部自前で書くことになり、それはPicoClawの再発明に等しい。既存フレームワーク（Vercel AI SDK、Mastra等）も「1000体の自律エージェント」を想定していないため代替にならない。PicoClawをフォークして改造するのが最も工数が少ない。

サーバーとフロントエンドはWebSocket/RESTで繋ぐだけなので、型共有の恩恵は薄く、2言語のデメリットは小さい。

### PicoClawが提供するもの（自前で書かなくて済む部分）

| 機能 | PicoClawの実装 | 自前で書いた場合の工数 |
|---|---|---|
| エージェントループ | `pkg/agent/loop.go` | ~100行だが堅牢にするのが大変 |
| コンテキスト圧縮 | `pkg/agent/context.go` | ~300行。マルチパート要約、トークン管理 |
| セッション管理 | `pkg/session/manager.go` | ~200行。永続化・復元・刈り込み |
| ツールフレームワーク | `pkg/tools/registry.go` | ~100行 |
| マルチLLMプロバイダ | `pkg/providers/` | ~500行。8プロバイダ対応 |
| サブエージェント | `pkg/tools/subagent.go` | ~200行 |

### 1000体を1プロセスで動かす

Go の goroutine は1個あたり ~2KB。1000 goroutine = ~2MB の追加メモリ。

```
SpiritOrchestrator（1 Goプロセス）
├── goroutine: Spirit-001 (AgentLoop) — 次の思考: 5分後
├── goroutine: Spirit-002 (AgentLoop) — 次の思考: 58分後
├── goroutine: Spirit-003 (AgentLoop) — スリープ中
├── ...
└── goroutine: Spirit-1000
    各goroutineがスケジュールに従いワールドサーバーにアクセス
```

精霊の思考処理は**LLM API呼び出し待ち**が99%。CPU処理はほぼゼロ。goroutineはI/O待ちで自然にyieldするため、1000体でもCPU負荷は極小。

---

## 3. PicoClawフォークの改造方針

PicoClawのAgentLoopを**最小限の改造で精霊用に流用**する。

問題: AgentLoopのツールレジストリはprivateフィールドであり、`NewAgentLoop()`が内部でReadFile・WriteFile等をハードコード登録する。また`ContextBuilder`のシステムプロンプトもPicoClaw固有。

解決: 2ファイルに最小限の変更を加え、`NewCustomLoop()`コンストラクタを追加:
- `pkg/agent/loop.go` — `CustomLoopConfig`構造体 + `NewCustomLoop()`: 外部ToolRegistry・SystemPrompt・LLMProviderを受け取る
- `pkg/agent/context.go` — `customSystemPrompt`フィールド追加: 設定されていればPicoClaw固有プロンプトをスキップ

これにより、PicoClawの以下の機能がそのまま使える:
- **AgentLoop.processMessage()** — ツール実行ループ（LLM→tool_use→実行→結果→LLM）
- **SessionManager** — 会話履歴のJSON永続化・復元・トランケーション
- **summarizeSession()** — 20メッセージ or 75%トークン超過で自動要約・圧縮
- **ProcessDirect()** — 外部からメッセージを注入してprocessMessageを実行

### 3.1 精霊用ツールに差し替え

PicoClawの既存ツール（ファイル操作、シェル、Web検索等）を精霊用ツールに差し替え:

| PicoClawのツール | 精霊用ツール | 説明 |
|---|---|---|
| ReadFile | `observe` | 今いる場所の状況を取得 |
| Exec | `move_to` | 別のロケーションに移動 |
| — | `walk_to` | 任意の座標に歩いて移動（精霊に近づく） |
| — | `look_at` | 移動せずに指定方向を向く |
| WebSearch | `say` | 声を出す（空間ブロードキャスト、距離ベースで届く） |
| — | `think` | 内省する（記憶に書く） |
| WebFetch | `report` | 持ち主への報告を作成 |
| WriteFile | `remember` | 重要な情報を長期記憶に保存 |

### 3.2 オーケストレーター新規実装

1プロセスでN体の精霊を管理するgoroutineベースのスケジューラ。

### 3.3 ワールドサーバー（確定: TypeScript維持）

ワールド状態管理（位置、視界、遭遇、時間）は **既存のTypeScript実装（server/api.ts + server/world/）をそのまま本番利用** する。Go精霊エージェントからはHTTP localhostで呼び出す。

Go移植しない理由:
- 1000精霊 × 5分間隔 = **~3.3 req/sec、同時接続~10**。HTTP localhostはこの負荷を余裕で処理できる
- ワールドサーバーのロジック（視界計算、WorldMap、WorldClock等）は既にTypeScriptで完成・テスト済み
- Go移植は工数に見合わない（ワールドロジックの再実装 + テスト + バグ修正）

### 3.4 WebSocket/REST API

フロントエンド向けのリアルタイム配信。

### 3.5 人格システム

PicoClawの`SOUL.md`/`IDENTITY.md`をXプロフィールから動的生成。

### 3.6 実装済みコンポーネント (spirits/)

```
spirits/                            ← Go module
├── cmd/
│   ├── main.go                     ← エントリポイント (行動ループ, 状態管理, リソースシステム)
│   ├── spiritgen.go                ← 精霊の自動生成 (名前, 人格, 色, 位置, タイミング)
│   └── namegen.go                  ← 組み合わせ名前生成器
├── worldclient/client.go           ← TS World Server用HTTPクライアント
├── spirittools/
│   ├── observe.go                  ← 観察ツール
│   ├── move_to.go                  ← オブジェクトID指定移動
│   ├── walk_to.go                  ← 座標指定移動（1.5m手前停止）
│   ├── look_at.go                  ← 向き変更ツール
│   ├── say.go                      ← 発話ツール（空間ブロードキャスト）
│   ├── set_goal.go                 ← 目標設定ツール
│   ├── rest.go                     ← 休憩ツール（ベッド近くで使用）
│   └── actionlog.go                ← 短期記憶（直近行動のリングバッファ）
├── anthropic/provider.go           ← Anthropic API プロバイダ
├── glm/                            ← GLM-4 API プロバイダ（デフォルト）
├── sessions/                       ← PicoClaw SessionManagerによる自動永続化 (gitignored)
├── go.mod                          ← picoclaw/ を replace directive で参照
└── .env                            ← GLM_API_KEY or ANTHROPIC_API_KEY (gitignored)
```

PicoClaw改造箇所 (picoclaw/):
```
picoclaw/pkg/agent/loop.go         ← NewCustomLoop() 追加 (外部ツール・プロンプト注入)
picoclaw/pkg/agent/context.go      ← customSystemPrompt フィールド追加
```

---

## 4. 既存実装の位置づけ

### TypeScript実装（server/）の扱い

`server/`のTypeScript実装は用途に応じて **本番コード** と **参考実装** に分かれる。

#### 本番コード（そのまま使用）
- **server/api.ts** — Hono HTTP API。ワールドサーバーのエンドポイント。Go精霊エージェントからHTTPで呼び出される
- **server/world/WorldServer.ts** — ワールド状態管理の中核
- **server/world/vision.ts** — 視界計算（Frustum Culling、screenOccupancy）
- **server/world/WorldMap.ts** — マップ・ロケーション管理
- **server/world/WorldClock.ts** — ゲーム内時間システム

#### 参考実装（Goで再実装済み or 再実装予定）
- **server/spirit/SpiritRuntime.ts** — 精霊ランタイム。Go spirits/cmd/main.go に相当
- **server/spirit/SpiritAgent.ts** — エージェントループ。Go側でPicoClaw AgentLoop (NewCustomLoop) に置き換え
- **server/tools/** — TSツール定義。Go spirittools/ の参考として使用済み

### フロントエンド（src/）

変更なし。React 19 + Three.js + R3F。WebSocket接続先はTSワールドサーバーのまま。

### 共有型

フロントエンド ↔ ワールドサーバー間はTypeScript同士なので型共有が可能。Go精霊エージェント ↔ ワールドサーバー間はHTTP JSON構造で合わせる。

---

## 5. 実行方法

### フロントエンド（3Dワールド描画）
```bash
npm run dev             # Vite開発サーバー (プロキシ: /api → localhost:3001)
```

### TSワールドサーバー（本番）
```bash
npx tsx server/api.ts   # Hono HTTP API (port 3001)
```

### TSプロトタイプサーバー（参考用）
```bash
npm run server:start    # 精霊2体がスタブ思考で自律行動（参考実装）
npm run server:dev      # ファイル変更で自動再起動
npm run server:check    # 型チェックのみ
```

### Go精霊エージェント
```bash
cd spirits && ./seirei-spirit   # .envからANTHROPIC_API_KEYを読み込み
# またはビルドして実行:
cd spirits && go build -o seirei-spirit ./cmd && ./seirei-spirit
```

---

## 6. マイルストーン

| 優先度 | 項目 | 状態 | 内容 |
|--------|------|------|------|
| ★1 | PicoClaw動作確認 | **完了** | clone、ビルド成功 (Go 1.25.7) |
| ★2 | コード読解・改造ポイント特定 | **完了** | AgentLoop: privateフィールド問題 → NewCustomLoop追加で解決。HTTPProvider: OpenAI形式のみ → カスタムAnthropicProvider自作 |
| ★3 | 精霊用ツール実装 (Go) | **一部完了** | observe, move_to, walk_to, look_at, say: 完了。think: 未着手 |
| ★3.5 | 自律ループ + 複数精霊 | **完了** | SPIRIT_COUNT環境変数で精霊数を指定（デフォルト5体）。自動名前生成・人格生成・色生成。goroutineで並行自律行動 |
| ★4 | ワールドサーバー | **HTTP API完了** | TS維持確定 (Hono)。Go精霊からHTTP localhostで呼び出し |
| ★5 | フロントエンド表示 | **完了** | あつ森風カメラ + ポーリング + 精霊描画 + 名前/吹き出し |
| ★5.5 | 動的人格生成 | **完了** | 精霊ごとに持ち主プロフィール・興味・性格をランダム生成。X風人格設定 |
| ★6 | Supabase永続化 | 未着手 | セッション・会話ログの永続化 |
| ★7 | X OAuth + 人格生成 | 未着手 | Xプロフィールから精霊を自動生成 |
