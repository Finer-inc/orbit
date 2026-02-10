# Seirei Project Rules

## フロントエンド設計原則: レイアウト・コンポーネント・ロジックの疎結合

フロントエンドのコードは以下の3層を明確に分離すること。

### 1. Layout（レイアウト層）
- ページ全体の構造・配置のみを担当
- 子コンポーネントの並び順、グリッド、スペーシングを定義
- ビジネスロジックやデータ取得を一切含まない
- 配置先: `src/layouts/`

### 2. Component（コンポーネント層）
- UIの見た目と表示ロジックのみを担当
- props経由でデータとコールバックを受け取る
- 自身でAPIを呼ばない、グローバル状態を直接参照しない
- 再利用可能・テスト可能な純粋なUIパーツ
- 配置先: `src/components/`

### 3. Logic（ロジック層）
- データ取得、状態管理、ビジネスロジックを担当
- カスタムフック (`useXxx`) として実装
- UIに依存しない。フックだけでテスト可能
- 配置先: `src/hooks/`, `src/stores/`, `src/services/`

### 接続パターン

```
Page (Layout)
  └── データを useXxx() で取得
  └── Component に props で渡す
```

```tsx
// 良い例: ページがロジックとUIを接続する
function SpiritPage() {
  const { spirit, isLoading } = useSpirit(id)    // ロジック層
  return (
    <MainLayout>                                   {/* レイアウト層 */}
      <SpiritCard spirit={spirit} loading={isLoading} />  {/* コンポーネント層 */}
    </MainLayout>
  )
}
```

### 禁止事項
- コンポーネント内で直接 `fetch` や API呼び出しをしない
- レイアウトにビジネスロジックを書かない
- フック内でJSXを返さない
