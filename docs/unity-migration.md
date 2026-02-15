# Unity移行 & 新world.json形式 変更ドキュメント

## 概要

Godotクライアントから**Unity 2022.3 LTS**に移行。
Polyperfect「Low Poly Epic City」アセットのFBXテクスチャパス問題を根本解決するため、アセット元のUnityで開発する方針に切り替えた。

同時に、ワールドデータ形式を刷新:
- **旧**: GLB内の`col_*`ノード + `vis_terrain`メッシュ（命名規則ベース）
- **新**: Unity WorldExporter出力のJSON（タグベース + 全メッシュ高さ）

## 設計変更

### 旧設計（GLB / 命名規則ベース）
- オブジェクトは `col_{type}_{index}` の命名規則（例: `col_house_0`, `col_tree_3`）
- サーバーが `type` と `index` をパースしてID生成（`house-0`）
- 地形は `vis_terrain` ノードの専用メッシュ
- `type === 'house'` で衝突判定をスキップ（精霊が家に入れる）

### 新設計（Unity Tag ベース）
- Unityの **AiObject タグ**が付いたオブジェクトのみ精霊が知覚できる
- オブジェクト名はそのまま採用（命名規則不要）
- **World配下の全メッシュ**が高さ計算に使われる（Terrainの概念なし）
- type固有のロジック（家のコリジョンスキップ等）を撤廃

### 新world.json形式

```json
{
  "objects": [
    {
      "name": "building-cafe",
      "position": [x, y, z],
      "rotationY": 0.5,
      "localMin": [x, y, z],
      "localMax": [x, y, z]
    }
  ],
  "mesh": {
    "positions": [x0, y0, z0, x1, y1, z1, ...],
    "indices": [0, 1, 2, ...]
  }
}
```

- `objects`: AiObjectタグ付きオブジェクト。AABB衝突判定 + 精霊の視覚認知に使用
- `mesh`: World配下の全MeshFilterの頂点・インデックス（ワールド座標）。三角形メッシュ高さ計算に使用
- 重複名は自動的に `Name_0`, `Name_1` とIDが振られる
- boundsはオブジェクトAABB + メッシュ頂点範囲の合算

### 旧形式との互換性

`createWorldMapFromJSON()` は `mesh` キーの有無でフォーマットを自動判別:
- `mesh` あり → 新形式
- `mesh` なし → レガシー形式 (`{colNodes, terrain}`)

GLB読み込み (`createWorldMapFromGLB()`) も引き続き動作する。

---

## 変更ファイル一覧

### サーバー (TypeScript)

| ファイル | 変更内容 |
|---|---|
| `src/types/world.ts` | `WorldObjectType` 削除。`WorldObjectEntry.type` → `.name`、`VisibleObject.type` → `.name`、`WorldObjectEntry.rotationY` 追加 |
| `server/world/WorldMap.ts` | 新JSON形式パーサー追加 (`buildWorldEntriesFromJson`)。`computeWorldAABB` を汎用化。メッシュ頂点からのbounds拡張。`TerrainMeshData` 型追加。レガシー形式もサポート継続 |
| `server/world/WorldServer.ts` | `getBounds()` メソッド追加。`getTerrainMesh()`, `getTerrainHeightmap()` メソッド追加。`obj.type === 'house'` コリジョンスキップを撤廃（全オブジェクトに衝突判定） |
| `server/world/vision.ts` | `VisibleObject` の `type` → `name` |
| `server/tools/observe.ts` | `OBJECT_TYPE_LABELS` 辞書とtypeグルーピングを削除。オブジェクト名をそのまま表示 |
| `server/tools/moveTo.ts` | `obj.type` → `obj.name` |
| `server/spirit/SpiritThinking.ts` | `obj.type` → `obj.name` |
| `server/api.ts` | `/api/world/bounds` エンドポイント追加、`/api/world/terrain` エンドポイント追加 |
| `server/index.ts` | 起動時にワールド範囲ログ出力。テスト精霊のスポーン位置をbounds内ランダムに変更 |

### Go Spirits

