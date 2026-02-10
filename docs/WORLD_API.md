# Seirei World API Reference

ブラウザコンソールから `window.__seirei` でアクセスする。

```
window.__seirei.character  // CharacterAPI
window.__seirei.vision     // VisionAPI
```

---

## 座標系

- **右手座標系** (THREE.js 標準)
- X: 左右 (正=右)
- Y: 上下 (正=上) — 地面 = 0、**キャラクターは常に Y=0 に固定**
- Z: 前後 (正=手前)
- **rotationY**: Y軸周りの回転（ラジアン）。0 = +Z方向、π/2 = +X方向

---

## CharacterAPI

### `getPosition(): [number, number, number]`
キャラクターの現在位置を返す。

```js
window.__seirei.character.getPosition()
// → [5, 0, 5]
```

### `getRotation(): number`
Y軸周りの回転角（ラジアン）を返す。

```js
window.__seirei.character.getRotation()
// → 0
```

### `setPosition(x: number, z: number): void`
向きを変えずに位置のみ変更する。

```js
window.__seirei.character.setPosition(0, 0) // 噴水の位置へ
```

### `moveTo(x: number, z: number): void`
指定座標へ瞬時に移動し、移動方向に向きを自動更新する。

```js
window.__seirei.character.moveTo(0, 0) // 噴水へ移動（向きも噴水方向になる）
```

- 向きは `atan2(dx, dz)` で計算される
- 現在位置と同じ座標を指定すると向きが `atan2(0, 0) = 0` にリセットされる

### `moveForward(distance: number): void`
現在の向きに沿って前進する。負の値で後退。

```js
window.__seirei.character.moveForward(1)   // 1ユニット前進
window.__seirei.character.moveForward(-1)  // 1ユニット後退
```

- 移動量: X += sin(rotationY) * distance, Z += cos(rotationY) * distance

### `rotate(angle: number): void`
現在の向きに対して相対的に回転する。

```js
window.__seirei.character.rotate(Math.PI / 2)  // 右に90度回転
window.__seirei.character.rotate(-Math.PI / 4)  // 左に45度回転
```

---

## VisionAPI

### `getVisibleObjects(): VisibleObject[]`
キャラクターの一人称視野内にあるオブジェクトを返す。距離の近い順にソート。

```js
window.__seirei.vision.getVisibleObjects()
// → [
//   { id: "fountain-0", type: "fountain", position: [0,0,0], distance: 11.4, screenOccupancy: 0.1031 },
//   { id: "house-1",    type: "house",    position: [10,0,-5], distance: 13.2, screenOccupancy: 0.0257 },
//   ...
// ]
```

**視野パラメータ:**
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

**検出方法**: THREE.js の Frustum + Box3 によるバウンディングボックス交差判定。画像AI不使用。

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

### 特定のオブジェクトに近づいて観察する
```js
const s = window.__seirei
s.character.moveTo(0, 5)                     // 噴水の手前に移動
const objs = s.vision.getVisibleObjects()    // 何が見えるか確認
objs.filter(o => o.type === 'fountain')      // 噴水が見えるか
```

### 周囲を見回して全オブジェクトを検出する
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

### 最も視界を占めるオブジェクトを特定する
```js
const objs = window.__seirei.vision.getVisibleObjects()
const largest = objs.reduce((a, b) => a.screenOccupancy > b.screenOccupancy ? a : b)
console.log(largest.id, (largest.screenOccupancy * 100).toFixed(1) + '%')
```

### 特定のオブジェクトが見えるまで回転する
```js
const s = window.__seirei
function lookFor(targetId) {
  for (let i = 0; i < 72; i++) {             // 最大360度 (5度刻み)
    const found = s.vision.getVisibleObjects().find(o => o.id === targetId)
    if (found) return found
    s.character.rotate(Math.PI / 36)          // 5度回転
  }
  return null
}
lookFor('house-0')
```
