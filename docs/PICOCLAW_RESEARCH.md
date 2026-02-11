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

### 採用判断: PicoClawフォークを採用

**PicoClawをフォークし、精霊エージェントランタイムとして使用する。**

#### 判断の経緯

当初はTypeScript統一スタックを選択していた（1言語で完結、型共有が楽）。しかし再検討の結果、PicoClawフォークに変更:

| 観点 | TypeScript自前 | PicoClawフォーク (Go) ← 採用 |
|---|---|---|
| エージェントの核（ループ・圧縮・セッション） | **全部書く必要あり** | **既に実装済み** |
| 1000体並行 | async/awaitで頑張る | goroutineで自然 |
| 追加実装量 | 多い | ツール差し替え + オーケストレーター |
| 言語 | 1つ | 2つ（Go + TS） |

**決め手**: 「Anthropic APIを直接叩く」はエージェントループ・コンテキスト圧縮・セッション管理の再発明。既存TSフレームワーク（Vercel AI SDK、Mastra等）も「1000体の自律エージェント」を想定しておらず代替にならない。PicoClawフォークが最も工数が少ない。

#### PicoClawが解決する部分

| 機能 | PicoClawの実装 |
|---|---|
| エージェントループ | `pkg/agent/loop.go` |
| コンテキスト圧縮 | `pkg/agent/context.go` |
| セッション管理 | `pkg/session/manager.go` |
| ツールフレームワーク | `pkg/tools/registry.go` |
| マルチLLMプロバイダ | `pkg/providers/` |
| サブエージェント | `pkg/tools/subagent.go` |

#### 改造が必要な部分

| 改造箇所 | 内容 |
|---|---|
| `pkg/tools/` | 精霊用ツール（observe, move_to, talk_to, think, report, remember） |
| `cmd/` | 1000 goroutine オーケストレーター新規 |
| 新規 | ワールドサーバー（位置・視界・遭遇・時間） |
| 新規 | WebSocket/REST API（フロントエンド向け） |
| `pkg/agent/context.go` | SOUL.md → Xプロフィールからの動的人格生成 |

### 物理デバイス版の可能性

精霊を$10 RISC-Vチップに入れて物理的に持ち歩ける「精霊デバイス」。PicoClawの10MB RAMフットプリントがそのまま活きる。

詳細は `ARCHITECTURE.md` を参照。

---

## 7. 精霊の個別エージェントエンジンとしての適性

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

PicoClawフォークではこの機能をそのまま利用し、精霊の「重要な出来事は覚えているが、些末な会話は忘れる」挙動を実現する。

---

## 8. 実際の利用状況（2026-02-10時点）

### 8.1 PicoClawの利用方式

PicoClawをローカルcloneし、**最小限の改造（2ファイル）を加えて精霊用に流用**。

問題: `AgentLoop`のツールレジストリがprivateフィールドで、`NewAgentLoop()`がReadFileTool等をハードコード登録する。また`ContextBuilder`のシステムプロンプトもPicoClaw固有。

解決: `NewCustomLoop()`コンストラクタを追加し、外部からツール・システムプロンプト・LLMプロバイダを注入可能にした。

改造したファイル:
| ファイル | 変更内容 |
|---|---|
| `pkg/agent/loop.go` | `CustomLoopConfig`構造体 + `NewCustomLoop()`追加 |
| `pkg/agent/context.go` | `customSystemPrompt`フィールド追加、BuildMessagesで分岐 |

利用するコンポーネント:
| コンポーネント | パッケージ | 用途 |
|---|---|---|
| `AgentLoop` (NewCustomLoop) | `pkg/agent/loop.go` | ツール実行ループ、文脈圧縮、セッション管理 |
| `SessionManager` | `pkg/session/manager.go` | 会話履歴のJSON永続化・復元・トランケーション |
| `ContextBuilder` (改造) | `pkg/agent/context.go` | カスタムシステムプロンプト + 要約をメッセージに組み立て |
| `ToolRegistry` | `pkg/tools/` | 精霊ツールの登録・実行 |
| `Tool` interface | `pkg/tools/base.go` | 精霊ツールの実装基盤 |
| `LLMProvider` interface | `pkg/providers/types.go` | AnthropicProviderの型合わせ |
| `Message`, `ToolCall` types | `pkg/providers/types.go` | LLM通信の型 |

