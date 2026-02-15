/**
 * GLB parser — extracts col_* collision nodes from a GLB file.
 *
 * Reads the JSON chunk of a GLB binary and extracts all nodes whose
 * name starts with "col_".  Each node's 4×4 matrix (column-major)
 * is decomposed into translation + Y-rotation, and the POSITION
 * accessor's min/max gives the local-space AABB.
 */
import { readFileSync } from 'node:fs'

// ---------------------------------------------------------------------------
//  Public types
// ---------------------------------------------------------------------------

export interface ColNode {
  name: string                                // e.g. "col_house_3"
  type: string                                // e.g. "house"
  index: number                               // e.g. 3
  translation: [number, number, number]       // from matrix column 3
  rotationY: number                           // radians, from matrix upper-left 3×3
  localMin: [number, number, number]          // accessor POSITION min
  localMax: [number, number, number]          // accessor POSITION max
}

// ---------------------------------------------------------------------------
//  GLTF JSON subset types (only what we need)
// ---------------------------------------------------------------------------

interface GltfNode {
  name?: string
  mesh?: number
  matrix?: number[]
  translation?: number[]
  rotation?: number[]      // quaternion [x, y, z, w]
  scale?: number[]
  children?: number[]
}

interface GltfPrimitive {
  attributes: { POSITION?: number; [k: string]: number | undefined }
  indices?: number
}

interface GltfMesh {
  primitives: GltfPrimitive[]
}

interface GltfAccessor {
  bufferView?: number
  byteOffset?: number
  componentType?: number   // 5126 = FLOAT
  count?: number
  type?: string            // "VEC3", "SCALAR", etc.
  min?: number[]
  max?: number[]
}

interface GltfBufferView {
  buffer: number
  byteOffset?: number
  byteLength: number
  byteStride?: number
}

interface GltfJson {
  nodes: GltfNode[]
  meshes: GltfMesh[]
  accessors: GltfAccessor[]
  bufferViews: GltfBufferView[]
  scenes: { nodes: number[] }[]
  scene?: number
}

// ---------------------------------------------------------------------------
//  Matrix helpers (column-major 4×4)
// ---------------------------------------------------------------------------

const IDENTITY: number[] = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]

/** Extract translation from a column-major 4×4 matrix. */
function matrixTranslation(m: number[]): [number, number, number] {
  return [m[12], m[13], m[14]]
}

/** Extract Y-axis rotation (radians) from a column-major 4×4 matrix.
 *  Assumes the matrix represents a Y-rotation (+ optional translation). */
function matrixRotationY(m: number[]): number {
  // m[0] = cos(θ), m[8] = sin(θ)  (column-major, Y-rotation)
  return Math.atan2(m[8], m[0])
}

/** Quaternion [x, y, z, w] → Y-axis rotation (radians). */
function quaternionToRotY(q: number[]): number {
  return 2 * Math.atan2(q[1], q[3])
}

/** Multiply two column-major 4×4 matrices: result = a * b */
function multiplyMatrices(a: number[], b: number[]): number[] {
  const out = new Array<number>(16)
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3]
    }
  }
  return out
}

/** Build local matrix from a GLTF node's transform properties. */
function getLocalMatrix(node: GltfNode): number[] {
  if (node.matrix) return node.matrix

  const t = node.translation ?? [0, 0, 0]
  const rotY = node.rotation ? quaternionToRotY(node.rotation) : 0
  const c = Math.cos(rotY)
  const s = Math.sin(rotY)
  // Column-major: Y-rotation + translation
  return [
    c, 0, s, 0,
    0, 1, 0, 0,
    -s, 0, c, 0,
    t[0], t[1], t[2], 1,
  ]
}

// ---------------------------------------------------------------------------
//  GLB binary parsing
// ---------------------------------------------------------------------------

const MAGIC_GLTF = 0x46546C67   // "glTF"
const CHUNK_TYPE_JSON = 0x4E4F534A  // "JSON"
const CHUNK_TYPE_BIN = 0x004E4942   // "BIN\0"

interface ParsedGLB {
  json: GltfJson
  binChunk: Buffer | null
}

