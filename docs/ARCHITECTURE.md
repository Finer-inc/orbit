# Seirei アーキテクチャ設計

> 作成日: 2026-02-10
> 最終更新: 2026-03-05

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
│ ├── ロケーション管理（JSON or GLBから読み込み）   │
│ ├── 視界計算（純粋数学、GPU不要）                │
│ ├── 遭遇判定（距離ベース）                       │
│ ├── 地形高さ（GLBメッシュ三角形レイキャスト）    │
│ ├── パスグラフ（A*経路探索）                     │
│ ├── スポーンゾーン（Colliderベース）              │
│ ├── 時間システム（DAY_LENGTH_MINUTES環境変数で速度制御）│
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
│ ├── ツール: observe, move_to, walk_to, look_at, say, set_goal, rest, stop (think/report/remember: 未実装) │
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
| — | `stop` | 移動中に立ち止まる |
| — | `look_at` | 移動せずに指定方向を向く |
| WebSearch | `say` | 声を出す（空間ブロードキャスト、距離ベースで届く） |
| — | `think` | 内省する（記憶に書く） |
| WebFetch | `report` | 持ち主への報告を作成 |
| WriteFile | `remember` | 重要な情報を長期記憶に保存 |

### 3.2 管理API（動的スポーン/デスポーン）

Goエージェントサーバーが `MGMT_PORT`（デフォルト3002）でHTTP管理APIを提供する。

| メソッド | パス | 説明 |
|----------|------|------|
| `GET` | `/agents` | 稼働中エージェント一覧（ID, 名前, 色, 開始時刻, ワークスペース） |
| `POST` | `/agents` | 新規エージェントのスポーン（SpawnRequest JSON） |
| `DELETE` | `/agents/{id}` | エージェントのデスポーン |

フロントエンドはViteプロキシ経由で `/mgmt/` → `localhost:3002` にアクセスする。

### 3.3 ワークスペースシステム（PicoClaw準拠）

エージェントのシステムプロンプトを5つのセクションに分解し、UIからタブ形式で編集可能にする。キー名はPicoClawのブートストラップファイルに準拠。

| キー | UIタブ | 説明 | 書き手 |
|------|--------|------|--------|
| `identity` | IDENTITY.md アイデンティティ | 名前、種族、属性、役割 | ユーザー |
| `soul` | SOUL.md 人格 | 性格、口調、価値観 | ユーザー |
| `user` | USER.md 持ち主 | 持ち主との関係 | ユーザー |
| `agents` | AGENTS.md 使命 | ミッション、目標 | ユーザー |
| `memory` | MEMORY.md 記憶 | 長期記憶 | エージェント+ユーザー |

データ構造は `map[string]string` / `Record<string, string>` で管理し、Supabaseの `jsonb` カラムにそのまま保存可能。

### 3.4 ビルボードスプライトシステム

rpg-dot-makerのE2Eページで生成したZIPファイル（PNG静止ポーズ + MP4歩行アニメーション）をエージェント作成時に選択し、3Dワールド内で8方向対応のビルボードスプライトとして描画する。

- ZIP構造: `XX_idle_DIR.png`（8方向idle）+ `XX_walk_DIR.png`（8方向walk静止）+ `videos/walk_DIR.mp4`（8方向歩行動画）
- クロマキー閾値: RGB差分合計 < 200 で背景透明化（4隅サンプリングで自動検出）
- クライアントサイドのみ: テクスチャデータはブラウザメモリ内、サーバー変更不要
- スプライトなしのエージェントは従来のBoxGeometryで描画

### 3.5 オーケストレーター

1プロセスでN体のエージェントを管理するgoroutineベースのスケジューラ。現在は管理APIからの動的スポーン/デスポーンに対応。

### 3.6 ワールドサーバー（確定: TypeScript維持）

ワールド状態管理（位置、視界、遭遇、時間）は **既存のTypeScript実装（server/api.ts + server/world/）をそのまま本番利用** する。Go精霊エージェントからはHTTP localhostで呼び出す。

Go移植しない理由:
- 1000精霊 × 5分間隔 = **~3.3 req/sec、同時接続~10**。HTTP localhostはこの負荷を余裕で処理できる
- ワールドサーバーのロジック（視界計算、WorldMap、WorldClock等）は既にTypeScriptで完成・テスト済み
- Go移植は工数に見合わない（ワールドロジックの再実装 + テスト + バグ修正）

