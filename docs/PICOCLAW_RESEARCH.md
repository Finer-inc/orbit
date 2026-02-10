# PicoClaw 調査レポート

> 調査日: 2026-02-10
> 最終更新: 2026-02-10
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

## 6. Seireiプロジェクトでの位置づけ

### 採用判断

**PicoClawのフォークは採用しなかった**。代わりにPicoClawの設計思想を参考にしたTypeScript統一スタックを選択。

| 判断基準 | PicoClawフォーク (Go) | TypeScript統一 (採用) |
|---|---|---|
| 1人で開発 | △ Go + TSの2言語 | ◎ 1言語で完結 |
| フロント型共有 | × OpenAPI等で橋渡し | ◎ `src/types/world.ts`を直接共有 |
| Supabase連携 | △ SDK弱い | ◎ 公式SDK充実 |
| MVP速度 | ○ | ◎ |
| 精霊10,000体以上 | ◎ goroutine | △ 工夫必要 |

**Go移行条件**: 同時5,000体超 / メモリ8GB超 / 物理デバイス版。詳細は`ARCHITECTURE.md` §3参照。

### PicoClawから参考にした設計

以下のコンセプトはSeireiのTypeScript実装に取り入れた:

| PicoClawの設計 | Seireiでの対応 |
|---|---|
| `AgentLoop.processMessage()` | `SpiritAgent.tick()` — observe→decide→act |
| `Tool`インターフェース (Name/Description/Parameters/Execute) | `server/tools/types.ts` — 同じ構造 |
| `SessionManager` (メモリ+永続化) | `MemoryStore` (インメモリ、将来Supabase) |
| `context.go`の動的圧縮 (20msg / 75%トークン) | 未実装。LLM接続時に同じ方式を採用予定 |
| `SOUL.md`でパーソナリティ定義 | 未実装。X OAuth連携時に動的生成予定 |
| `MessageBus` (inbound/outbound) | 精霊間通信は`talk_to`ツール経由で実装済 |

### 将来: 物理デバイス版の可能性

精霊を$10 RISC-Vチップに入れて物理的に持ち歩ける「精霊デバイス」のビジョンがある。その段階ではPicoClawのGoランタイム（10MB RAM）をフォークする可能性がある。

---

## 7. 精霊の個別エージェントエンジンとしての適性（参考分析）

> PicoClawフォークは不採用だが、設計の妥当性検証として分析を残す

### 7.1 AgentLoopが精霊の脳になる理由

`processMessage()` の処理フロー:
1. セッション履歴・要約を取得（= 精霊の記憶を読み込む）
2. コンテキスト構築（= 人格 + 記憶 + 現在の状況を組み立てる）
3. LLM呼び出し + ツール実行ループ（= 思考して行動する）
4. セッション保存（= 記憶を永続化する）
5. コンテキスト圧縮（= 長期記憶の要約）

この構造は精霊が「世界を観察し、考え、行動し、記憶する」サイクルそのもの。
Seireiの`SpiritAgent.tick()`はこの設計を簡略化して実装している。

### 7.2 Toolインターフェースの対応

```go
// PicoClaw
type Tool interface {
    Name() string
    Description() string
    Parameters() map[string]interface{}
    Execute(ctx context.Context, args map[string]interface{}) (string, error)
}
```

```typescript
// Seirei (server/tools/types.ts)
interface Tool {
    definition: ToolDefinition  // name, description, parameters
    execute(spiritId: string, args: Record<string, unknown>): Promise<ToolResult>
}
```

### 7.3 コンテキスト圧縮 = 精霊の長期記憶

精霊は長期間生きて大量の交流をするため、メモリ管理が必須。PicoClawの動的要約機能:
- 20メッセージ超 or 75%トークン超で自動圧縮
- マルチパート要約（大きな履歴を分割→マージ）
- 50%超の巨大メッセージを自動フィルタ

これを精霊の「重要な出来事は覚えているが、些末な会話は忘れる」挙動に転用する（LLM接続時に実装予定）。
