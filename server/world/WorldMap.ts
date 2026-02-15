import { readFileSync } from 'node:fs'
import type { WorldObjectEntry } from '../../src/types/world.ts'
import { parseWorldGLB, buildTerrainMeshFromArrays, type ColNode, type HeightMap } from './parseGLB.ts'

export interface BedInfo {
  houseId: string
  position: [number, number, number]
}

export interface TerrainMeshData {
  positions: number[]   // [x0,y0,z0, x1,y1,z1, ...]
  indices: number[]
}

export interface WorldMapData {
  objects: WorldObjectEntry[]
  beds: BedInfo[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  heightMap: HeightMap
  terrainMesh?: TerrainMeshData
}

/** ベッド中心のローカル座標 — House.tsx の BED_LOCAL_OFFSET と一致させること */
const BED_LOCAL_OFFSET: [number, number, number] = [1.5, 0.35, -0.5]

// ---------------------------------------------------------------------------
//  AABB helpers
// ---------------------------------------------------------------------------

/**
 * Compute world-space AABB from localMin/localMax + translation + rotationY.
 * Rotates the 8 local-space corners by rotationY, then offsets by translation.
 */
function computeWorldAABB(
  localMin: [number, number, number],
  localMax: [number, number, number],
  translation: [number, number, number],
  rotationY: number,
): {
  min: [number, number, number]
  max: [number, number, number]
} {
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
//  colNodes → objects / beds / bounds 共通変換 (GLB format)
// ---------------------------------------------------------------------------

function buildWorldEntriesFromColNodes(colNodes: ColNode[]): {
  objects: WorldObjectEntry[]
  beds: BedInfo[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
} {
  const objects: WorldObjectEntry[] = []
  const beds: BedInfo[] = []

  for (const node of colNodes) {
    const id = `${node.type}-${node.index}`
    const bbox = computeWorldAABB(
      node.localMin, node.localMax, node.translation, node.rotationY,
    )

    objects.push({
      id,
      name: node.type,
      position: node.translation,
      rotationY: node.rotationY,
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
//  world.json format (new: Unity WorldExporter output)
// ---------------------------------------------------------------------------

interface WorldJsonObject {
  name: string
  position: [number, number, number]
  rotationY: number
  localMin: [number, number, number]
  localMax: [number, number, number]
}

interface WorldJson {
  objects: WorldJsonObject[]
  mesh: {
    positions: number[]   // [x0,y0,z0, x1,y1,z1, ...] — world-space
    indices: number[]
  }
}

// ---------------------------------------------------------------------------
//  world.json → objects / beds / bounds 変換
// ---------------------------------------------------------------------------

function buildWorldEntriesFromJson(jsonObjects: WorldJsonObject[]): {
  objects: WorldObjectEntry[]
  beds: BedInfo[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
} {
  const objects: WorldObjectEntry[] = []
  const beds: BedInfo[] = []

  // Track name counts for unique IDs
  const nameCounts = new Map<string, number>()

  for (const obj of jsonObjects) {
    const count = nameCounts.get(obj.name) ?? 0
    nameCounts.set(obj.name, count + 1)

    // ID = name if unique, name_N if duplicate
    const id = count === 0 ? obj.name : `${obj.name}_${count}`

    const bbox = computeWorldAABB(
      obj.localMin, obj.localMax, obj.position, obj.rotationY,
    )

    objects.push({
      id,
      name: obj.name,
      position: obj.position,
      rotationY: obj.rotationY,
      boundingBox: bbox,
    })
  }

  // Fix IDs: if a name appeared more than once, the first occurrence
  // should also have _0 suffix for consistency
  for (const [name, count] of nameCounts) {
    if (count > 1) {
      const first = objects.find((o) => o.id === name)
      if (first) first.id = `${name}_0`
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
//  Public API
// ---------------------------------------------------------------------------

export function createWorldMapFromGLB(glbPath: string): WorldMapData {
  const { colNodes, heightMap } = parseWorldGLB(glbPath)
  const { objects, beds, bounds } = buildWorldEntriesFromColNodes(colNodes)
  return { objects, beds, bounds, heightMap }
}

export function createWorldMapFromJSON(jsonPath: string): WorldMapData {
  const raw = readFileSync(jsonPath, 'utf-8')
  const data = JSON.parse(raw)

  // Detect format: new format has `mesh`, old format has `terrain`
  if (data.mesh) {
    // New format: {objects: [...], mesh: {positions, indices}}
    const json = data as WorldJson
    const { objects, beds, bounds } = buildWorldEntriesFromJson(json.objects)

    // mesh → HeightMap
    let heightMap: HeightMap = { getHeight: () => 0 }
    let terrainMesh: TerrainMeshData | undefined

    if (json.mesh && json.mesh.positions.length > 0) {
      const pos = json.mesh.positions
      const vertCount = pos.length / 3
      const vx = new Float32Array(vertCount)
      const vy = new Float32Array(vertCount)
      const vz = new Float32Array(vertCount)
      for (let i = 0; i < vertCount; i++) {
        vx[i] = pos[i * 3]
        vy[i] = pos[i * 3 + 1]
        vz[i] = pos[i * 3 + 2]
      }
      const indices = new Uint32Array(json.mesh.indices)
      heightMap = buildTerrainMeshFromArrays(vx, vy, vz, indices)
      terrainMesh = { positions: json.mesh.positions, indices: json.mesh.indices }

      // Expand bounds to include mesh extents
      for (let i = 0; i < vertCount; i++) {
        bounds.minX = Math.min(bounds.minX, vx[i])
        bounds.maxX = Math.max(bounds.maxX, vx[i])
        bounds.minZ = Math.min(bounds.minZ, vz[i])
        bounds.maxZ = Math.max(bounds.maxZ, vz[i])
      }
    }

    return { objects, beds, bounds, heightMap, terrainMesh }
  } else {
    // Legacy format: {colNodes: [...], terrain: {positions, indices}}
    const legacyData = data as {
      colNodes: ColNode[]
      terrain?: { positions: number[]; indices: number[] }
    }

    const { objects, beds, bounds } = buildWorldEntriesFromColNodes(legacyData.colNodes)

    let heightMap: HeightMap = { getHeight: () => 0 }
    let terrainMesh: TerrainMeshData | undefined

    if (legacyData.terrain) {
      const pos = legacyData.terrain.positions
      const vertCount = pos.length / 3
      const vx = new Float32Array(vertCount)
      const vy = new Float32Array(vertCount)
      const vz = new Float32Array(vertCount)
      for (let i = 0; i < vertCount; i++) {
        vx[i] = pos[i * 3]
        vy[i] = pos[i * 3 + 1]
        vz[i] = pos[i * 3 + 2]
      }
      const indices = new Uint32Array(legacyData.terrain.indices)
      heightMap = buildTerrainMeshFromArrays(vx, vy, vz, indices)
      terrainMesh = { positions: legacyData.terrain.positions, indices: legacyData.terrain.indices }
    }

    return { objects, beds, bounds, heightMap, terrainMesh }
  }
}