function parseGLB(buffer: Buffer): ParsedGLB {
  // Header: magic(4) + version(4) + length(4) = 12 bytes
  const magic = buffer.readUInt32LE(0)
  if (magic !== MAGIC_GLTF) {
    throw new Error(`Not a GLB file (magic: 0x${magic.toString(16)})`)
  }

  // JSON chunk
  const jsonChunkLength = buffer.readUInt32LE(12)
  const jsonChunkType = buffer.readUInt32LE(16)
  if (jsonChunkType !== CHUNK_TYPE_JSON) {
    throw new Error(`Expected JSON chunk, got 0x${jsonChunkType.toString(16)}`)
  }
  const jsonStr = buffer.subarray(20, 20 + jsonChunkLength).toString('utf8')
  const json = JSON.parse(jsonStr) as GltfJson

  // BIN chunk (optional, immediately after JSON chunk)
  let binChunk: Buffer | null = null
  const binOffset = 20 + jsonChunkLength
  if (binOffset + 8 <= buffer.length) {
    const binLength = buffer.readUInt32LE(binOffset)
    const binType = buffer.readUInt32LE(binOffset + 4)
    if (binType === CHUNK_TYPE_BIN) {
      binChunk = buffer.subarray(binOffset + 8, binOffset + 8 + binLength)
    }
  }

  return { json, binChunk }
}

// ---------------------------------------------------------------------------
//  Binary accessor reading
// ---------------------------------------------------------------------------

/** Read VEC3 float positions from a GLTF accessor (requires BIN chunk). */
function readVec3Positions(
  gltf: GltfJson,
  binChunk: Buffer,
  accessorIndex: number,
): Float32Array | null {
  const acc = gltf.accessors[accessorIndex]
  if (!acc || acc.componentType !== 5126 || acc.type !== 'VEC3') return null
  if (acc.bufferView === undefined || acc.count === undefined) return null

  const bv = gltf.bufferViews[acc.bufferView]
  const byteOffset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const stride = bv.byteStride ?? 12  // VEC3 float = 12 bytes

  const count = acc.count
  const result = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const off = byteOffset + i * stride
    result[i * 3] = binChunk.readFloatLE(off)
    result[i * 3 + 1] = binChunk.readFloatLE(off + 4)
    result[i * 3 + 2] = binChunk.readFloatLE(off + 8)
  }

  return result
}

// ---------------------------------------------------------------------------
//  Index buffer reading
// ---------------------------------------------------------------------------

/** Read triangle indices from a GLTF accessor. */
function readIndices(
  gltf: GltfJson,
  binChunk: Buffer,
  accessorIndex: number,
): Uint32Array | null {
  const acc = gltf.accessors[accessorIndex]
  if (!acc || acc.type !== 'SCALAR') return null
  if (acc.bufferView === undefined || acc.count === undefined) return null

  const bv = gltf.bufferViews[acc.bufferView]
  const byteOffset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const count = acc.count
  const result = new Uint32Array(count)

  if (acc.componentType === 5125) {
    // UNSIGNED_INT (32-bit)
    for (let i = 0; i < count; i++) {
      result[i] = binChunk.readUInt32LE(byteOffset + i * 4)
    }
  } else if (acc.componentType === 5123) {
    // UNSIGNED_SHORT (16-bit)
    for (let i = 0; i < count; i++) {
      result[i] = binChunk.readUInt16LE(byteOffset + i * 2)
    }
  } else {
    return null
  }

  return result
}

// ---------------------------------------------------------------------------
//  TerrainMesh — triangle-based terrain height (supports bridges & caves)
// ---------------------------------------------------------------------------

export interface HeightMap {
  /** Get terrain height at (x, z).
   *  If fromY is given, returns the highest surface <= fromY (gravity).
   *  If fromY is omitted, returns the highest surface (spawn). */
  getHeight(x: number, z: number, fromY?: number): number
}

/** Build a HeightMap from pre-transformed world-space vertex arrays.
 *  Uses a 2D grid to bucket triangles, then does point-in-triangle + barycentric Y. */
