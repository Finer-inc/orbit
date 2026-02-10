import type {
  SpiritState,
  ObservationResult,
  NearbySpiritInfo,
  VisibleObject,
  WorldObjectEntry,
  TimeOfDay,
} from '../../src/types/world.ts'
import { WorldClock } from './WorldClock.ts'
import { createWorldMap } from './WorldMap.ts'
import type { WorldMapData } from './WorldMap.ts'
import { computeVisibleObjects } from './vision.ts'

export class WorldServer {
  private clock: WorldClock
  private map: WorldMapData
  private spirits: Map<string, SpiritState>

  constructor() {
    this.clock = new WorldClock()
    this.map = createWorldMap()
    this.spirits = new Map()
  }

  // --- Time ---

  getTimeOfDay(): TimeOfDay {
    return this.clock.getTimeOfDay()
  }

  getHour(): number {
    return this.clock.getHour()
  }

  // --- Spirit management ---

  registerSpirit(
    id: string,
    name: string,
    position: [number, number, number],
  ): SpiritState {
    const state: SpiritState = {
      id,
      name,
      position,
      rotationY: 0,
      currentAction: null,
      lastThinkAt: Date.now(),
    }
    this.spirits.set(id, state)
    return state
  }

  unregisterSpirit(id: string): void {
    this.spirits.delete(id)
  }

  getSpiritState(id: string): SpiritState | undefined {
    return this.spirits.get(id)
  }

  getAllSpirits(): SpiritState[] {
    return Array.from(this.spirits.values())
  }

  // --- Spirit actions ---

  moveSpirit(
    spiritId: string,
    targetX: number,
    targetZ: number,
  ): { success: boolean; newPosition: [number, number, number]; newRotation: number } {
    const spirit = this.spirits.get(spiritId)
    if (!spirit) {
      return { success: false, newPosition: [0, 0, 0], newRotation: 0 }
    }

    const dx = targetX - spirit.position[0]
    const dz = targetZ - spirit.position[2]

    // Calculate rotation: atan2(dx, dz) matches THREE.js convention where 0 = +Z direction
    const newRotation = Math.atan2(dx, dz)

    const newPosition: [number, number, number] = [targetX, spirit.position[1], targetZ]

    spirit.position = newPosition
    spirit.rotationY = newRotation
    spirit.lastThinkAt = Date.now()

    return { success: true, newPosition, newRotation }
  }

  observe(spiritId: string): ObservationResult {
    const spirit = this.spirits.get(spiritId)
    if (!spirit) {
      return { objects: [], spirits: [], timeOfDay: this.getTimeOfDay() }
    }

    // 1. Compute visible objects using frustum-based vision
    const objects: VisibleObject[] = computeVisibleObjects(
      spirit.position,
      spirit.rotationY,
      this.map.objects,
    )

    // 2. Find nearby spirits within sensing radius (15 units)
    //    Spirits can "sense" other spirits nearby -- simpler distance check, no frustum needed
    const nearbyRadius = 15
    const spirits: NearbySpiritInfo[] = this.getNearbySpirits(spiritId, nearbyRadius)

    // 3. Return combined observation
    return {
      objects,
      spirits,
      timeOfDay: this.getTimeOfDay(),
    }
  }

  getNearbySpirits(spiritId: string, radius: number = 5): NearbySpiritInfo[] {
    const spirit = this.spirits.get(spiritId)
    if (!spirit) {
      return []
    }

    const results: NearbySpiritInfo[] = []

    for (const other of this.spirits.values()) {
      // Exclude self
      if (other.id === spiritId) continue

      const dx = other.position[0] - spirit.position[0]
      const dy = other.position[1] - spirit.position[1]
      const dz = other.position[2] - spirit.position[2]
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

      if (distance <= radius) {
        results.push({
          id: other.id,
          name: other.name,
          distance,
          position: other.position,
        })
      }
    }

    // Sort by distance ascending
    results.sort((a, b) => a.distance - b.distance)

    return results
  }

  // --- World objects ---

  getAllObjects(): WorldObjectEntry[] {
    return this.map.objects
  }

  getObjectById(id: string): WorldObjectEntry | undefined {
    return this.map.objects.find((obj) => obj.id === id)
  }
}
