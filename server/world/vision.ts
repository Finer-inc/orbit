import type { WorldObjectEntry, VisibleObject } from '../../src/types/world.ts'

// --- Matrix math helpers ---

/** Multiply two column-major 4x4 matrices: result = a * b */
function mat4Multiply(a: Float64Array, b: Float64Array): Float64Array {
  const out = new Float64Array(16)
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

/** Transform a 3D point by a 4x4 column-major matrix, returning [x, y, z, w] */
function mat4TransformVec4(m: Float64Array, x: number, y: number, z: number, w: number): [number, number, number, number] {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w,
  ]
}

/** Normalize a 3D vector in-place, returns the same array for chaining */
function vec3Normalize(v: [number, number, number]): [number, number, number] {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  if (len > 0) {
    v[0] /= len; v[1] /= len; v[2] /= len
  }
  return v
}

/** Cross product of two 3D vectors */
function vec3Cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

/** Dot product of two 3D vectors */
function vec3Dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

// --- Frustum plane representation ---

interface FrustumPlane {
  nx: number
  ny: number
  nz: number
  d: number
}

/** Normalize a frustum plane (a, b, c, d) so the normal has unit length */
function normalizePlane(nx: number, ny: number, nz: number, d: number): FrustumPlane {
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
  return { nx: nx / len, ny: ny / len, nz: nz / len, d: d / len }
}

// --- Perspective projection matrix ---

function buildPerspectiveMatrix(fovDeg: number, near: number, far: number): Float64Array {
  const fovRad = fovDeg * Math.PI / 180
  const f = 1 / Math.tan(fovRad / 2)
  const aspect = 1

  const m = new Float64Array(16)
  m[0] = f / aspect
  m[5] = f
  m[10] = (far + near) / (near - far)
  m[14] = (2 * far * near) / (near - far)
  m[11] = -1
  // all other elements are 0
  return m
}

// --- View matrix ---

function buildViewMatrix(eyeX: number, eyeY: number, eyeZ: number, rotationY: number): Float64Array {
  // Forward direction based on rotationY
  const forward: [number, number, number] = [Math.sin(rotationY), 0, Math.cos(rotationY)]
  const up: [number, number, number] = [0, 1, 0]

  // Right = normalize(cross(forward, up))
  const right = vec3Normalize(vec3Cross(forward, up))

  // Recompute up = cross(negForward, right) -- but since forward is horizontal and up is vertical,
  // the true camera up is just cross(right, forward) to handle general cases
  // Actually for a lookAt: camUp = cross(right, forward)
  // But here forward is horizontal so up stays [0,1,0]. Let's compute properly anyway.
  const negForward: [number, number, number] = [-forward[0], -forward[1], -forward[2]]
  const camUp = vec3Normalize(vec3Cross(right, forward))

  // View matrix = rotation^T * translation(-eye)
  // Column-major layout:
  // col0: right.x,     camUp.x,     negForward.x,  0
  // col1: right.y,     camUp.y,     negForward.y,  0
  // col2: right.z,     camUp.z,     negForward.z,  0
  // col3: -dot(right,eye), -dot(camUp,eye), -dot(negForward,eye), 1
  //
  // Wait -- view matrix in column-major for OpenGL:
  // The rows of the rotation part are right, up, -forward.
  // In column-major storage, m[col*4 + row]:
  //   m[0]=right.x  m[1]=camUp.x  m[2]=-fwd.x  m[3]=0
  //   m[4]=right.y  m[5]=camUp.y  m[6]=-fwd.y  m[7]=0
  //   m[8]=right.z  m[9]=camUp.z  m[10]=-fwd.z m[11]=0
  //   m[12]=tx      m[13]=ty      m[14]=tz     m[15]=1

  const eye: [number, number, number] = [eyeX, eyeY, eyeZ]
  const m = new Float64Array(16)

  // Column 0
  m[0] = right[0]
  m[1] = camUp[0]
  m[2] = negForward[0]
  m[3] = 0

  // Column 1
  m[4] = right[1]
  m[5] = camUp[1]
  m[6] = negForward[1]
  m[7] = 0

  // Column 2
  m[8] = right[2]
  m[9] = camUp[2]
  m[10] = negForward[2]
  m[11] = 0

  // Column 3: translation
  m[12] = -vec3Dot(right, eye)
  m[13] = -vec3Dot(camUp, eye)
  m[14] = -vec3Dot(negForward, eye)
  m[15] = 1

  return m
}

// --- Extract 6 frustum planes from projView matrix (Gribb/Hartmann) ---

function extractFrustumPlanes(m: Float64Array): FrustumPlane[] {
  // For column-major matrix, "row N" = [m[N], m[N+4], m[N+8], m[N+12]]
  // row0 = m[0], m[4], m[8], m[12]
  // row1 = m[1], m[5], m[9], m[13]
  // row2 = m[2], m[6], m[10], m[14]
  // row3 = m[3], m[7], m[11], m[15]

  const planes: FrustumPlane[] = []

  // Left: row3 + row0
  planes.push(normalizePlane(
    m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12],
  ))
  // Right: row3 - row0
  planes.push(normalizePlane(
    m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12],
  ))
  // Bottom: row3 + row1
  planes.push(normalizePlane(
    m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13],
  ))
  // Top: row3 - row1
  planes.push(normalizePlane(
    m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13],
  ))
  // Near: row3 + row2
  planes.push(normalizePlane(
    m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14],
  ))
  // Far: row3 - row2
  planes.push(normalizePlane(
    m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14],
  ))

  return planes
}

