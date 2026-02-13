import type { WorldObjectEntry } from '../../src/types/world.ts'

export interface BedInfo {
  houseId: string
  position: [number, number, number]
}

export interface WorldMapData {
  objects: WorldObjectEntry[]
  beds: BedInfo[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}

/** ベッド中心のローカル座標 — House.tsx の BED_LOCAL_OFFSET と一致させること */
const BED_LOCAL_OFFSET: [number, number, number] = [1.5, 0.35, -0.5]

// --- BBox computation functions (ported from worldObjectRegistry.ts, pure math) ---

export function computeFountainBBox(
  pos: [number, number, number],
): { min: [number, number, number]; max: [number, number, number] } {
  // 台座半径3.5, 高さは水柱含めて約3
  return {
    min: [pos[0] - 3.5, pos[1], pos[2] - 3.5],
    max: [pos[0] + 3.5, pos[1] + 3, pos[2] + 3.5],
  }
}

export function computeHouseBBox(
  pos: [number, number, number],
  rotation: [number, number, number],
): { min: [number, number, number]; max: [number, number, number] } {
  // 壁: 6x3.5x5, 屋根頂点: y=6, 煙突頂点: y=6.2
  // ローカル空間での角をrotationYで回転しAABBを再計算
  const halfW = 3   // 6/2
  const halfD = 2.5  // 5/2
  const height = 6.2

  const corners: [number, number][] = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, halfD],
    [-halfW, halfD],
  ]

  const rotY = rotation[1]
  const cosR = Math.cos(rotY)
  const sinR = Math.sin(rotY)

  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const [lx, lz] of corners) {
    const wx = lx * cosR + lz * sinR
    const wz = -lx * sinR + lz * cosR
    minX = Math.min(minX, wx)
    maxX = Math.max(maxX, wx)
    minZ = Math.min(minZ, wz)
    maxZ = Math.max(maxZ, wz)
  }

  return {
    min: [pos[0] + minX, pos[1], pos[2] + minZ],
    max: [pos[0] + maxX, pos[1] + height, pos[2] + maxZ],
  }
}

export function computeTreeBBox(
  pos: [number, number, number],
  scale: number = 1,
): { min: [number, number, number]; max: [number, number, number] } {
  // 葉の最大半径1, 高さ: 幹0-1.5 + 葉上段頂点3.75
  const r = 1 * scale
  const h = 3.75 * scale

  return {
    min: [pos[0] - r, pos[1], pos[2] - r],
    max: [pos[0] + r, pos[1] + h, pos[2] + r],
  }
}

// --- World Map factory ---

