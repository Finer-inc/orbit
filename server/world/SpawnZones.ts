import { readFileSync, existsSync } from 'node:fs'
import type { PrimitiveShape } from './PathGraph.ts'
import { isInsidePrimitives } from './PathGraph.ts'

export interface SpawnZoneData {
  id: string
  position: [number, number, number]
  primitives: PrimitiveShape[]
}

interface SpawnZonesFile {
  zones: SpawnZoneData[]
}

export class SpawnZones {
  private zones: SpawnZoneData[]

  constructor(data: SpawnZonesFile) {
    this.zones = data.zones
  }

  getAllZones(): SpawnZoneData[] {
    return this.zones
  }

  /**
   * Pick a random zone, then rejection-sample a point inside its primitives.
   * Returns world-space [x, y, z] or null if no zones.
   */
  getRandomSpawnPoint(): [number, number, number] | null {
    if (this.zones.length === 0) return null

    // Random zone selection
    const zone = this.zones[Math.floor(Math.random() * this.zones.length)]

    if (zone.primitives.length === 0) {
      return [...zone.position] as [number, number, number]
    }

    // Compute AABB of all primitives for rejection sampling bounds
    // Primitives are in zone-local space, so we need to add zone.position
    const aabb = this.computeAABB(zone.primitives)

    // Rejection sampling: random point in AABB, check if inside any primitive
    for (let attempt = 0; attempt < 100; attempt++) {
      const localX = aabb.minX + Math.random() * (aabb.maxX - aabb.minX)
      const localY = aabb.minY + Math.random() * (aabb.maxY - aabb.minY)
      const localZ = aabb.minZ + Math.random() * (aabb.maxZ - aabb.minZ)

      const localPoint: [number, number, number] = [localX, localY, localZ]

      if (isInsidePrimitives(localPoint, zone.primitives)) {
        return [
          zone.position[0] + localX,
          zone.position[1] + localY,
          zone.position[2] + localZ,
        ]
      }
    }

    // Fallback: zone center
    return [...zone.position] as [number, number, number]
  }

  private computeAABB(primitives: PrimitiveShape[]): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } {
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity

    for (const prim of primitives) {
      switch (prim.shape) {
        case 'box': {
          // For OBB, use half-diag as conservative AABB
          const halfDiag = Math.sqrt(
            (prim.size[0] / 2) ** 2 + (prim.size[1] / 2) ** 2 + (prim.size[2] / 2) ** 2
          )
          minX = Math.min(minX, prim.center[0] - halfDiag)
          maxX = Math.max(maxX, prim.center[0] + halfDiag)
          minY = Math.min(minY, prim.center[1] - halfDiag)
          maxY = Math.max(maxY, prim.center[1] + halfDiag)
          minZ = Math.min(minZ, prim.center[2] - halfDiag)
          maxZ = Math.max(maxZ, prim.center[2] + halfDiag)
          break
        }
        case 'sphere': {
          minX = Math.min(minX, prim.center[0] - prim.radius)
          maxX = Math.max(maxX, prim.center[0] + prim.radius)
          minY = Math.min(minY, prim.center[1] - prim.radius)
          maxY = Math.max(maxY, prim.center[1] + prim.radius)
          minZ = Math.min(minZ, prim.center[2] - prim.radius)
          maxZ = Math.max(maxZ, prim.center[2] + prim.radius)
          break
        }
        case 'cylinder': {
          minX = Math.min(minX, prim.center[0] - prim.radius)
          maxX = Math.max(maxX, prim.center[0] + prim.radius)
          minY = Math.min(minY, prim.center[1] - prim.height / 2)
          maxY = Math.max(maxY, prim.center[1] + prim.height / 2)
          minZ = Math.min(minZ, prim.center[2] - prim.radius)
          maxZ = Math.max(maxZ, prim.center[2] + prim.radius)
          break
        }
      }
    }

    return { minX, maxX, minY, maxY, minZ, maxZ }
  }
}

export function loadSpawnZones(jsonPath: string): SpawnZones | null {
  if (!existsSync(jsonPath)) return null
  const raw = readFileSync(jsonPath, 'utf-8')
  const data: SpawnZonesFile = JSON.parse(raw)
  return new SpawnZones(data)
}