// --- AABB vs Frustum intersection ---

function aabbIntersectsFrustum(
  bboxMin: [number, number, number],
  bboxMax: [number, number, number],
  planes: FrustumPlane[],
): boolean {
  for (const plane of planes) {
    // Find the "positive vertex" -- the corner most in the direction of the plane normal
    const px = plane.nx >= 0 ? bboxMax[0] : bboxMin[0]
    const py = plane.ny >= 0 ? bboxMax[1] : bboxMin[1]
    const pz = plane.nz >= 0 ? bboxMax[2] : bboxMin[2]

    // If the positive vertex is behind the plane, the box is entirely outside
    if (plane.nx * px + plane.ny * py + plane.nz * pz + plane.d < 0) {
      return false
    }
  }
  return true
}

// --- Screen occupancy calculation ---

function computeScreenOccupancy(
  bboxMin: [number, number, number],
  bboxMax: [number, number, number],
  projView: Float64Array,
): number {
  // Generate 8 corners of AABB
  const corners: [number, number, number][] = [
    [bboxMin[0], bboxMin[1], bboxMin[2]],
    [bboxMin[0], bboxMin[1], bboxMax[2]],
    [bboxMin[0], bboxMax[1], bboxMin[2]],
    [bboxMin[0], bboxMax[1], bboxMax[2]],
    [bboxMax[0], bboxMin[1], bboxMin[2]],
    [bboxMax[0], bboxMin[1], bboxMax[2]],
    [bboxMax[0], bboxMax[1], bboxMin[2]],
    [bboxMax[0], bboxMax[1], bboxMax[2]],
  ]

  let ndcMinX = 1, ndcMaxX = -1
  let ndcMinY = 1, ndcMaxY = -1
  let anyInFront = false

  for (const [cx, cy, cz] of corners) {
    const [px, py, pz, pw] = mat4TransformVec4(projView, cx, cy, cz, 1)

    // Skip corners behind camera (w <= 0 means behind in perspective projection)
    if (pw <= 0) continue

    // Perspective divide
    const ndcX = px / pw
    const ndcY = py / pw
    const ndcZ = pz / pw

    // Match THREE.js applyMatrix4 behavior: point is in front when NDC z is in [-1, 1]
    if (ndcZ >= -1 && ndcZ <= 1) {
      anyInFront = true
      ndcMinX = Math.min(ndcMinX, Math.max(ndcX, -1))
      ndcMaxX = Math.max(ndcMaxX, Math.min(ndcX, 1))
      ndcMinY = Math.min(ndcMinY, Math.max(ndcY, -1))
      ndcMaxY = Math.max(ndcMaxY, Math.min(ndcY, 1))
    }
  }

  if (!anyInFront || ndcMaxX <= ndcMinX || ndcMaxY <= ndcMinY) return 0

  // NDC space is -1 to 1 (2x2=4) -> occupancy = projected area / 4
  return ((ndcMaxX - ndcMinX) * (ndcMaxY - ndcMinY)) / 4
}

// --- Main export ---

export function computeVisibleObjects(
  eyePosition: [number, number, number],
  rotationY: number,
  objects: WorldObjectEntry[],
  config?: { fov?: number; near?: number; far?: number; eyeHeight?: number },
): VisibleObject[] {
  const fov = config?.fov ?? 150
  const near = config?.near ?? 0.5
  const far = config?.far ?? 30
  const eyeHeight = config?.eyeHeight ?? 1.5

  const eyeX = eyePosition[0]
  const eyeY = eyePosition[1] + eyeHeight
  const eyeZ = eyePosition[2]

  // Build matrices
  const proj = buildPerspectiveMatrix(fov, near, far)
  const view = buildViewMatrix(eyeX, eyeY, eyeZ, rotationY)
  const projView = mat4Multiply(proj, view)

  // Extract frustum planes
  const planes = extractFrustumPlanes(projView)

  // Test each object
  const results: VisibleObject[] = []

  for (const obj of objects) {
    const bMin = obj.boundingBox.min
    const bMax = obj.boundingBox.max

    if (!aabbIntersectsFrustum(bMin, bMax, planes)) continue

    // Distance from eye to object position
    const dx = eyeX - obj.position[0]
    const dy = eyeY - obj.position[1]
    const dz = eyeZ - obj.position[2]
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

    // Screen occupancy
    const screenOccupancy = computeScreenOccupancy(bMin, bMax, projView)

    results.push({
      id: obj.id,
      type: obj.type,
      position: obj.position,
      distance,
      screenOccupancy,
    })
  }

  // Sort by distance ascending
  results.sort((a, b) => a.distance - b.distance)

  return results
}
