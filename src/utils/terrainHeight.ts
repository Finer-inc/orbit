/**
 * 地形高さ算出 — フロントエンド(Ground.tsx)とサーバー(WorldServer.ts)で共有
 *
 * XZ座標からY座標を返す。高台・階段・ノイズ起伏をすべて含む。
 */

const HIGHLAND_Y = 6
const NOISE_AMP = 1.2
const NOISE_FREQ = 0.08

// --- ノイズ ---

function hash(x: number, z: number): number {
  let h = x * 374761393 + z * 668265263
  h = ((h ^ (h >> 13)) * 1274126177) | 0
  return (h & 0x7fffffff) / 0x7fffffff
}

function smoothNoise(x: number, z: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const sx = fx * fx * (3 - 2 * fx)
  const sz = fz * fz * (3 - 2 * fz)
  const a = hash(ix, iz)
  const b = hash(ix + 1, iz)
  const c = hash(ix, iz + 1)
  const d = hash(ix + 1, iz + 1)
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz
}

function fbm(x: number, z: number, octaves: number): number {
  let value = 0
  let amp = 1
  let freq = 1
  let max = 0
  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * freq, z * freq) * amp
    max += amp
    amp *= 0.5
    freq *= 2
  }
  return value / max
}

// --- フラットゾーン ---

interface FlatZone {
  cx: number; cz: number
  rx: number; rz: number
  type: 'rect' | 'circle'
  baseY: number
}

const FLAT_ZONES: FlatZone[] = [
  { cx: 0, cz: 0, rx: 14, rz: 14, type: 'circle', baseY: 0 },
  { cx: 0, cz: 5, rx: 2, rz: 32, type: 'rect', baseY: 0 },
  { cx: 2.5, cz: 5, rx: 30, rz: 2, type: 'rect', baseY: 0 },
  { cx: 0, cz: -21, rx: 2, rz: 9, type: 'rect', baseY: 0 },
  { cx: 44, cz: 10, rx: 6, rz: 52, type: 'rect', baseY: -0.3 },
  { cx: 28, cz: 52, rx: 14, rz: 14, type: 'circle', baseY: -0.3 },
  { cx: -2, cz: 55, rx: 14, rz: 7, type: 'rect', baseY: 0 },
  { cx: 0, cz: -20, rx: 5, rz: 5, type: 'rect', baseY: 0 },
  { cx: 16, cz: 5, rx: 5, rz: 5, type: 'rect', baseY: 0 },
  { cx: 26, cz: 5, rx: 5, rz: 5, type: 'rect', baseY: 0 },
  { cx: -16, cz: 5, rx: 5, rz: 5, type: 'rect', baseY: 0 },
]

function flatWeight(x: number, z: number): { weight: number; baseY: number } {
  let best = 0
  let bestY = 0
  for (const zone of FLAT_ZONES) {
    let dist: number
    if (zone.type === 'circle') {
      const dx = (x - zone.cx) / zone.rx
      const dz = (z - zone.cz) / zone.rz
      dist = Math.sqrt(dx * dx + dz * dz)
    } else {
      const dx = Math.abs(x - zone.cx) / zone.rx
      const dz = Math.abs(z - zone.cz) / zone.rz
      dist = Math.max(dx, dz)
    }
    if (dist < 1.3) {
      const w = dist < 1.0 ? 1.0 : 1.0 - (dist - 1.0) / 0.3
      if (w > best) {
        best = w
        bestY = zone.baseY
      }
    }
  }
  return { weight: best, baseY: bestY }
}

// --- 高台 ---

function highlandHeight(x: number, z: number): number {
  if (x < -25 || x > 25 || z < -85 || z > -45) return 0
  // 階段開口部
  if (x > -3 && x < 3 && z > -45 && z < -28) return 0

  const edgeFade = 2.0
  let blend = 1.0
  if (z > -45 - edgeFade && z < -45 + edgeFade) {
    blend = Math.min(blend, ((-45) - z) / edgeFade)
  }
  if (z < -85 + edgeFade) {
    blend = Math.min(blend, (z - (-85)) / edgeFade)
  }
  if (x < -25 + edgeFade) {
    blend = Math.min(blend, (x - (-25)) / edgeFade)
  }
  if (x > 25 - edgeFade) {
    blend = Math.min(blend, (25 - x) / edgeFade)
  }
  blend = Math.max(0, Math.min(1, blend))
  return HIGHLAND_Y * blend
}

// --- 階段 ---

/** 階段領域: X=-3..3, Z=-28..-45, Y=0..6 */
function stairsHeight(x: number, z: number): number {
  if (x < -3 || x > 3 || z > -28 || z < -45) return 0
  // z=-28(Y=0) → z=-45(Y=6) の線形補間
  const t = (-28 - z) / (45 - 28) // 0..1
  return Math.max(0, Math.min(HIGHLAND_Y, t * HIGHLAND_Y))
}

// --- 公開API ---

/**
 * XZ座標から地形の高さ(Y)を返す。
 * Ground.tsx の Terrain コンポーネントと同一のロジック。
 */
export function getTerrainHeight(x: number, z: number): number {
  // 階段ゾーン
  const sY = stairsHeight(x, z)
  if (sY > 0) return sY

  // 高台
  const hY = highlandHeight(x, z)

  // ノイズ
  const noiseVal = (fbm(x * NOISE_FREQ, z * NOISE_FREQ, 4) - 0.5) * 2 * NOISE_AMP

  // フラットゾーン
  const { weight, baseY } = flatWeight(x, z)

  return hY + baseY + noiseVal * (1 - weight)
}

export { HIGHLAND_Y }
