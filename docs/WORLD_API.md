# Seirei World API Reference

> 最終更新: 2026-02-10

---

## 概要

ワールドAPIは2つの層がある:

| 層 | 用途 | 状態 |
|---|---|---|
| **ブラウザAPI** (`window.__seirei`) | フロントエンドデバッグ用。コンソールからキャラクター操作 | 削除済（精霊ポーリング方式に移行） |
| **フロントエンドポーリング** | 精霊一覧・時間帯をREST APIからポーリング取得 | 実装済 |
| **サーバーAPI** (ツールシステム) | 精霊エージェントがワールドと対話するためのツール | 実装済 |

---

## 座標系

- **右手座標系** (THREE.js 標準)
- X: 左右 (正=右)
- Y: 上下 (正=上) — 地面 = 0、**キャラクターは常に Y=0 に固定**
- Z: 前後 (正=手前)
- **rotationY**: Y軸周りの回転（ラジアン）。0 = +Z方向、π/2 = +X方向

---

## ブラウザAPI (`window.__seirei`)

```
window.__seirei.character  // CharacterAPI
window.__seirei.vision     // VisionAPI
```

### CharacterAPI

#### `getPosition(): [number, number, number]`
キャラクターの現在位置を返す。

```js
window.__seirei.character.getPosition()
// → [5, 0, 5]
```

#### `getRotation(): number`
Y軸周りの回転角（ラジアン）を返す。

```js
window.__seirei.character.getRotation()
// → 0
```

#### `setPosition(x: number, z: number): void`
向きを変えずに位置のみ変更する。

```js
window.__seirei.character.setPosition(0, 0) // 噴水の位置へ
```

#### `moveTo(x: number, z: number): void`
指定座標へ瞬時に移動し、移動方向に向きを自動更新する。

```js
window.__seirei.character.moveTo(0, 0) // 噴水へ移動（向きも噴水方向になる）
```

- 向きは `atan2(dx, dz)` で計算される
- 現在位置と同じ座標を指定すると向きが `atan2(0, 0) = 0` にリセットされる

#### `moveForward(distance: number): void`
現在の向きに沿って前進する。負の値で後退。

```js
window.__seirei.character.moveForward(1)   // 1ユニット前進
window.__seirei.character.moveForward(-1)  // 1ユニット後退
```

- 移動量: X += sin(rotationY) * distance, Z += cos(rotationY) * distance

#### `rotate(angle: number): void`
現在の向きに対して相対的に回転する。

```js
window.__seirei.character.rotate(Math.PI / 2)  // 右に90度回転
window.__seirei.character.rotate(-Math.PI / 4)  // 左に45度回転
```

### VisionAPI

#### `getVisibleObjects(): VisibleObject[]`
キャラクターの一人称視野内にあるオブジェクトを返す。距離の近い順にソート。

```js
window.__seirei.vision.getVisibleObjects()
// → [
//   { id: "fountain-0", type: "fountain", position: [0,0,0], distance: 11.4, screenOccupancy: 0.1031 },
//   { id: "house-1",    type: "house",    position: [10,0,-5], distance: 13.2, screenOccupancy: 0.0257 },
//   ...
// ]
```

**視野パラメータ (ブラウザ・サーバー共通):**
| パラメータ | 値 |
|---|---|
| FOV | 90度 |
| アスペクト比 | 1:1 |
| Near | 0.5 |
| Far | 30 |
| 目の高さ | Y + 1.5 |

**VisibleObject のフィールド:**

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | `string` | オブジェクトID (例: `"fountain-0"`, `"house-1"`, `"tree-3"`) |
| `type` | `"fountain" \| "house" \| "tree"` | オブジェクト種別 |
| `position` | `[x, y, z]` | ワールド座標での位置 |
| `distance` | `number` | キャラクターの目からの距離（ユニット） |
| `screenOccupancy` | `number` | 視野内のスクリーン占有率 (0.0〜1.0)。0.1 = 視野の10% |

**検出方法**:
- ブラウザ: THREE.js の Frustum + Box3 によるバウンディングボックス交差判定
- サーバー: 純粋数学（Gribb/Hartmann法 + NDC投影）。同じ結果を返す

---

## フロントエンドポーリング

ブラウザ（Vite dev server）からViteプロキシ経由でAPIを取得する。

### 精霊一覧（2秒間隔）
```
GET /api/spirits → SpiritState[]
```

### 時間帯（30秒間隔）
```
GET /api/world/time → { timeOfDay, hour }
```