#### ワールドデータのソース
ワールドのオブジェクト配置と地形は以下の2形式から読み込む。`world.json`（タグベース形式、Unityからエクスポート）が存在すればそちらを優先し、なければGLBファイルから読み込む。

- **world.json**（優先）— Unityエディタで配置したオブジェクトをWorldExporterでエクスポート。タグベース形式
- **GLBファイル**（フォールバック）— `server/world/parseGLB.ts` でGLBバイナリパーサー（JSONチャンク + BINチャンク）を読み込み。`col_*` ノードからオブジェクト配置（位置、回転、AABB）を取得。`vis_terrain` メッシュから三角形ベースの地形高さクエリを構築（2Dグリッドではなく実メッシュでレイキャスト。`getHeight(x, z, fromY?)` でfromY以下の最も高い面を返すため、橋の下や洞窟にも対応）
- **pathgraph.json** — パスグラフデータ（UnityのPathGraphExporterからエクスポート）。A*経路探索、ノード判定、プリミティブヒットテストに使用
- **spawnzones.json** — スポーンゾーンデータ（UnityのSpawnZoneExporterからエクスポート）。リジェクションサンプリングでスポーン位置を決定

### 3.7 WebSocket/REST API

フロントエンド向けのリアルタイム配信。

### 3.8 人格システム

PicoClawの`SOUL.md`/`IDENTITY.md`をXプロフィールから動的生成。

### 3.9 実装済みコンポーネント (spirits/)

```
spirits/                            ← Go module
├── cmd/
│   ├── main.go                     ← エントリポイント (行動ループ, 状態管理, リソースシステム)
│   ├── api.go                      ← 管理API HTTPサーバー (GET/POST/DELETE /agents)
│   ├── manager.go                  ← 動的スポーン/デスポーン管理
│   ├── spiritgen.go                ← エージェントの自動生成 (名前, ワークスペース, 色, 位置, タイミング)
│   └── namegen.go                  ← 組み合わせ名前生成器
├── worldclient/client.go           ← TS World Server用HTTPクライアント（GetSpawnPoint等）
├── spirittools/
│   ├── observe.go                  ← 観察ツール
│   ├── move_to.go                  ← オブジェクトID指定移動
│   ├── walk_to.go                  ← 座標指定移動（1.5m手前停止）
│   ├── stop.go                     ← 停止ツール（移動中に立ち止まる）
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

```
server/world/                        ← TS World Server
├── WorldServer.ts                    ← ワールド状態管理の中核
├── WorldMap.ts                       ← JSON/GLBからオブジェクト・ベッド・地形高さを構築
├── WorldClock.ts                     ← DAY_LENGTH_MINUTES環境変数で速度制御
├── PathGraph.ts                      ← パスグラフ（A*経路探索、ノード判定、プリミティブヒットテスト）
├── SpawnZones.ts                     ← スポーンゾーン（リジェクションサンプリング）
├── parseGLB.ts                       ← GLBバイナリパーサー（col_*抽出 + 三角形地形メッシュ）
└── vision.ts                         ← Frustum Culling + screenOccupancy
```

PicoClaw改造箇所 (picoclaw/):
```
picoclaw/pkg/agent/loop.go         ← NewCustomLoop() 追加 (外部ツール・プロンプト注入)
picoclaw/pkg/agent/context.go      ← customSystemPrompt フィールド追加
```

### 3.10 Unity クライアント（エクスポーター）

Unityエディタで配置したデータをJSONにエクスポートし、TSワールドサーバーが読み込む。

#### エクスポーター

| エクスポーター | メニュー | 入力 | 出力 |
|------------|--------|------|------|
| WorldExporter | Window → Seirei → Export World | シーン内オブジェクト | world.json |
| PathGraphExporter | Window → Seirei → Export Path Graph | PathNodeコンポーネント | pathgraph.json |
| SpawnZoneExporter | Window → Seirei → Export Spawn Zones | SpawnZoneコンポーネント | spawnzones.json |

#### コンポーネント

- **PathNode** (`Assets/Scripts/PathGraph/PathNode.cs`): ノードタイプ(Point/Obstacle/Area/Reroute)と接続先を定義。Colliderで形状を指定。
- **SpawnZone** (`Assets/Scripts/SpawnZone/SpawnZone.cs`): スポーンエリアを定義。子のColliderで範囲を指定。

#### 形状検出

Colliderベース（MeshFilterではなくColliderから形状を検出）:
- BoxCollider → box
- SphereCollider → sphere
- CapsuleCollider → cylinder

エクスポーターはコンポーネント自身のGameObjectと子GameObjectのColliderを検出する。

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

## 5. 環境変数

### Goエージェントサーバー (`spirits/.env`)

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `LLM_PROVIDER` | `glm` | LLMプロバイダ (`glm` or `anthropic`) |
| `GLM_API_KEY` | — | GLM-4 APIキー（`LLM_PROVIDER=glm`時に必須） |
| `ANTHROPIC_API_KEY` | — | Anthropic APIキー（`LLM_PROVIDER=anthropic`時に必須） |
| `MODEL` | プロバイダデフォルト | 使用モデルの上書き |
| `LLM_MAX_CONCURRENT` | `3` | LLM同時接続数上限（GLMは3が安全、4で429発生） |
| `WORLD_SERVER_URL` | `http://localhost:3001` | TSワールドサーバーのURL |
| `SPIRIT_COUNT` | `0` | 起動時に自動スポーンするエージェント数 |
| `MGMT_PORT` | `3002` | 管理APIのポート番号 |

