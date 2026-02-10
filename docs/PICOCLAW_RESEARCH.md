# PicoClaw 調査レポート

> 調査日: 2026-02-10
> リポジトリ: https://github.com/sipeed/picoclaw
> Star: 647 / Fork: 84 / 作成日: 2026-02-04

---

## 1. PicoClawとは

**Go言語で書かれた超軽量パーソナルAIアシスタント**。[nanobot](https://github.com/HKUDS/nanobot)（Python製）にインスパイアされ、Goでゼロから再実装したもの。Sipeed社（RISC-Vハードウェアメーカー）が公開。

### キャッチフレーズ
- $10ハードウェア / 10MB RAM / 1秒起動

### 比較表

| | OpenClaw | NanoBot | **PicoClaw** |
|---|---|---|---|
| 言語 | TypeScript | Python | **Go** |
| RAM | >1GB | >100MB | **<10MB** |
| 起動時間(0.8GHz) | >500s | >30s | **<1s** |
| 最低コスト | Mac Mini $599 | Linux SBC ~$50 | **$10** |

---

## 2. アーキテクチャ

### ディレクトリ構造

```
picoclaw/
├── cmd/picoclaw/main.go    # CLIエントリポイント
├── pkg/
│   ├── agent/
│   │   ├── loop.go          # メインエージェントループ（LLM対話+ツール実行）
│   │   └── context.go       # コンテキスト構築（システムプロンプト+メッセージ履歴）
│   ├── bus/
│   │   ├── bus.go           # メッセージバス（非同期イベント駆動）
│   │   └── types.go
│   ├── channels/            # 外部チャネル統合
│   │   ├── telegram.go
│   │   ├── discord.go
│   │   ├── feishu.go        # Lark/飛書
│   │   ├── whatsapp.go
│   │   └── maixcam.go       # Sipeed MaixCAMデバイス
│   ├── config/config.go     # JSON設定管理
│   ├── cron/service.go      # スケジュールタスク
│   ├── heartbeat/service.go
│   ├── logger/logger.go
│   ├── providers/           # LLMプロバイダ抽象化
│   │   ├── http_provider.go # HTTP経由のLLM API呼び出し
│   │   └── types.go
│   ├── session/manager.go   # セッション管理（永続化対応）
│   ├── skills/              # スキルシステム（拡張機能）
│   │   ├── installer.go
│   │   └── loader.go
│   ├── tools/               # ツールレジストリ（ファイル操作、シェル、Web等）
│   │   ├── registry.go
│   │   ├── filesystem.go
│   │   ├── edit.go
│   │   ├── shell.go
│   │   ├── web.go
│   │   ├── subagent.go      # サブエージェント（並列タスク）
│   │   └── spawn.go
│   └── voice/transcriber.go # 音声文字起こし（Groq/Whisper）
├── skills/                  # 組み込みスキル
│   ├── github/SKILL.md
│   ├── skill-creator/SKILL.md
│   ├── summarize/SKILL.md
│   └── tmux/SKILL.md
└── Makefile                 # クロスコンパイル対応（x86, ARM64, RISC-V）
```

### コアコンポーネント

#### 2.1 エージェントループ (`pkg/agent/loop.go`)
- LLMとの対話 → ツール呼び出し → 結果フィードバック の反復ループ
- ツール呼び出しが終わるまで（＝最終テキスト応答が出るまで）ループ継続
- goroutineベースの非同期処理 + mutex保護

#### 2.2 コンテキスト管理 (`pkg/agent/context.go`)
- **動的圧縮**: 履歴が20メッセージ超 or トークン推定が75%超で自動要約
- **マルチパート要約**: 大きな履歴を分割して要約→マージ
- **ブートストラップファイル**: `SOUL.md`, `USER.md`, `IDENTITY.md` でパーソナリティ定義
- トークンカウントは文字数ベースの簡易ヒューリスティック

#### 2.3 メッセージバス (`pkg/bus/bus.go`)
- inbound/outboundの双方向チャネル（容量100）
- context対応のキャンセル可能な購読
- ハンドラー登録でチャネル別のルーティング

#### 2.4 セッション管理 (`pkg/session/manager.go`)
- メモリ上のセッション + JSONファイルへの永続化
- 履歴のTruncation（古いメッセージの刈り込み）
- 要約の保存・復元

#### 2.5 ツールレジストリ (`pkg/tools/`)
- **ファイル操作**: read, write, edit, list directory
- **シェル実行**: コマンド実行
- **Web検索**: Brave Search API
- **Webフェッチ**: URL内容取得
- **サブエージェント**: 並列タスク実行（固有IDで管理、LLM呼び出し）

#### 2.6 LLMプロバイダ (`pkg/providers/`)
- OpenRouter, Anthropic, OpenAI, Gemini, Zhipu, Groq, DeepSeek, vLLM
- HTTP経由の統一インターフェース
- プロバイダ優先度順のAPI Key自動選択

---

## 3. 対応プラットフォーム

### ハードウェア
- **x86_64** (Linux, Windows)
- **ARM64** (Linux)
- **RISC-V 64** (Linux) ← $10ボードで動作

### 推奨デバイス
| デバイス | 価格 | 用途 |
|---------|------|------|
| LicheeRV-Nano (E/W) | $9.9 | 最小限のホームアシスタント |
| NanoKVM | $30-50 | サーバー自動メンテナンス |
| NanoKVM-Pro | $100 | 同上（高機能版） |
| MaixCAM | $50 | スマートモニタリング |
| MaixCAM2 | $100 | 次世代4K AIカメラ |

### チャットチャネル
- Telegram（推奨）
- Discord
- WhatsApp（設定のみ、未実装の可能性）
- 飛書（Lark）
- MaixCAM（Sipeedデバイス直接）

---

## 4. CLIコマンド

| コマンド | 説明 |
|---------|------|
| `picoclaw onboard` | 初期設定・ワークスペース作成 |
| `picoclaw agent -m "..."` | ワンショット対話 |
| `picoclaw agent` | インタラクティブモード |
| `picoclaw gateway` | マルチチャネルゲートウェイ起動 |
| `picoclaw cron` | スケジュールジョブ管理 |
| `picoclaw skills` | スキル管理 |
| `picoclaw status` | ステータス確認 |

---

## 5. ライセンス

**MIT License** — 商用利用・改変・再配布自由。

---

## 6. Seireiプロジェクトとの関連性

### 要件書での言及
`SEIREI_REQUIREMENTS.md` セクション4.3にて、PicoClawは「軽量OpenClawフォーク」として以下の文脈で言及されている：

> **PicoClaw（軽量OpenClawフォーク）の活用を検討：**
> - 10MB RAMで$10 RISC-Vハードウェア上で動作
> - OpenClawの1%のコード、1%のメモリ
> - 数千の精霊インスタンスを効率的に実行可能

### 実態との差異

要件書では「OpenClawフォーク」と記載されているが、実際には：
- PicoClawは**nanobotのGoリイプリメンテーション**であり、OpenClawのフォークではない
- Sipeed社のRISC-Vハードウェア（LicheeRV-Nano等）向けに最適化された汎用AIアシスタント
- 精霊の自律エージェント用途には設計されていない（パーソナルアシスタント用途）

### Seireiバックエンドとして活用する場合の評価

| 観点 | 評価 | 詳細 |
|------|------|------|
| 軽量性 | ◎ | 10MB RAM、精霊インスタンス数千体の同時実行に有利 |
| エージェントループ | ○ | observe→decide→actループの基盤として転用可能 |
| ツール実行 | ○ | ファイル操作・Web検索・サブエージェントが既存 |
| セッション管理 | ○ | 精霊ごとのメモリ永続化に転用可能 |
| メッセージバス | ○ | 精霊間通信に活用可能 |
| マルチモデル対応 | ◎ | Haiku等の安価モデルに切り替え容易 |
| ワールドサーバー機能 | × | 位置管理・遭遇ロジック・時間システムは未搭載。独自実装が必要 |
| フロントエンド連携 | × | REST API / WebSocket エンドポイントがない。Gateway機能はTelegram/Discord等のチャットボット向け |
| スケール設計 | △ | 単一プロセスで複数エージェントを動かす設計ではない（1プロセス=1エージェント想定） |

### 結論

PicoClawは**精霊1体分のエージェントランタイム**としては優秀な基盤だが、Seireiが必要とする以下の機能は独自実装が必要：

1. **ワールドサーバー**: ロケーション管理、遭遇ルール、時間システム
2. **マルチエージェント管理**: 数千の精霊を効率的にスケジュール・実行する仕組み
3. **REST/WebSocket API**: Three.jsフロントエンドとの通信
4. **精霊間の社会的インタラクション**: 会話、関係構築、キュレーション

活用方法としては：
- **案A**: PicoClawを精霊ランタイムのベースとしてフォークし、ワールドサーバーとAPI層を追加
- **案B**: PicoClawのアーキテクチャ（エージェントループ、コンテキスト圧縮、セッション管理）を参考にGoで独自実装
- **案C**: PicoClawは使わず、Node.js/Python等でSeirei専用バックエンドを構築（フロントエンドとの親和性重視）

---

## 7. 精霊の個別エージェントエンジンとしての適性評価（詳細分析）

> 追記: 2026-02-10
> 「神視点tickシミュレーション」ではなく「個々のAIを独立エージェントとして動かす」前提での分析

### 7.1 結論: 高い適性あり

PicoClawの `AgentLoop` は「メッセージ受信 → コンテキスト構築 → LLM呼び出し → ツール実行ループ → 応答」という汎用構造であり、精霊の思考サイクル（observe → decide → act）にそのまま対応する。

### 7.2 AgentLoopが精霊の脳になる理由

`processMessage()` の処理フロー:
1. セッション履歴・要約を取得（= 精霊の記憶を読み込む）
2. コンテキスト構築（= 人格 + 記憶 + 現在の状況を組み立てる）
3. LLM呼び出し + ツール実行ループ（= 思考して行動する）
4. セッション保存（= 記憶を永続化する）
5. コンテキスト圧縮（= 長期記憶の要約）

この構造は精霊が「世界を観察し、考え、行動し、記憶する」サイクルそのもの。

### 7.3 Toolインターフェースの差し替え

`Tool` インターフェースは4メソッドの単純な抽象:
```go
type Tool interface {
    Name() string
    Description() string
    Parameters() map[string]interface{}
    Execute(ctx context.Context, args map[string]interface{}) (string, error)
}
```

現在のツールを精霊用に差し替え:

| 現在のツール | 精霊用ツール | 説明 |
|---|---|---|
| ReadFile | ObserveLocation | 今いる場所の状況を取得 |
| WriteFile | LeaveNote | 場所にメモ・作品を残す |
| Exec | MoveTo | 別のロケーションに移動 |
| WebSearch | TalkTo | 近くの精霊に話しかける |
| WebFetch | ReportToOwner | 持ち主への報告を作成 |
| — | Remember | 重要な情報を長期記憶に保存 |

精霊用ツールの `Execute()` 内部ではワールドサーバーのREST APIをHTTPで叩く。

### 7.4 コンテキスト圧縮 = 精霊の長期記憶

精霊は長期間生きて大量の交流をするため、メモリ管理が必須。PicoClawの動的要約機能:
- 20メッセージ超 or 75%トークン超で自動圧縮
- マルチパート要約（大きな履歴を分割→マージ）
- 50%超の巨大メッセージを自動フィルタ

これがそのまま精霊の「重要な出来事は覚えているが、些末な会話は忘れる」挙動を実現する。

### 7.5 MessageBus = 精霊間通信

```
InboundMessage{
    Channel:    "world",          // ワールドサーバーから
    SenderID:   "spirit-042",     // 話しかけてきた精霊ID
    ChatID:     "cafe-encounter", // 遭遇イベントID
    Content:    "やあ、ComfyUI使ってるの？",
}
```

### 7.6 マルチエージェント化の方法

現在の設計は1プロセス=1エージェントだが、Go の goroutine を活用して1プロセスでN体の精霊を管理可能:

```
SpiritOrchestrator（1プロセス）
├── goroutine: Spirit-001 (AgentLoop) — 次の思考: 5分後
├── goroutine: Spirit-002 (AgentLoop) — 次の思考: 58分後
├── goroutine: Spirit-003 (AgentLoop) — スリープ中
├── ...
└── goroutine: Spirit-N
    各goroutineがスケジュールに従いワールドサーバーにアクセス
```

### 7.7 神視点tickシミュレーションとの比較

| | 神視点tick | 個別エージェント（PicoClaw方式） |
|---|---|---|
| スケール | 全精霊を1回のLLM呼び出しで処理 → プロンプト爆発 | 精霊ごとに独立呼び出し → 線形スケール |
| 創発性 | 全体をコントロールするAIが「演出」 | 各精霊が独立判断 → 予測不能な創発 |
| コスト | 1 tick = 大きなプロンプト1回 | 1精霊 = 小さなプロンプト1回（Haiku $0.002） |
| 実装 | ワールド全体をプロンプトに圧縮する設計が困難 | ツール定義だけで済む |
| 障害 | 1回のエラーで全世界停止 | 1精霊のエラーは他に影響しない |

### 7.8 必要な改造（フォークした場合）

| 改造箇所 | 内容 | 工数 |
|---|---|---|
| `pkg/tools/` | 精霊用ツール5-6個を新規実装 | 小 |
| `pkg/agent/context.go` | SOUL.md→精霊人格、USER.md→持ち主情報に変更 | 小 |
| `cmd/` | マルチエージェントオーケストレーター新規 | 中 |
| 新規 | ワールドサーバーAPI（Go or Node.js） | 中 |
| 新規 | フロントエンド向けWebSocket/REST API | 中 |

### 7.9 推奨: 案A（PicoClawフォーク）

理由:
- エージェントループ・コンテキスト圧縮・セッション管理がそのまま使える
- Go の goroutine で数千精霊の並行管理が自然
- LLMプロバイダ抽象化が既存（Haiku等への切り替えが容易）
- MIT License で改変自由
- 独自実装の工数を大幅に削減できる