export function buildTerrainMeshFromArrays(
  vx: Float32Array,
  vy: Float32Array,
  vz: Float32Array,
  indices: Uint32Array,
): HeightMap {
  const vertCount = vx.length

  // Find XZ bounds
  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  for (let i = 0; i < vertCount; i++) {
    if (vx[i] < minX) minX = vx[i]
    if (vx[i] > maxX) maxX = vx[i]
    if (vz[i] < minZ) minZ = vz[i]
    if (vz[i] > maxZ) maxZ = vz[i]
  }

  // Spatial grid: 2m cells
  const CELL_SIZE = 2.0
  const gridW = Math.ceil((maxX - minX) / CELL_SIZE) + 1
  const gridH = Math.ceil((maxZ - minZ) / CELL_SIZE) + 1
  const grid: number[][] = new Array(gridW * gridH)
  for (let i = 0; i < grid.length; i++) grid[i] = []

  // Insert each triangle into all grid cells it overlaps
  const triCount = indices.length / 3
  for (let t = 0; t < triCount; t++) {
    const i0 = indices[t * 3]
    const i1 = indices[t * 3 + 1]
    const i2 = indices[t * 3 + 2]

    // Triangle XZ bounding box
    const tMinX = Math.min(vx[i0], vx[i1], vx[i2])
    const tMaxX = Math.max(vx[i0], vx[i1], vx[i2])
    const tMinZ = Math.min(vz[i0], vz[i1], vz[i2])
    const tMaxZ = Math.max(vz[i0], vz[i1], vz[i2])

    const cxMin = Math.max(0, Math.floor((tMinX - minX) / CELL_SIZE))
    const cxMax = Math.min(gridW - 1, Math.floor((tMaxX - minX) / CELL_SIZE))
    const czMin = Math.max(0, Math.floor((tMinZ - minZ) / CELL_SIZE))
    const czMax = Math.min(gridH - 1, Math.floor((tMaxZ - minZ) / CELL_SIZE))

    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cz = czMin; cz <= czMax; cz++) {
        grid[cz * gridW + cx].push(t)
      }
    }
  }

  return {
    getHeight(x: number, z: number, fromY?: number): number {
      // Find grid cell
      const cx = Math.floor((x - minX) / CELL_SIZE)
      const cz = Math.floor((z - minZ) / CELL_SIZE)

      if (cx < 0 || cx >= gridW || cz < 0 || cz >= gridH) return 0

      const cell = grid[cz * gridW + cx]
      let bestY = -Infinity
      const ceiling = fromY !== undefined ? fromY + 0.5 : Infinity  // 0.5m margin for slopes

      for (const t of cell) {
        const i0 = indices[t * 3]
        const i1 = indices[t * 3 + 1]
        const i2 = indices[t * 3 + 2]

        // Barycentric coordinates in XZ plane
        const x0 = vx[i0], z0 = vz[i0]
        const x1 = vx[i1], z1 = vz[i1]
        const x2 = vx[i2], z2 = vz[i2]

        const dx0 = x1 - x0, dz0 = z1 - z0
        const dx1 = x2 - x0, dz1 = z2 - z0
        const dxp = x - x0, dzp = z - z0

        const det = dx0 * dz1 - dx1 * dz0
        if (Math.abs(det) < 1e-10) continue  // degenerate triangle

        const u = (dxp * dz1 - dx1 * dzp) / det
        const v = (dx0 * dzp - dxp * dz0) / det

        // Point inside triangle?
        if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) {
          const y = vy[i0] + u * (vy[i1] - vy[i0]) + v * (vy[i2] - vy[i0])
          if (y > bestY && y <= ceiling) bestY = y
        }
      }

      return bestY > -Infinity ? bestY : 0
    },
  }
}

/** Build a triangle mesh spatial index for fast height queries.
 *  Transforms local-space positions to world space, then delegates to buildTerrainMeshFromArrays. */
function buildTerrainMesh(
  positions: Float32Array,
  indices: Uint32Array,
  worldMatrix: number[],
): HeightMap {
  const vertCount = positions.length / 3
  const vx = new Float32Array(vertCount)
  const vy = new Float32Array(vertCount)
  const vz = new Float32Array(vertCount)

  for (let i = 0; i < vertCount; i++) {
    const lx = positions[i * 3]
    const ly = positions[i * 3 + 1]
    const lz = positions[i * 3 + 2]
    vx[i] = worldMatrix[0] * lx + worldMatrix[4] * ly + worldMatrix[8] * lz + worldMatrix[12]
    vy[i] = worldMatrix[1] * lx + worldMatrix[5] * ly + worldMatrix[9] * lz + worldMatrix[13]
    vz[i] = worldMatrix[2] * lx + worldMatrix[6] * ly + worldMatrix[10] * lz + worldMatrix[14]
  }

  return buildTerrainMeshFromArrays(vx, vy, vz, indices)
}