### TSワールドサーバー

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `PORT` | `3001` | APIサーバーポート |
| `DAY_LENGTH_MINUTES` | `24` | ゲーム内1日の実時間（分） |
| `TEST_SPIRITS` | — | セット時、テスト用エージェント2体を自動スポーン |

### フロントエンド

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `VITE_STAGE` | — | `legacy`でレガシーステージ使用 |

---

## 6. サービス起動順序と依存関係

**起動順序は重要**。ワールドサーバーが先に起動している必要がある。

```
1. TSワールドサーバー (port 3001)     ← 最初に起動必須
   npx tsx server/index.ts

2. Goエージェントサーバー (port 3002)  ← ワールドサーバーに依存
   cd spirits && go run ./cmd/
   - 起動時にワールドサーバーからGetBounds()を取得
   - 失敗時はデフォルト範囲 [-30, 30] × [-30, 30] にフォールバック

3. フロントエンド (port 5173)          ← 両方にプロキシ
   npm run dev
   - /api/  → localhost:3001 (ワールドサーバー)
   - /mgmt/ → localhost:3002 (管理API)
```

---

## 7. リソースシステム

エージェントには**スタミナ**と**メンタルエナジー**の2つの独立したリソースがある。

### スタミナ（TSワールドサーバー管理）

物理的な行動コスト。発話や移動に消費。

| パラメータ | 値 | 定義場所 |
|-----------|-----|---------|
| 最大スタミナ | 200 | server/world/WorldServer.ts |
| 基本回復 | 2/分 | server/world/WorldServer.ts |
| 休憩時回復倍率 | ×2.0 | server/world/WorldServer.ts |
| whisper コスト | 0 | server/world/WorldServer.ts |
| normal コスト | 1 | server/world/WorldServer.ts |
| shout コスト | 3 | server/world/WorldServer.ts |

### メンタルエナジー（Goエージェント管理）

認知的な行動コスト。Think（LLM呼び出し）に消費。

| パラメータ | 値 | 定義場所 |
|-----------|-----|---------|
| 最大メンタルエナジー | 100 | spirits/cmd/main.go |
| Think コスト (active/conversing) | 5 | spirits/cmd/main.go |
| 目標設定コスト (idle) | 10 | spirits/cmd/main.go |
| 基本回復 | 3/分 | spirits/cmd/main.go |
| 休憩時回復倍率 | ×3.0 | spirits/cmd/main.go |

---

## 8. タイミング定数

### 行動ループ（Goエージェント）

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| TickInterval | 1秒 | ワールド観測のtick間隔 |
| ConvTimeoutDuration | 30秒 | 沈黙時の会話→idle遷移タイムアウト |
| SayCooldown | 10秒 | 発話後の返答待ち時間 |

### Think間隔（エージェントごとにランダム化）

| 状態 | 範囲 | ベース値 | 定義場所 |
|------|------|---------|---------|
| idle | 17〜27秒 | 22秒 | spirits/cmd/spiritgen.go |
| active | 6〜9秒 | 7秒 | spirits/cmd/spiritgen.go |
| conversing | 2〜3秒 | 2.5秒 | spirits/cmd/spiritgen.go |
| resting | 6〜9秒 | 7秒 | spirits/cmd/spiritgen.go |