### SpiritState（フロントエンド用フィールド）

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | `string` | 精霊ID |
| `name` | `string` | 精霊名 |
| `position` | `[x, y, z]` | ワールド座標 |
| `rotationY` | `number` | Y軸回転 |
| `color` | `string` | 服の色（CSS色値、例: `#e8b88a`） |
| `lastSpeech` | `string?` | 最後の発話内容 |
| `lastSpeechAt` | `number?` | 最後の発話時刻（Unix ms） |

### カメラ

あつ森スタイルの固定角度俯瞰カメラ。最初の精霊を自動追従。

| パラメータ | 値 |
|---|---|
| オフセット | `[12, 16, 12]` |
| 追従速度 | lerp 0.05 |
| 回転 | なし（固定角度） |

---

## サーバーAPI（精霊ツールシステム）

精霊エージェントの`ThinkingEngine`が`ToolCall`を返し、対応するツールが実行される。

### `observe`
周囲を観察する。視界内のオブジェクト・精霊、全方位の声、時間帯を返す。

```typescript
// ToolCall
{ name: 'observe', args: {} }

// 内部: WorldServer.observe(spiritId) を呼び出し
// 返値: ObservationResult を自然言語に整形
```

**検知方式:**
- `objects`: FOV 90° 視野ベース（視界内のオブジェクトのみ）
- `spirits`: FOV 90° 視野ベース（視界内の精霊のみ。背後の精霊は検知不可）
- `voices`: 360度全方位（距離ベース。背後からの声も聞こえる）

### `move_to`
指定した場所に移動する。オブジェクトIDまたは座標を指定可能。

```typescript
// オブジェクトIDで移動
{ name: 'move_to', args: { target: 'fountain-0' } }

// 座標で移動
{ name: 'move_to', args: { target: '5,3' } }
```

### `walk_to`
任意の座標に歩いて移動する。精霊に近づくときに使う。自動的にターゲットの1.5m手前で停止する。

```typescript
// 座標を指定して移動
{ name: 'walk_to', args: { x: 3.0, z: -5.0 } }
```

### `look_at`
移動せずに指定した座標の方向を向く。会話前に相手を見る、周囲を見回すときに使う。

```typescript
{ name: 'look_at', args: { x: 0.0, z: 0.0 } }
```

### `say`
声を出す（空間ブロードキャスト）。発話位置から距離ベースで範囲内の全精霊に届く。

```typescript
// 通常の会話（5.0m以内に届く）
{ name: 'say', args: { message: 'こんにちは！', volume: 'normal' } }

// 特定の精霊に向かって話す（範囲内の全員に聞こえるが、宛先が明示される）
{ name: 'say', args: { message: 'こんにちは！', volume: 'normal', to: 'spirit-go-2' } }

// ささやき（1.5m以内のみ）
{ name: 'say', args: { message: '秘密だよ', volume: 'whisper', to: 'spirit-go-1' } }

// 叫び（15.0m以内に届く）
{ name: 'say', args: { message: 'おーい！', volume: 'shout' } }
```

**volumeと到達距離:**

| volume | 到達距離 | 用途 |
|--------|---------|------|
| `whisper` | 1.5m | ささやき、秘密の話 |
| `normal` | 5.0m | 通常の会話（デフォルト） |
| `shout` | 15.0m | 呼びかけ、遠くの精霊を呼ぶ |

**`to` パラメータ（任意）:**
- 指定あり: 受信側に「○○に向かって」と表示される
- 指定なし: 受信側に「独り言」と表示される
- **いずれの場合も範囲内の全精霊に届く**（toは配信範囲に影響しない）

**observeでの受信表示:**
```
届いた声:
  - Hikari（あなたに向かって）:「こんにちは！」(距離2.3, 通常の声)
  - Hikari（Kazeに向かって）:「あの木きれいだね」(距離4.8, 通常の声)
  - Kaze（独り言）:「噴水の音が心地いい…」(距離3.1, 通常の声)
```

### `think`
内省する。思考内容がMemoryStoreに記録される。

```typescript
{ name: 'think', args: { thought: '噴水のそばは落ち着く。' } }
```

---

## HTTP REST API (server/api.ts)

Go精霊エージェントがTS World Serverと通信するためのHTTP API。Honoフレームワーク使用。

### Base URL
`http://localhost:3001`

### エンドポイント一覧

#### 精霊登録
```
POST /api/spirits/register
Body: { "id": string, "name": string, "position": [number, number, number], "color"?: string }
Response: SpiritState
```

