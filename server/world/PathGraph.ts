import { readFileSync, existsSync } from 'node:fs'

// --- Type definitions ---

export type PrimitiveShape =
  | { shape: 'box'; center: [number, number, number]; size: [number, number, number]; rotation: [number, number, number] }
  | { shape: 'sphere'; center: [number, number, number]; radius: number }
  | { shape: 'cylinder'; center: [number, number, number]; radius: number; height: number }

export type PathNodeType = 'point' | 'obstacle' | 'area' | 'reroute'

export interface PathNodeData {
  id: string
  type: PathNodeType
  position: [number, number, number]
  primitives: PrimitiveShape[]
  connections: string[]
}

interface PathGraphFile {
  nodes: PathNodeData[]
}

// --- Priority queue entry for A* ---

interface AStarEntry {
  nodeId: string
  fScore: number
}

// --- Euler rotation helpers ---

/** Convert Euler angles (degrees, Unity convention: Y-X-Z) to rotation matrix columns */
export function eulerToRotationMatrix(rotDeg: [number, number, number]): {
  rx: [number, number, number]
  ry: [number, number, number]
  rz: [number, number, number]
} {
  const toRad = Math.PI / 180
  const [xDeg, yDeg, zDeg] = rotDeg
  const cx = Math.cos(xDeg * toRad), sx = Math.sin(xDeg * toRad)
  const cy = Math.cos(yDeg * toRad), sy = Math.sin(yDeg * toRad)
  const cz = Math.cos(zDeg * toRad), sz = Math.sin(zDeg * toRad)

  // Rotation matrix = Ry * Rx * Rz (Unity convention)
  return {
    rx: [
      cy * cz + sy * sx * sz,
      cx * sz,
      -sy * cz + cy * sx * sz,
    ],
    ry: [
      -cy * sz + sy * sx * cz,
      cx * cz,
      sy * sz + cy * sx * cz,
    ],
    rz: [
      sy * cx,
      -sx,
      cy * cx,
    ],
  }
}

/** Apply inverse rotation (transpose of rotation matrix) to a point */
export function applyInverseRotation(
  point: [number, number, number],
  rot: { rx: [number, number, number]; ry: [number, number, number]; rz: [number, number, number] },
): [number, number, number] {
  // Transpose: columns become rows
  return [
    rot.rx[0] * point[0] + rot.rx[1] * point[1] + rot.rx[2] * point[2],
    rot.ry[0] * point[0] + rot.ry[1] * point[1] + rot.ry[2] * point[2],
    rot.rz[0] * point[0] + rot.rz[1] * point[1] + rot.rz[2] * point[2],
  ]
}

// --- Distance helpers ---

function euclideanDist(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function euclideanDist2D(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dz * dz)
}

// --- Primitive hit-testing (module-level exports) ---

/**
 * OBB (Oriented Bounding Box) hit-test:
 * 1. Translate point relative to box center
 * 2. Apply inverse rotation (rotation is Euler degrees from Unity)
 * 3. Check if |x| < size.x/2 && |y| < size.y/2 && |z| < size.z/2
 */
export function isInsideBox(point: [number, number, number], box: Extract<PrimitiveShape, { shape: 'box' }>): boolean {
  const local: [number, number, number] = [
    point[0] - box.center[0],
    point[1] - box.center[1],
    point[2] - box.center[2],
  ]
  const rot = eulerToRotationMatrix(box.rotation)
  const rotated = applyInverseRotation(local, rot)
  return (
    Math.abs(rotated[0]) < box.size[0] / 2 &&
    Math.abs(rotated[1]) < box.size[1] / 2 &&
    Math.abs(rotated[2]) < box.size[2] / 2
  )
}

export function isInsideSphere(point: [number, number, number], sphere: Extract<PrimitiveShape, { shape: 'sphere' }>): boolean {
  return euclideanDist(point, sphere.center) < sphere.radius
}

export function isInsideCylinder(point: [number, number, number], cyl: Extract<PrimitiveShape, { shape: 'cylinder' }>): boolean {
  const dx = point[0] - cyl.center[0]
  const dy = point[1] - cyl.center[1]
  const dz = point[2] - cyl.center[2]
  const horizontalDist = Math.sqrt(dx * dx + dz * dz)
  return horizontalDist < cyl.radius && Math.abs(dy) < cyl.height / 2
}

export function isInsidePrimitives(pos: [number, number, number], primitives: PrimitiveShape[]): boolean {
  for (const prim of primitives) {
    switch (prim.shape) {
      case 'box':
        if (isInsideBox(pos, prim)) return true
        break
      case 'sphere':
        if (isInsideSphere(pos, prim)) return true
        break
      case 'cylinder':
        if (isInsideCylinder(pos, prim)) return true
        break
    }
  }
  return false
}

// --- PathGraph class ---

export class PathGraph {
  private nodes: Map<string, PathNodeData>

  constructor(data: PathGraphFile) {
    this.nodes = new Map()
    for (const node of data.nodes) {
      this.nodes.set(node.id, node)
    }
  }