// ---------------------------------------------------------------------------
//  Node extraction
// ---------------------------------------------------------------------------

function getAccessorBounds(
  gltf: GltfJson,
  meshIndex: number,
): { min: [number, number, number]; max: [number, number, number] } | null {
  const mesh = gltf.meshes[meshIndex]
  if (!mesh?.primitives?.[0]) return null

  const posIdx = mesh.primitives[0].attributes.POSITION
  if (posIdx === undefined) return null

  const acc = gltf.accessors[posIdx]
  if (!acc?.min || !acc?.max) return null

  return {
    min: [acc.min[0], acc.min[1], acc.min[2]],
    max: [acc.max[0], acc.max[1], acc.max[2]],
  }
}

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

const COL_PREFIX = 'col_'
const COL_REGEX = /^col_(.+?)_(\d+)$/

export interface TerrainRawData {
  positions: Float32Array
  indices: Uint32Array
  worldMatrix: number[]
}

export interface ParseWorldResult {
  colNodes: ColNode[]
  heightMap: HeightMap
  terrainRaw?: TerrainRawData
}

export function parseWorldGLB(filePath: string): ParseWorldResult {
  const buffer = readFileSync(filePath)
  const { json: gltf, binChunk } = parseGLB(buffer)

  // Pre-compute world matrices for all nodes (handles nested groups)
  const worldMatrices: number[][] = new Array(gltf.nodes.length)

  function walkNode(nodeIdx: number, parentMatrix: number[]): void {
    const node = gltf.nodes[nodeIdx]
    const localMatrix = getLocalMatrix(node)
    const worldMatrix = multiplyMatrices(parentMatrix, localMatrix)
    worldMatrices[nodeIdx] = worldMatrix

    if (node.children) {
      for (const childIdx of node.children) {
        walkNode(childIdx, worldMatrix)
      }
    }
  }

  const sceneIdx = gltf.scene ?? 0
  for (const rootIdx of gltf.scenes[sceneIdx].nodes) {
    walkNode(rootIdx, IDENTITY)
  }

  const results: ColNode[] = []

  for (let nodeIdx = 0; nodeIdx < gltf.nodes.length; nodeIdx++) {
    const node = gltf.nodes[nodeIdx]
    if (!node.name?.startsWith(COL_PREFIX)) continue
    if (node.mesh === undefined) continue

    const match = node.name.match(COL_REGEX)
    if (!match) continue

    const type = match[1]
    const index = parseInt(match[2], 10)

    const bounds = getAccessorBounds(gltf, node.mesh)
    if (!bounds) continue

    // Use world matrix (composed from all ancestors)
    const wm = worldMatrices[nodeIdx]
    const translation = matrixTranslation(wm)
    const rotationY = matrixRotationY(wm)

    results.push({
      name: node.name,
      type,
      index,
      translation,
      rotationY,
      localMin: bounds.min,
      localMax: bounds.max,
    })
  }

  // Build terrain mesh for height queries (triangle-based, not grid)
  let heightMap: HeightMap = { getHeight: () => 0 }
  let terrainRaw: TerrainRawData | undefined
  if (binChunk) {
    for (let i = 0; i < gltf.nodes.length; i++) {
      const node = gltf.nodes[i]
      if (node.name !== 'vis_terrain' || node.mesh === undefined) continue

      const mesh = gltf.meshes[node.mesh]
      if (!mesh?.primitives?.[0]) break

      const prim = mesh.primitives[0]
      const posIdx = prim.attributes.POSITION
      if (posIdx === undefined || prim.indices === undefined) break

      const positions = readVec3Positions(gltf, binChunk, posIdx)
      if (!positions) break

      const triIndices = readIndices(gltf, binChunk, prim.indices)
      if (!triIndices) break

      const wm = worldMatrices[i] ?? IDENTITY
      terrainRaw = { positions, indices: triIndices, worldMatrix: wm }
      heightMap = buildTerrainMesh(positions, triIndices, wm)
      break
    }
  }

  return { colNodes: results, heightMap, terrainRaw }
}