### 移動シミュレーション（TSワールドサーバー）

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| MOVE_TICK_MS | 200ms | 移動計算のtick間隔 |
| DEFAULT_MOVE_SPEED | 2.0 m/s | デフォルト歩行速度 |
| ARRIVAL_THRESHOLD | 0.3m | 到着判定の距離閾値 |
| SPIRIT_RADIUS | 0.4m | エージェントの衝突半径 |
| MIN_SPIRIT_DISTANCE | 1.5m | エージェント間の最小距離 |

### フロントエンド ポーリング間隔

| フック | 間隔 | エンドポイント |
|--------|------|--------------|
| useSpirits | 2秒 | GET /api/spirits |
| useAgentManager | 3秒 | GET /mgmt/agents |
| useWorldState | 30秒 | GET /api/world/time |

---

## 9. 視覚システム

エージェントの視界はFrustum Cullingで計算される（GPU不要、純粋な数学処理）。

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| 水平視野角 | 150° | server/world/vision.ts |
| 近距離クリップ | 0.5m | server/world/vision.ts |
| 遠距離クリップ | 30m | server/world/vision.ts |
| 目の高さ | 1.5m | server/world/vision.ts |

### 時間帯の境界

| 時間帯 | 時刻範囲 |
|--------|---------|
| morning | 6:00 〜 9:59 |
| day | 10:00 〜 16:59 |
| evening | 17:00 〜 19:59 |
| night | 20:00 〜 5:59 |

---

## 10. 実行方法

### フロントエンド（3Dワールド描画）
```bash
npm run dev             # Vite開発サーバー (プロキシ: /api → :3001, /mgmt → :3002)
```

### TSワールドサーバー（本番）
```bash
npx tsx server/index.ts   # ワールド初期化 + Hono HTTP API (port 3001)
```

### TSプロトタイプサーバー（参考用）
```bash
npm run server:start    # エージェント2体がスタブ思考で自律行動（参考実装）
npm run server:dev      # ファイル変更で自動再起動
npm run server:check    # 型チェックのみ
```

### Goエージェントサーバー
```bash
cd spirits && go run ./cmd/         # 開発実行
cd spirits && go build -o spirits-bin ./cmd && ./spirits-bin  # ビルド実行
```

---

## 11. マイルストーン

| 優先度 | 項目 | 状態 | 内容 |
|--------|------|------|------|
| ★1 | PicoClaw動作確認 | **完了** | clone、ビルド成功 (Go 1.25.7) |
| ★2 | コード読解・改造ポイント特定 | **完了** | AgentLoop: privateフィールド問題 → NewCustomLoop追加で解決。HTTPProvider: OpenAI形式のみ → カスタムAnthropicProvider自作 |
| ★3 | エージェント用ツール実装 (Go) | **一部完了** | observe, move_to, walk_to, stop, look_at, say, set_goal, rest: 完了。think: 未着手 |
| ★3.5 | 自律ループ + 複数エージェント | **完了** | SPIRIT_COUNT環境変数で数を指定。自動名前生成・ワークスペース生成・色生成。goroutineで並行自律行動 |
| ★3.6 | 動的スポーン/デスポーン | **完了** | 管理API（port 3002）+ フロントエンドUI。ワークスペース5タブ編集 |
| ★3.7 | ビルボードスプライト | **完了** | rpg-dot-maker ZIP → 8方向ビルボード。クライアントサイドのみ |
| ★4 | ワールドサーバー | **HTTP API完了** | TS維持確定 (Hono)。Goエージェントからlocalhostで呼び出し |
| ★5 | フロントエンド表示 | **完了** | あつ森風カメラ + ポーリング + エージェント描画 + 名前/吹き出し |
| ★5.5 | 動的ワークスペース生成 | **完了** | エージェントごとに持ち主プロフィール・興味・性格をランダム生成 |
| ★5.6 | ワールド読み込み | **完了** | JSON（Unityエクスポート）またはGLBからオブジェクト配置・地形高さを読み込み。パスグラフ・スポーンゾーン対応 |
| ★5.7 | 時間帯システム改善 | **完了** | DAY_LENGTH_MINUTES環境変数、フロントエンド同期、リアルタイム空・fog更新 |
| ★5.8 | GLBライト制御 | **完了** | KHR_lights_punctual対応。StreetLight等のPointLightを時間帯で制御 |
| ★6 | Supabase永続化 | 未着手 | セッション・会話ログの永続化 |
| ★7 | X OAuth + 人格生成 | 未着手 | Xプロフィールからエージェントを自動生成 |