  getNode(id: string): PathNodeData | undefined {
    return this.nodes.get(id)
  }

  getAllNodes(): PathNodeData[] {
    return Array.from(this.nodes.values())
  }

  getNeighbors(nodeId: string): PathNodeData[] {
    const node = this.nodes.get(nodeId)
    if (!node) return []
    const neighbors: PathNodeData[] = []
    for (const connId of node.connections) {
      const neighbor = this.nodes.get(connId)
      if (neighbor) neighbors.push(neighbor)
    }
    return neighbors
  }

  findNearestNode(pos: [number, number, number]): PathNodeData | null {
    let nearest: PathNodeData | null = null
    let minDist = Infinity
    for (const node of this.nodes.values()) {
      const dist = euclideanDist2D(pos, node.position)
      if (dist < minDist) {
        minDist = dist
        nearest = node
      }
    }
    return nearest
  }

  /**
   * A* pathfinding - returns array of node IDs from start to goal (inclusive).
   * Returns null if no path exists.
   */
  findPath(fromNodeId: string, toNodeId: string): string[] | null {
    if (fromNodeId === toNodeId) return [fromNodeId]

    const startNode = this.nodes.get(fromNodeId)
    const goalNode = this.nodes.get(toNodeId)
    if (!startNode || !goalNode) return null

    // Open set as sorted array (simple priority queue)
    const openSet: AStarEntry[] = [{ nodeId: fromNodeId, fScore: 0 }]
    const cameFrom = new Map<string, string>()
    const gScore = new Map<string, number>()
    gScore.set(fromNodeId, 0)

    const closedSet = new Set<string>()

    while (openSet.length > 0) {
      // Pop node with lowest fScore
      const current = openSet.shift()!
      const currentId = current.nodeId

      if (currentId === toNodeId) {
        // Reconstruct path
        const path: string[] = [currentId]
        let step = currentId
        while (cameFrom.has(step)) {
          step = cameFrom.get(step)!
          path.unshift(step)
        }
        return path
      }

      closedSet.add(currentId)

      const currentNode = this.nodes.get(currentId)!
      const currentG = gScore.get(currentId)!

      for (const neighborId of currentNode.connections) {
        if (closedSet.has(neighborId)) continue

        const neighborNode = this.nodes.get(neighborId)
        if (!neighborNode) continue

        const edgeCost = euclideanDist(currentNode.position, neighborNode.position)
        const tentativeG = currentG + edgeCost

        const prevG = gScore.get(neighborId)
        if (prevG !== undefined && tentativeG >= prevG) continue

        // This path is better
        cameFrom.set(neighborId, currentId)
        gScore.set(neighborId, tentativeG)

        const h = euclideanDist(neighborNode.position, goalNode.position)
        const fScore = tentativeG + h

        // Insert into open set maintaining sort order
        const existingIdx = openSet.findIndex((e) => e.nodeId === neighborId)
        if (existingIdx !== -1) {
          openSet.splice(existingIdx, 1)
        }

        // Binary insert for sorted order
        let insertIdx = 0
        while (insertIdx < openSet.length && openSet[insertIdx].fScore < fScore) {
          insertIdx++
        }
        openSet.splice(insertIdx, 0, { nodeId: neighborId, fScore })
      }
    }

    return null // No path found
  }

  /**
   * Arrival detection based on node type:
   * - point: distance to position < 0.5
   * - obstacle: distanceToPrimitives < 0.5 (outside but close)
   * - area: isInsidePrimitives returns true
   */
  hasArrived(pos: [number, number, number], nodeId: string): boolean {
    const node = this.nodes.get(nodeId)
    if (!node) return false

    switch (node.type) {
      case 'point':
      case 'reroute':
        return euclideanDist2D(pos, node.position) < 0.5

      case 'obstacle':
        if (node.primitives.length === 0) {
          return euclideanDist2D(pos, node.position) < 0.5
        }
        return this.distanceToPrimitives(pos, node.primitives) < 0.5

      case 'area':
        if (node.primitives.length === 0) {
          return euclideanDist2D(pos, node.position) < 0.5
        }
        return this.isInsidePrimitives(pos, node.primitives)

      default:
        return euclideanDist2D(pos, node.position) < 0.5
    }
  }

