import type { WorldObjectEntry } from '../../src/types/world.ts'

export interface WorldMapData {
  objects: WorldObjectEntry[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}

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
  // 壁: 4x3x3, 屋根頂点: y=5, 煙突頂点: y=5.1
  // ローカル空間での角をrotationYで回転しAABBを再計算
  const halfW = 2   // 4/2
  const halfD = 1.5  // 3/2
  const height = 5.1

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

  // Fountain
  const fountainPos: [number, number, number] = [0, 0, 0]
  objects.push({
    id: 'fountain-0',
    type: 'fountain',
    position: fountainPos,
    boundingBox: computeFountainBBox(fountainPos),
  })

  // Houses
  const houses: { position: [number, number, number]; rotation: [number, number, number] }[] = [
    { position: [-10, 0, -5], rotation: [0, Math.PI / 4, 0] },
    { position: [10, 0, -5], rotation: [0, -Math.PI / 4, 0] },
  ]
  houses.forEach((h, i) => {
    objects.push({
      id: `house-${i}`,
      type: 'house',
      position: h.position,
      boundingBox: computeHouseBBox(h.position, h.rotation),
    })
  })

  // Trees
  const trees: { position: [number, number, number]; scale?: number }[] = [
    { position: [-6, 0, 8], scale: 1.2 },
    { position: [7, 0, 9], scale: 0.9 },
    { position: [-14, 0, 3], scale: 1.0 },
    { position: [14, 0, 2], scale: 1.1 },
    { position: [-8, 0, -12], scale: 0.8 },
    { position: [9, 0, -11], scale: 1.3 },
    { position: [0, 0, -14], scale: 1.0 },
    { position: [-3, 0, 12], scale: 0.7 },
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
    bounds: { minX, maxX, minZ, maxZ },
  }
}