利用しないコンポーネント:
| コンポーネント | 理由 |
|---|---|
| `NewAgentLoop()` | デフォルトコンストラクタ。ツール・プロンプトがハードコード |
| `HTTPProvider` | OpenAI `/chat/completions` 形式のみ。Anthropic非対応 |
| `channels/` | Telegram/Discord等は不要 |
| `skills/` | 精霊には不要 |

### 8.2 AnthropicProvider

PicoClawの`HTTPProvider`はOpenAI互換API (`/chat/completions`) のみ対応。Anthropicのネイティブ API (`/v1/messages`) は形式が異なる:
- system promptが別フィールド
- tool_useがcontent blocks
- tool_resultがuser messageのcontent block

`spirits/anthropic/provider.go`にAnthropicネイティブAPIプロバイダーを実装し、PicoClawの`LLMProvider`インターフェースを満たす。

### 8.3 動作確認結果

#### 単発テスト（observe + move_to）
```
Spirit registered: Hikari at [5, 0, 5]
[LLM] Tool call: observe
  → tree-1 (距離4.7), tree-7 (距離10.7)
[LLM] Tool call: move_to (target=tree-1)
  → 現在位置: [7.0, 0.0, 9.0]
[LLM] Tool call: observe
  → tree-1 (距離1.5)  ← 4.7→1.5に接近
[LLM] Response: 夜のバーチャルワールドで、大きな木に近づくことができました...
[Usage] input=1603 output=198 total=1801
```

#### 自律ループテスト（PicoClaw AgentLoop + ProcessDirect）
```
Spirit registered: Hikari at [5, 0, 5]
>>> 自律ループ開始 (間隔: 15s, Ctrl+C で停止)

--- Tick 1 ---
[Hikari] 大きな木の根元に到着しました。夜間の静けさの中で、古い木の力強い存在を感じます。

--- Tick 2 ---
[Hikari] 小さい木に到着しました。先ほどの大きな木とは異なり、こちらはまだ若々しい樹で...
         ↑ 前tickの行動を踏まえた発言（文脈蓄積が動作）

--- Tick 3 ---
[Hikari] この大きな木も見事な存在ですね。先ほどの木とは違う位置にありますが...
```

セッションはPicoClaw SessionManagerにより `sessions/spirit-go-1.json` に自動永続化。
プロセス再起動時に前回の行動履歴を引き継ぐ。

### 8.4 複数精霊の並行動作（2026-02-10時点）

2体の精霊(Hikari, Kaze)をgoroutineで並行実行。talk_toツールによる精霊間メッセージングが動作。

```
Spirit registered: Hikari at [5, 0, 5]
Spirit registered: Kaze at [-5, 0, -3]
>>> 自律ループ開始 (2体, 間隔: 15s, Ctrl+C で停止)

[Tick 1] Hikari → tree-7に移動、Kazeにメッセージ送信
[Tick 1] Kaze → fountain-0に移動
[Tick 2] Kaze → Hikari近くに移動、メッセージ受信「Hikariと出会えました！」
[Tick 3] Hikari → Kazeに再度話しかけ
[Tick 3] Kaze → 返事「一緒に新しい場所を探索する約束」
```

TS WorldServerにメッセージキュー（`PendingMessage[]`）を追加。`observe`時に未読メッセージを取得・クリアする仕組み。

設計課題: 現在の`talk_to`は宛先指定のダイレクトメッセージ方式。空間ブロードキャスト方式（`say`ツール）への変更を検討中。距離ベースで「声」が届く仕組みにすることで:
- 横を通りかかった精霊が会話に割り込む
- 遠くから叫んで注意を引く（shout: 15.0範囲）
- ささやきで秘密の話をする（whisper: 1.5範囲）
- 3体以上の会話が自然に発生