  /**
   * For obstacle nodes: compute approach point outside the boundary.
   * Returns a point on the primitive boundary + 0.5m offset toward the spirit.
   */
  getApproachPoint(fromPos: [number, number, number], nodeId: string): [number, number, number] {
    const node = this.nodes.get(nodeId)
    if (!node) return fromPos

    const center = node.position
    const dx = fromPos[0] - center[0]
    const dz = fromPos[2] - center[2]
    const dist2D = Math.sqrt(dx * dx + dz * dz)

    if (dist2D < 0.01) {
      // Spirit is at the center; pick an arbitrary direction
      return [center[0] + 0.5, center[1], center[2]]
    }

    const dirX = dx / dist2D
    const dirZ = dz / dist2D

    if (node.primitives.length === 0) {
      // No primitives; approach to 0.5m from center
      return [center[0] + dirX * 0.5, center[1], center[2] + dirZ * 0.5]
    }

    // Find the distance from center to boundary along the direction toward the spirit
    // Walk from center outward until we leave the primitives
    const step = 0.1
    let probeDistance = 0
    for (let d = 0; d < 50; d += step) {
      const probeX = center[0] + dirX * d
      const probeZ = center[2] + dirZ * d
      const probePos: [number, number, number] = [probeX, center[1], probeZ]
      if (!this.isInsidePrimitives(probePos, node.primitives)) {
        probeDistance = d
        break
      }
      probeDistance = d
    }

    // Return point at boundary + 0.5m offset
    const approachDist = probeDistance + 0.5
    return [
      center[0] + dirX * approachDist,
      center[1],
      center[2] + dirZ * approachDist,
    ]
  }

  /**
   * Get non-point nodes within radius, sorted by distance.
   */
  getNearbyNodes(pos: [number, number, number], radius: number): { id: string; type: PathNodeType; distance: number }[] {
    const results: { id: string; type: PathNodeType; distance: number }[] = []

    for (const node of this.nodes.values()) {
      // Skip point and reroute nodes (internal waypoints)
      if (node.type === 'point' || node.type === 'reroute') continue

      const dist = euclideanDist2D(pos, node.position)
      if (dist <= radius) {
        results.push({
          id: node.id,
          type: node.type,
          distance: Math.round(dist * 10) / 10,
        })
      }
    }

    results.sort((a, b) => a.distance - b.distance)
    return results
  }

  // --- Primitive hit-testing helpers (delegating to module-level functions) ---

  private isInsidePrimitives(pos: [number, number, number], primitives: PrimitiveShape[]): boolean {
    return isInsidePrimitives(pos, primitives)
  }

  private distanceToPrimitives(pos: [number, number, number], primitives: PrimitiveShape[]): number {
    let minDist = Infinity
    for (const prim of primitives) {
      let d: number
      switch (prim.shape) {
        case 'box':
          d = this.distanceToBox(pos, prim)
          break
        case 'sphere':
          d = this.distanceToSphere(pos, prim)
          break
        case 'cylinder':
          d = this.distanceToCylinder(pos, prim)
          break
      }
      minDist = Math.min(minDist, d)
    }
    return minDist
  }

  /**
   * Signed distance to OBB surface (negative = inside, positive = outside).
   */
  private distanceToBox(point: [number, number, number], box: Extract<PrimitiveShape, { shape: 'box' }>): number {
    const local: [number, number, number] = [
      point[0] - box.center[0],
      point[1] - box.center[1],
      point[2] - box.center[2],
    ]

    const rot = eulerToRotationMatrix(box.rotation)
    const rotated = applyInverseRotation(local, rot)

    const halfX = box.size[0] / 2
    const halfY = box.size[1] / 2
    const halfZ = box.size[2] / 2

    // Distance from each axis to the nearest face (negative = inside)
    const dx = Math.abs(rotated[0]) - halfX
    const dy = Math.abs(rotated[1]) - halfY
    const dz = Math.abs(rotated[2]) - halfZ

    if (dx <= 0 && dy <= 0 && dz <= 0) {
      // Inside: return negative of the minimum penetration
      return Math.max(dx, dy, dz)
    }

    // Outside: Euclidean distance to nearest point on surface
    const cx = Math.max(dx, 0)
    const cy = Math.max(dy, 0)
    const cz = Math.max(dz, 0)
    return Math.sqrt(cx * cx + cy * cy + cz * cz)
  }

  private distanceToSphere(point: [number, number, number], sphere: Extract<PrimitiveShape, { shape: 'sphere' }>): number {
    return euclideanDist(point, sphere.center) - sphere.radius
  }

  private distanceToCylinder(point: [number, number, number], cyl: Extract<PrimitiveShape, { shape: 'cylinder' }>): number {
    const dx = point[0] - cyl.center[0]
    const dy = point[1] - cyl.center[1]
    const dz = point[2] - cyl.center[2]

    const horizontalDist = Math.sqrt(dx * dx + dz * dz)
    const radialDiff = horizontalDist - cyl.radius
    const verticalDiff = Math.abs(dy) - cyl.height / 2

    if (radialDiff <= 0 && verticalDiff <= 0) {
      // Inside: return negative of minimum penetration
      return Math.max(radialDiff, verticalDiff)
    }

    // Outside
    const cr = Math.max(radialDiff, 0)
    const cv = Math.max(verticalDiff, 0)
    return Math.sqrt(cr * cr + cv * cv)
  }
}

// --- Loader function ---

export function loadPathGraph(jsonPath: string): PathGraph | null {
  if (!existsSync(jsonPath)) return null
  const raw = readFileSync(jsonPath, 'utf-8')
  const data: PathGraphFile = JSON.parse(raw)
  return new PathGraph(data)
}
