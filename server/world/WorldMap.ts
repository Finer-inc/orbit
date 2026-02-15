import { readFileSync } from 'node:fs'
import type { WorldObjectEntry } from '../../src/types/world.ts'
import { parseWorldGLB, buildTerrainMeshFromArrays, type ColNode, type HeightMap } from './parseGLB.ts'

export interface BedInfo {
  houseId: string
  position: [number, number, number]
}

export interface WorldMapData {
  objects: WorldObjectEntry[]
  beds: BedInfo[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  heightMap: HeightMap
}

/** ベッド中心のローカル座標 — House.tsx の BED_LOCAL_OFFSET と一致させること */
const BED_LOCAL_OFFSET: [number, number, number] = [1.5, 0.35, -0.5]

// ---------------------------------------------------------------------------
//  AABB helpers
// ---------------------------------------------------------------------------

/**
 * Compute world-space AABB from a col_* node.
 * Rotates the 8 local-space corners by rotationY, then offsets by translation.
 */
function computeWorldAABB(node: ColNode): {
  min: [number, number, number]
  max: [number, number, number]
} {
  const { localMin, localMax, translation, rotationY } = node
  const cosR = Math.cos(rotationY)
  const sinR = Math.sin(rotationY)

  // 8 corners of the local AABB
  const corners: [number, number, number][] = []
  for (const x of [localMin[0], localMax[0]]) {
    for (const y of [localMin[1], localMax[1]]) {
      for (const z of [localMin[2], localMax[2]]) {
        // Rotate around Y, then translate
        const wx = x * cosR + z * sinR + translation[0]
        const wy = y + translation[1]
        const wz = -x * sinR + z * cosR + translation[2]
        corners.push([wx, wy, wz])
      }
    }
  }

  // Compute AABB from rotated corners
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (const [cx, cy, cz] of corners) {
    minX = Math.min(minX, cx); maxX = Math.max(maxX, cx)
    minY = Math.min(minY, cy); maxY = Math.max(maxY, cy)
    minZ = Math.min(minZ, cz); maxZ = Math.max(maxZ, cz)
  }

  return {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
  }
}

// ---------------------------------------------------------------------------
//  colNodes → objects / beds / bounds 共通変換
// ---------------------------------------------------------------------------

function buildWorldEntries(colNodes: ColNode[]): {
  objects: WorldObjectEntry[]
  beds: BedInfo[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
} {
  const objects: WorldObjectEntry[] = []
  const beds: BedInfo[] = []

  for (const node of colNodes) {
    const id = `${node.type}-${node.index}`
    const bbox = computeWorldAABB(node)

    objects.push({
      id,
      type: node.type,
      position: node.translation,
      boundingBox: bbox,
    })

    // Houses get beds
    if (node.type === 'house') {
      const cosR = Math.cos(node.rotationY)
      const sinR = Math.sin(node.rotationY)

      // House ground Y = collision box bottom
      const groundY = node.translation[1] + node.localMin[1]

      const bedX = node.translation[0]
        + BED_LOCAL_OFFSET[0] * cosR + BED_LOCAL_OFFSET[2] * sinR
      const bedZ = node.translation[2]
        + (-BED_LOCAL_OFFSET[0] * sinR + BED_LOCAL_OFFSET[2] * cosR)

      beds.push({
        houseId: id,
        position: [bedX, groundY + BED_LOCAL_OFFSET[1], bedZ],
      })
    }
  }

  // World bounds from all objects
  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  for (const obj of objects) {
    minX = Math.min(minX, obj.boundingBox.min[0])
    maxX = Math.max(maxX, obj.boundingBox.max[0])
    minZ = Math.min(minZ, obj.boundingBox.min[2])
    maxZ = Math.max(maxZ, obj.boundingBox.max[2])
  }

  return { objects, beds, bounds: { minX, maxX, minZ, maxZ } }
}

// ---------------------------------------------------------------------------
//  world.json format
// ---------------------------------------------------------------------------

interface WorldJson {
  colNodes: ColNode[]
  terrain: {
    positions: number[]   // [x0,y0,z0, x1,y1,z1, ...] — world-space
    indices: number[]
  }
}

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

export function createWorldMapFromGLB(glbPath: string): WorldMapData {
  const { colNodes, heightMap } = parseWorldGLB(glbPath)
  const { objects, beds, bounds } = buildWorldEntries(colNodes)
  return { objects, beds, bounds, heightMap }
}

export function createWorldMapFromJSON(jsonPath: string): WorldMapData {
  const raw = readFileSync(jsonPath, 'utf-8')
  const data: WorldJson = JSON.parse(raw)

  const { objects, beds, bounds } = buildWorldEntries(data.colNodes)

  // terrain → HeightMap
  let heightMap: HeightMap = { getHeight: () => 0 }
  if (data.terrain) {
    const pos = data.terrain.positions
    const vertCount = pos.length / 3
    const vx = new Float32Array(vertCount)
    const vy = new Float32Array(vertCount)
    const vz = new Float32Array(vertCount)
    for (let i = 0; i < vertCount; i++) {
      vx[i] = pos[i * 3]
      vy[i] = pos[i * 3 + 1]
      vz[i] = pos[i * 3 + 2]
    }
    const indices = new Uint32Array(data.terrain.indices)
    heightMap = buildTerrainMeshFromArrays(vx, vy, vz, indices)
  }

  return { objects, beds, bounds, heightMap }
}