export function createWorldMap(): WorldMapData {
  const objects: WorldObjectEntry[] = []

  // Fountain - 中央に1つだけ
  const fountainPos: [number, number, number] = [0, 0, 0]
  objects.push({
    id: 'fountain-0',
    type: 'fountain',
    position: fountainPos,
    boundingBox: computeFountainBBox(fountainPos),
  })

  // Houses - 8 residential + 6 commercial/public = 14 total
  const houses: { position: [number, number, number]; rotation: [number, number, number] }[] = [
    // --- 高台の住宅 (0-7: residential, ベッドあり, Y=6) ---
    { position: [-18, 6, -55], rotation: [0, Math.PI / 3, 0] },
    { position: [-8, 6, -60], rotation: [0, -Math.PI / 6, 0] },
    { position: [5, 6, -58], rotation: [0, Math.PI / 4, 0] },
    { position: [18, 6, -54], rotation: [0, -Math.PI / 3, 0] },
    { position: [-15, 6, -72], rotation: [0, Math.PI / 5, 0] },
    { position: [-5, 6, -76], rotation: [0, -Math.PI / 4, 0] },
    { position: [8, 6, -74], rotation: [0, Math.PI / 6, 0] },
    { position: [16, 6, -70], rotation: [0, -Math.PI / 5, 0] },
    // --- 商業・公共施設 (8-13: ベッドなし) ---
    // City Hall
    { position: [0, 0, -20], rotation: [0, 0, 0] },
    // Bakery
    { position: [16, 0, 5], rotation: [0, Math.PI, 0] },
    // Bookshop
    { position: [26, 0, 5], rotation: [0, Math.PI, 0] },
    // Tool Shop
    { position: [-16, 0, 5], rotation: [0, Math.PI, 0] },
    // Cafe (高台 Y=6)
    { position: [-14, 6, -62], rotation: [0, Math.PI / 2, 0] },
    // General Store (高台 Y=6)
    { position: [14, 6, -58], rotation: [0, -Math.PI / 2, 0] },
  ]

  const beds: BedInfo[] = []
  houses.forEach((h, i) => {
    const houseId = `house-${i}`
    objects.push({
      id: houseId,
      type: 'house',
      position: h.position,
      boundingBox: computeHouseBBox(h.position, h.rotation),
    })
    // ベッドは住宅(index 0-7)にのみ配置
    if (i < 8) {
      const cosR = Math.cos(h.rotation[1])
      const sinR = Math.sin(h.rotation[1])
      const bedX = h.position[0] + BED_LOCAL_OFFSET[0] * cosR + BED_LOCAL_OFFSET[2] * sinR
      const bedZ = h.position[2] + (-BED_LOCAL_OFFSET[0] * sinR + BED_LOCAL_OFFSET[2] * cosR)
      beds.push({
        houseId,
        position: [bedX, h.position[1] + BED_LOCAL_OFFSET[1], bedZ],
      })
    }
  })

  // Trees - 53本
  const trees: { position: [number, number, number]; scale?: number }[] = [
    // --- 森エリア (X=-35〜-75, Z=-15〜35): 30本 ---
    { position: [-38, 0, -10], scale: 1.3 },
    { position: [-42, 0, -5], scale: 1.1 },
    { position: [-45, 0, 0], scale: 1.4 },
    { position: [-40, 0, 5], scale: 0.9 },
    { position: [-48, 0, 8], scale: 1.2 },
    { position: [-36, 0, 12], scale: 1.0 },
    { position: [-50, 0, 15], scale: 1.3 },
    { position: [-43, 0, 18], scale: 0.8 },
    { position: [-55, 0, 5], scale: 1.4 },
    { position: [-52, 0, -8], scale: 1.1 },
    { position: [-58, 0, 0], scale: 1.2 },
    { position: [-47, 0, 22], scale: 1.0 },
    { position: [-60, 0, 10], scale: 1.3 },
    { position: [-55, 0, 20], scale: 0.9 },
    { position: [-63, 0, -5], scale: 1.1 },
    { position: [-50, 0, 28], scale: 1.2 },
    { position: [-65, 0, 8], scale: 0.7 },
    { position: [-58, 0, 25], scale: 1.0 },
    { position: [-68, 0, 15], scale: 1.4 },
    { position: [-62, 0, 30], scale: 0.8 },
    { position: [-70, 0, 5], scale: 1.1 },
    { position: [-44, 0, 32], scale: 1.3 },
    { position: [-56, 0, -12], scale: 0.9 },
    { position: [-39, 0, -14], scale: 1.0 },
    { position: [-67, 0, 22], scale: 1.2 },
    { position: [-72, 0, 12], scale: 0.6 },
    { position: [-53, 0, 33], scale: 1.1 },
    { position: [-46, 0, -12], scale: 1.0 },
    { position: [-61, 0, -10], scale: 0.8 },
    { position: [-37, 0, 25], scale: 1.2 },
    // --- 公園エリア (-22, 0, 18)付近: 5本 ---
    { position: [-22, 0, 16], scale: 1.1 },
    { position: [-25, 0, 20], scale: 0.9 },
    { position: [-19, 0, 22], scale: 1.3 },
    { position: [-24, 0, 14], scale: 0.8 },
    { position: [-20, 0, 18], scale: 1.0 },
    // --- 高台の散在する木: 8本 (Y=6) ---
    { position: [-12, 6, -50], scale: 1.0 },
    { position: [12, 6, -48], scale: 0.9 },
    { position: [-20, 6, -65], scale: 1.1 },
    { position: [20, 6, -62], scale: 0.8 },
    { position: [-10, 6, -78], scale: 1.2 },
    { position: [10, 6, -80], scale: 0.7 },
    { position: [0, 6, -82], scale: 1.0 },
    { position: [-22, 6, -75], scale: 0.9 },
    // --- 湖の周り: 5本 ---
    { position: [20, 0, 48], scale: 1.1 },
    { position: [35, 0, 45], scale: 1.3 },
    { position: [22, 0, 58], scale: 0.9 },
    { position: [36, 0, 56], scale: 1.0 },
    { position: [28, 0, 42], scale: 0.8 },
    // --- 川沿い: 5本 ---
    { position: [38, 0, -20], scale: 1.0 },
    { position: [39, 0, -5], scale: 1.2 },
    { position: [38, 0, 15], scale: 0.9 },
    { position: [39, 0, 30], scale: 1.1 },
    { position: [38, 0, 45], scale: 0.8 },
  ]
  trees.forEach((t, i) => {
    objects.push({
      id: `tree-${i}`,
      type: 'tree',
      position: t.position,
      boundingBox: computeTreeBBox(t.position, t.scale),
    })
  })

  // Compute world bounds from all object bounding boxes
  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  for (const obj of objects) {
    minX = Math.min(minX, obj.boundingBox.min[0])
    maxX = Math.max(maxX, obj.boundingBox.max[0])
    minZ = Math.min(minZ, obj.boundingBox.min[2])
    maxZ = Math.max(maxZ, obj.boundingBox.max[2])
  }

  return {
    objects,
    beds,
    bounds: { minX, maxX, minZ, maxZ },
  }
}