SpiritStateには `color`（服の色）、`lastSpeech`（最後の発話内容）、`lastSpeechAt`（最後の発話時刻）フィールドが含まれる。

#### 精霊削除
```
DELETE /api/spirits/:id
Response: { "ok": true }
```

#### 精霊一覧
```
GET /api/spirits
Response: SpiritState[]
```

#### 精霊取得
```
GET /api/spirits/:id
Response: SpiritState | { "error": "not found" }
```

#### 観察
```
POST /api/spirits/:id/observe
Response: ObservationResult (objects, spirits, timeOfDay, voices)
```
`objects`と`spirits`はFOV 90°視野ベース（背後は検知不可）。`voices`は360度全方位（距離ベース）。未読メッセージがある場合 `voices` に含まれる（取得後クリアされる）。

#### 移動
```
POST /api/spirits/:id/move
Body: { "targetX": number, "targetZ": number }
Response: { "success": boolean, "newPosition": [x,y,z], "newRotation": number }
```

#### 向き変更
```
POST /api/spirits/:id/look_at
Body: { "targetX": number, "targetZ": number }
Response: { "success": boolean, "newRotation": number }
```

#### 発話（空間ブロードキャスト）
```
POST /api/spirits/:id/say
Body: { "message": string, "volume": "whisper" | "normal" | "shout", "to"?: string }
Response: { "success": boolean, "hearers": number }
```
発話位置からvolumeに応じた距離内の全精霊にメッセージが届く。`to`は宛先の意図を示すが、配信範囲には影響しない。`hearers`は実際にメッセージが届いた精霊の数。

#### 観察（更新）
```
POST /api/spirits/:id/observe
Response: ObservationResult (objects, spirits, timeOfDay, voices)
```
`voices`フィールドに、前回observe以降に範囲内で発話された声が含まれる。

#### 時間帯
```
GET /api/world/time
Response: { "timeOfDay": string, "hour": number }
```

#### オブジェクト一覧
```
GET /api/world/objects
Response: WorldObjectEntry[]
```

#### オブジェクト取得
```
GET /api/world/objects/:id
Response: WorldObjectEntry | { "error": "not found" }
```

---

## ワールドオブジェクト一覧

### 噴水 (fountain)
| ID | 位置 |
|---|---|
| `fountain-0` | `[0, 0, 0]` |

### 家 (house)
| ID | 位置 | 回転Y |
|---|---|---|
| `house-0` | `[-10, 0, -5]` | π/4 (45度) |
| `house-1` | `[10, 0, -5]` | -π/4 (-45度) |

### 木 (tree)
| ID | 位置 | スケール |
|---|---|---|
| `tree-0` | `[-6, 0, 8]` | 1.2 |
| `tree-1` | `[7, 0, 9]` | 0.9 |
| `tree-2` | `[-14, 0, 3]` | 1.0 |
| `tree-3` | `[14, 0, 2]` | 1.1 |
| `tree-4` | `[-8, 0, -12]` | 0.8 |
| `tree-5` | `[9, 0, -11]` | 1.3 |
| `tree-6` | `[0, 0, -14]` | 1.0 |
| `tree-7` | `[-3, 0, 12]` | 0.7 |

---

## 利用パターン例

### ブラウザ: 特定のオブジェクトに近づいて観察する
```js
const s = window.__seirei
s.character.moveTo(0, 5)                     // 噴水の手前に移動
const objs = s.vision.getVisibleObjects()    // 何が見えるか確認
objs.filter(o => o.type === 'fountain')      // 噴水が見えるか
```

### ブラウザ: 周囲を見回して全オブジェクトを検出する
```js
const s = window.__seirei
const allFound = new Map()
for (let i = 0; i < 8; i++) {
  s.character.rotate(Math.PI / 4)           // 45度ずつ回転
  for (const obj of s.vision.getVisibleObjects()) {
    allFound.set(obj.id, obj)
  }
}
console.log([...allFound.values()])          // 全方位で見えたオブジェクト
```

### サーバー: 精霊の思考サイクル（SpiritAgent.tick()）
```
1. observe → 「噴水(距離7.1)、木2本が見える。Kazeが近くにいる(距離3.2)。」
2. ThinkingEngine.decideNextAction() → { name: 'say', args: {...} }
3. say実行 → 「Kazeに向かって「こんにちは！」と言った（通常の声、届いた精霊: 1体）」
```