| ファイル | 変更内容 |
|---|---|
| `spirits/worldclient/client.go` | `VisibleObject.Type` → `.Name`、`WorldObject.Type` → `.Name`。`WorldBounds` 型と `GetBounds()` メソッド追加 |
| `spirits/cmd/spiritgen.go` | ハードコード座標定数(`-72~40, -85~60`) → `var`化(デフォルト`-30~30`)。`SetSpawnBounds()` 関数追加。`isBlockedSpawn()` を無効化（旧ワールド固有の水域ブロック削除） |
| `spirits/cmd/main.go` | 起動時に `/api/world/bounds` からスポーン範囲を取得して `SetSpawnBounds()` で設定。`obj.Type` → `obj.Name` |
| `spirits/spirittools/move_to.go` | `obj.Type` → `obj.Name` (2箇所) |
| `spirits/spirittools/observe.go` | `obj.Type` → `obj.Name` |

### Unity クライアント (`C:\UnityProjects\seirei-client\`)

| ファイル | 概要 |
|---|---|
| `Assets/Scripts/Api/ApiClient.cs` | REST APIポーリング（精霊0.5s、時間30s）。`JsonUtility`で基本パース後、正規表現で`position`配列を手動抽出（`JsonUtility`のfloat[]パース不具合対策） |
| `Assets/Scripts/Spirits/Spirit.cs` | 精霊の表示制御。位置/回転のLerp補間、発話バブル、ステータスラベル、スタミナバー、ビルボード |
| `Assets/Scripts/Spirits/SpiritManager.cs` | 精霊のライフサイクル管理。プログラマティックに人型メッシュ生成（Cubeプリミティブ）。Body Y +0.9オフセット（足が接地） |
| `Assets/Scripts/Camera/OrbitCamera.cs` | 右ドラッグ=軌道回転、ホイール=ズーム、中ドラッグ=パン |
| `Assets/Scripts/World/TimeSync.cs` | 時刻同期（30sポーリング + クライアント補間）。太陽色/環境光制御 |
| `Assets/Scripts/World/StreetlightController.cs` | 時間帯に応じた街灯のEmission制御 |
| `Assets/Scripts/Editor/WorldExporter.cs` | **Window → Seirei → Export World**。AiObjectタグ付きオブジェクト + World配下全メッシュをworld.jsonに出力。WSLパス自動コピー対応。BOMなしUTF-8出力 |

---

## セットアップ手順

### 1. Unity側

1. **AiObject タグ作成**: Edit → Project Settings → Tags and Layers → `AiObject` 追加
2. **World** 空GameObjectをシーンルートに作成
3. World配下にPolyperfectアセット等を配置
4. 精霊に知覚させたいオブジェクトに `AiObject` タグを付ける
5. 地面・テレイン等もWorldの下に入れる（高さ計算用）

### 2. エクスポート

1. **Window → Seirei → Export World** を開く
2. **Export World JSON** ボタンを押す
3. `seirei.now/public/worlds/world.json` に自動コピーされる

### 3. サーバー起動

```bash
cd ~/seirei.now
npx tsx watch server/index.ts
# または DAY_LENGTH_MINUTES=3 npx tsx watch server/index.ts
```

### 4. Go Spirits起動

```bash
cd ~/seirei.now/spirits
go run ./cmd/
```

### 5. Unity再生

Play ボタンで `http://localhost:3001` にポーリング開始。

---

## 既知の注意点

- **JsonUtility制限**: Unity の `JsonUtility` は `float[]` を含むオブジェクト配列のデシリアライズに問題あり。`ApiClient.cs` で正規表現による手動パースで対応済み
- **BOM問題**: C# の `Encoding.UTF8` はBOM付き出力。`new UTF8Encoding(false)` でBOMなし出力に修正済み
- **WSLパス**: Unity(Windows)からWSLファイルシステムへのアクセスは `\\wsl.localhost\Ubuntu\...` パスを使用
- **コリジョン**: 全オブジェクトに対してAABB衝突判定が適用される（旧: houseスキップ）。精霊を建物内に入れたい場合は別途対応が必要
- **ペルソナ**: Go spiritsは「負けず嫌い」等の性格特性をランダム生成。LLMがこれに沿って行動するため、性格に偏った発言が繰り返される場合がある
