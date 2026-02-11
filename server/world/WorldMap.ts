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

  // Fountains
  const fountain1Pos: [number, number, number] = [0, 0, 0]
  const fountain2Pos: [number, number, number] = [18, 0, 0]
  const fountain3Pos: [number, number, number] = [0, 0, 18]
  const fountain4Pos: [number, number, number] = [18, 0, 18]
  objects.push({
    id: 'fountain-0',
    type: 'fountain',
    position: fountain1Pos,
    boundingBox: computeFountainBBox(fountain1Pos),
  })
  objects.push({
    id: 'fountain-1',
    type: 'fountain',
    position: fountain2Pos,
    boundingBox: computeFountainBBox(fountain2Pos),
  })
  objects.push({
    id: 'fountain-2',
    type: 'fountain',
    position: fountain3Pos,
    boundingBox: computeFountainBBox(fountain3Pos),
  })
  objects.push({
    id: 'fountain-3',
    type: 'fountain',
    position: fountain4Pos,
    boundingBox: computeFountainBBox(fountain4Pos),
  })

  // Houses
  const houses: { position: [number, number, number]; rotation: [number, number, number] }[] = [
    // 広場1・2周辺
    { position: [-10, 0, -5], rotation: [0, Math.PI / 4, 0] },
    { position: [-10, 0, 6], rotation: [0, -Math.PI / 6, 0] },
    { position: [28, 0, -5], rotation: [0, -Math.PI / 4, 0] },
    { position: [28, 0, 6], rotation: [0, Math.PI / 6, 0] },
    // 広場3周辺
    { position: [-10, 0, 13], rotation: [0, Math.PI / 4, 0] },
    { position: [-10, 0, 24], rotation: [0, -Math.PI / 6, 0] },
    // 広場4周辺
    { position: [28, 0, 13], rotation: [0, -Math.PI / 4, 0] },
    { position: [28, 0, 24], rotation: [0, Math.PI / 6, 0] },
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
    // ベッドのワールド座標を計算
    const cosR = Math.cos(h.rotation[1])
    const sinR = Math.sin(h.rotation[1])
    const bedX = h.position[0] + BED_LOCAL_OFFSET[0] * cosR + BED_LOCAL_OFFSET[2] * sinR
    const bedZ = h.position[2] + (-BED_LOCAL_OFFSET[0] * sinR + BED_LOCAL_OFFSET[2] * cosR)
    beds.push({
      houseId,
      position: [bedX, BED_LOCAL_OFFSET[1], bedZ],
    })
  })

  // Trees
  const trees: { position: [number, number, number]; scale?: number }[] = [
    // 広場1周辺
    { position: [-6, 0, 10], scale: 1.2 },
    { position: [-14, 0, 3], scale: 1.0 },
    { position: [-8, 0, -12], scale: 0.8 },
    { position: [0, 0, -14], scale: 1.0 },
    { position: [-3, 0, 12], scale: 0.7 },
    // 広場1-2間
    { position: [9, 0, 6], scale: 0.9 },
    { position: [9, 0, -6], scale: 1.1 },
    // 広場2周辺
    { position: [24, 0, 10], scale: 1.2 },
    { position: [18, 0, -14], scale: 1.0 },
    { position: [32, 0, 3], scale: 1.0 },
    { position: [26, 0, -12], scale: 0.8 },
    { position: [21, 0, 12], scale: 0.7 },
    { position: [12, 0, 10], scale: 1.3 },
    // 広場3周辺
    { position: [-6, 0, 28], scale: 1.2 },
    { position: [-14, 0, 21], scale: 1.0 },
    { position: [-8, 0, 6], scale: 0.8 },
    { position: [0, 0, 32], scale: 1.0 },
    { position: [-3, 0, 30], scale: 0.7 },
    // 広場3-4間
    { position: [9, 0, 24], scale: 0.9 },
    { position: [9, 0, 12], scale: 1.1 },
    // 広場4周辺
    { position: [24, 0, 28], scale: 1.2 },
    { position: [18, 0, 32], scale: 1.0 },
    { position: [32, 0, 21], scale: 1.0 },
    { position: [26, 0, 6], scale: 0.8 },
    { position: [21, 0, 30], scale: 0.7 },
    { position: [12, 0, 28], scale: 1.3 },
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
