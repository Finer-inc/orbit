# Seirei アーキテクチャ設計

> 作成日: 2026-02-10
> 最終更新: 2026-02-10

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

```
サーバー                          ブラウザ
────────                        ────────
精霊の脳（思考ループ）            Three.jsで描画
ワールド状態管理                  サーバーから状態を受信
視界計算（数学のみ）              ユーザーが見る画面
会話・記憶・遭遇判定              window.__seirei で操作（デバッグ用）

        ←── WebSocket/REST ──→
```

### 視界はブラウザ不要

視界（Frustum Culling）はGPUやThree.jsを必要としない。精霊の位置・向き・FOVから視錐台を計算し、オブジェクトのバウンディングボックスとの交差を判定するだけ。平面の方程式と内積で計算できる純粋な数学処理。

サーバー側の実装（`server/world/vision.ts`）ではGribb/Hartmann法でFrustum6平面を抽出し、AABB交差判定 + NDC投影によるscreenOccupancy計算を行う。フロントエンドのTHREE.js Frustumと同等の結果を返す。

### 開発方針: 面白さは試行錯誤で作る

「面白いか検証してから進む」のではなく、**作りながら面白くしていく**。枠組みを先に作り、その上に会話・人格・社会性を乗せていくイテレーティブなアプローチ。

---

## 2. 技術スタック

### 採用: TypeScript統一（案A）

```
┌──────────────── フロントエンド ─────────────────┐
│ React 19 + Three.js + React Three Fiber (実装済) │
│ WebSocketクライアント (未実装)                    │
│ → サーバーから精霊の位置・会話を受信して描画      │
│                                                  │
│ Vite 7 / TypeScript                              │
└──────────────────── ↕ WebSocket ─────────────────┘
┌──────────────── バックエンド ───────────────────┐
│ Node.js + TypeScript                             │
│                                                  │
│ ワールドサーバー (実装済)                         │
│ ├── ロケーション管理（座標 + BBox）              │
│ ├── 視界計算（純粋数学、GPU不要）(実装済)        │
│ ├── 遭遇判定（距離ベース）(実装済)              │
│ ├── 時間システム（朝昼夕夜サイクル）(実装済)     │
│ └── WebSocket + REST API (未実装)                │
│                                                  │
│ 精霊エージェント (枠組み実装済)                   │
│ ├── 人格プロンプト（Xプロフィールから生成）(未)  │
│ ├── 思考ループ（setInterval / スケジューラ）(済) │
│ ├── ツール実行（observe, move, talk, think）(済) │
│ ├── セッション管理（会話履歴 + 要約圧縮）(未)   │
│ └── LLM呼び出し（Claude Haiku）(未: スタブ動作中)│
│                                                  │
│ 認証: X (Twitter) OAuth (未実装)                 │
│ DB:   Supabase (未実装: インメモリストア稼働中)  │
│ LLM:  Anthropic API (Claude Haiku) (未実装)      │
└──────────────────────────────────────────────────┘
```

### 選定理由

| 判断基準 | TypeScript統一 | Go (PicoClawフォーク) |
|---|---|---|
| 1人で開発 | ◎ 1言語で完結 | △ Go + TS の2言語 |
| MVP速度 | ◎ | ○ |
| 精霊100体 | ◎ 余裕 | ◎ 余裕 |
| 精霊10,000体 | △ 工夫必要 | ◎ goroutineで自然 |
| PicoClaw流用 | × 設計思想のみ参考 | ◎ フォーク可能 |
| Supabase連携 | ◎ 公式SDK充実 | △ SDK弱い |
| 型共有 | ◎ フロント・バック共通 | × OpenAPI等で橋渡し必要 |

**10,000体が必要になるのはプロダクト成功後**。1人で最速デモを出すことが最優先。Goへの移行はトラクション証明後で十分。

### Node.jsで1000体は動くのか

精霊の思考処理は**LLM API呼び出し待ち**が99%。CPU処理はほぼゼロ。

- 1000体 × 1回/時（無料） = 17回/分のAPI呼び出し
- 100体 × 12回/時（有料5分間隔） = 20回/分のAPI呼び出し
- `Promise.all` + `setTimeout` で十分処理可能

Node.jsの非同期I/Oはこの用途に十分適している。

---

## 3. Go移行の判断基準（将来）

以下の条件を満たしたとき、Go（PicoClawフォーク）への移行を検討:

- 同時アクティブ精霊が5,000体を超えた
- Node.jsプロセスのメモリが8GBを超えた
- 思考頻度を1分以下に下げる要件が出た
- 物理デバイス版（$10 RISC-Vチップに精霊を入れる）を実装する段階

---

## 4. 実装済みコンポーネント

### 4.1 ワールドサーバー (`server/world/`)

| ファイル | 役割 | 状態 |
|---|---|---|
| `WorldServer.ts` | 中央管理: 精霊登録・移動・observe・遭遇判定 | 実装済 |
| `WorldClock.ts` | 加速時間システム（timeScale=60, 1実分=1ゲーム時間） | 実装済 |
| `WorldMap.ts` | ワールド定義 + BBox計算（噴水1, 家2, 木8 = 計11オブジェクト） | 実装済 |
| `vision.ts` | 純粋数学Frustum Culling + screenOccupancy | 実装済 |

**ステージデータ**: `WorldMap.ts`と`useWorldState.ts`にそれぞれ配置データがある。現状は手動で変更可能。動的切り替えが必要になった場合にデータ層を分離する。

### 4.2 精霊ランタイム (`server/spirit/`)

| ファイル | 役割 | 状態 |
|---|---|---|
| `SpiritRuntime.ts` | 複数精霊のスケジューラ（setIntervalベース、エラー隔離） | 実装済 |
| `SpiritAgent.ts` | 個別精霊: tick() = observe → think → execute | 実装済 |
| `SpiritThinking.ts` | `ThinkingEngine`インターフェース + ランダムスタブ | 実装済(スタブ) |

**ThinkingEngineの差し替え設計**: `SpiritThinking.ts`は`ThinkingEngine`インターフェースを定義し、現在は`createStubThinking()`がランダム行動を返す。将来これを`createLLMThinking()`に差し替えるだけでLLM化できる。

### 4.3 ツールシステム (`server/tools/`)

| ツール | ファイル | 説明 | 状態 |
|---|---|---|---|
| `observe` | `observe.ts` | 視界内オブジェクト + 近くの精霊 + 時間帯 | 実装済 |
| `move_to` | `moveTo.ts` | オブジェクトIDまたは"x,z"座標で移動 | 実装済 |
| `talk_to` | `talkTo.ts` | 近くの精霊に話しかけ（距離5以内） | 実装済 |
| `think` | `think.ts` | 内省をMemoryStoreに記録 | 実装済 |
| `report` | — | 持ち主への報告作成 | 未実装 |
| `remember` | — | 長期記憶に保存 | 未実装 |

### 4.4 ストレージ (`server/store/`)

| ファイル | 役割 | 状態 |
|---|---|---|
| `MemoryStore.ts` | `WorldStore`インターフェース + インメモリ実装 | 実装済 |

`WorldStore`インターフェースを定義済み。将来Supabase実装に差し替え可能。

### 4.5 CLIログ (`server/cli/`)

| ファイル | 役割 | 状態 |
|---|---|---|
| `logger.ts` | ANSIカラー付きCLI出力（アクション別色分け） | 実装済 |

---

## 5. 未実装コンポーネント

### 5.1 LLM思考エンジン

`ThinkingEngine`インターフェースのLLM実装。スタブの`createStubThinking()`を`createLLMThinking()`に差し替える。

```typescript
// 差し替えイメージ
const thinking = createLLMThinking({
  model: 'claude-haiku-4-5-20251001',
  personality: spiritPersonality,
  apiKey: process.env.ANTHROPIC_API_KEY,
})
```

PicoClawの設計を参考にする要素:
- コンテキスト圧縮（20メッセージ超 or 75%トークン超で自動要約）
- マルチパート要約
- 直近4メッセージの常時保持

### 5.2 WebSocket/REST API

サーバー↔ブラウザのリアルタイム同期。

| 種別 | プロトコル | 用途 |
|---|---|---|
| ワールド状態同期 | WebSocket | 精霊位置・会話・時間のリアルタイム配信 |
| 認証 | REST | X OAuthログイン・セッション管理 |
| レポート | REST | 朝のレポート取得・既読管理 |
| 精霊情報 | REST | 自分の精霊の詳細・カスタマイズ |

### 5.3 データベース (Supabase)

`MemoryStore`のインターフェースをSupabase実装に差し替え。

| テーブル | 内容 |
|---|---|
| `users` | ユーザー情報（X OAuth連携） |
| `spirits` | 精霊の基本情報（名前・人格・持ち主） |
| `spirit_memories` | 長期記憶（key-value + タイムスタンプ） |
| `spirit_sessions` | 会話履歴 + 要約 |
| `conversations` | 精霊間の会話ログ |
| `owner_reports` | 持ち主への報告（朝のレポート用） |
| `locations` | ワールドのロケーション定義 |

### 5.4 X OAuth + 人格生成

- Xプロフィール+ツイートから精霊の人格プロンプトを自動生成
- `SOUL.md`相当のプロンプトを動的に構築

### 5.5 フロントエンド追加

```
ブラウザ（追加予定）
├── WebSocket接続
│   └── サーバーからリアルタイムで受信:
│       ├── 精霊の位置更新
│       ├── 会話イベント
│       └── 時間帯変更
├── SpiritAvatar（追加: 精霊の3D表現）
└── UI
    ├── 自分の精霊の情報パネル
    ├── 会話ログ閲覧
    └── 朝のレポート画面
```

---

## 6. 共有型システム

フロントエンドとバックエンドは `src/types/world.ts` を共有している。

```
src/types/world.ts
├── TimeOfDay         — 'morning' | 'day' | 'evening' | 'night'
├── WorldObjectType   — 'fountain' | 'house' | 'tree'
├── WorldObjectEntry  — id, type, position, boundingBox
├── VisibleObject     — id, type, position, distance, screenOccupancy
├── CharacterState    — position, rotationY (フロントエンド用)
├── CharacterAPI      — moveTo, rotate等 (フロントエンド用)
├── VisionAPI         — getVisibleObjects (フロントエンド用)
├── SpiritState       — id, name, position, rotationY, currentAction, lastThinkAt
├── NearbySpiritInfo  — id, name, distance, position
├── ObservationResult — objects, spirits, timeOfDay
├── ToolDefinition    — name, description, parameters
├── ToolCall          — name, args
└── ToolResult        — success, data, message
```

`tsconfig.server.json`の`include: ["server", "src/types"]`でサーバー側から参照。

---

## 7. 実行方法

### サーバー（CLI、精霊の自律行動を確認）
```bash
npm run server:start    # 精霊2体が自律行動（3-5秒間隔）
npm run server:dev      # ファイル変更で自動再起動
npm run server:check    # 型チェックのみ
```

### フロントエンド（3Dワールド描画）
```bash
npm run dev             # Vite開発サーバー
```

サーバーとフロントエンドは現時点で独立して動作する（WebSocket未実装のため）。

---

## 8. 次のマイルストーン

| 優先度 | 項目 | 依存 |
|--------|------|------|
| ★1 | LLM思考エンジン（スタブ → Anthropic API） | なし |
| ★2 | WebSocket同期（サーバー精霊 → ブラウザ描画） | なし |
| ★3 | Supabase永続化（MemoryStore差し替え） | なし |
| ★4 | X OAuth + 人格生成 | Supabase |
| ★5 | 朝のレポート機能 | LLM + Supabase |
