import type {
  SpiritState,
  SpiritBehaviorState,
  ObservationResult,
  NearbySpiritInfo,
  VisibleObject,
  WorldObjectEntry,
  TimeOfDay,
  SpatialMessage,
  HeardVoice,
  Volume,
} from '../../src/types/world.ts'
import { VOLUME_RANGE } from '../../src/types/world.ts'
import { getTerrainHeight } from '../../src/utils/terrainHeight.ts'
import { WorldClock } from './WorldClock.ts'
import { createWorldMap } from './WorldMap.ts'
import type { WorldMapData, BedInfo } from './WorldMap.ts'
import { computeVisibleObjects } from './vision.ts'

// Stamina: 2/分 base recovery (per ms)
const STAMINA_RECOVERY_PER_MS = 2 / 60_000
const RESTING_RECOVERY_MULTIPLIER = 2.0

// Default Lv1 stats
const DEFAULT_MAX_STAMINA = 200
const DEFAULT_MAX_MENTAL_ENERGY = 100

export class WorldServer {
  private clock: WorldClock
  private map: WorldMapData
  private spirits: Map<string, SpiritState>
  private spatialMessages: SpatialMessage[]
  private lastObserveAt: Map<string, number>

  constructor() {
    this.clock = new WorldClock()
    this.map = createWorldMap()
    this.spirits = new Map()
    this.spatialMessages = []
    this.lastObserveAt = new Map()
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
    color: string = '#e8b88a',
  ): SpiritState {
    const now = Date.now()
    const groundedPosition: [number, number, number] = [
      position[0],
      getTerrainHeight(position[0], position[2]),
      position[2],
    ]
    const state: SpiritState = {
      id,
      name,
      position: groundedPosition,
      rotationY: 0,
      currentAction: null,
      lastThinkAt: now,
      color,
      state: 'idle',
      stamina: DEFAULT_MAX_STAMINA,
      maxStamina: DEFAULT_MAX_STAMINA,
      staminaUpdatedAt: now,
      mentalEnergy: DEFAULT_MAX_MENTAL_ENERGY,
      maxMentalEnergy: DEFAULT_MAX_MENTAL_ENERGY,
    }
    this.spirits.set(id, state)
    return state
  }

  unregisterSpirit(id: string): void {
    this.spirits.delete(id)
  }

  getSpiritState(id: string): SpiritState | undefined {
    const spirit = this.spirits.get(id)
    if (spirit) {
      spirit.stamina = this.getEffectiveStamina(spirit)
    }
    return spirit
  }

  getAllSpirits(): SpiritState[] {
    // Apply lazy stamina recovery for accurate display
    const spirits = Array.from(this.spirits.values())
    for (const spirit of spirits) {
      spirit.stamina = this.getEffectiveStamina(spirit)
    }
    return spirits
  }

  // --- Behavior system ---

  private getEffectiveStamina(spirit: SpiritState): number {
    const elapsed = Date.now() - spirit.staminaUpdatedAt
    const multiplier = spirit.state === 'resting' ? RESTING_RECOVERY_MULTIPLIER : 1.0
    const recovered = elapsed * STAMINA_RECOVERY_PER_MS * multiplier
    return Math.min(spirit.maxStamina, spirit.stamina + recovered)
  }

  private applyStaminaRecovery(spirit: SpiritState): void {
    spirit.stamina = this.getEffectiveStamina(spirit)
    spirit.staminaUpdatedAt = Date.now()
  }

  updateSpiritBehavior(
    id: string,
    update: { state?: SpiritBehaviorState; goal?: string; subgoal?: string },
  ): SpiritState | undefined {
    const spirit = this.spirits.get(id)
    if (!spirit) return undefined
    if (update.state !== undefined) spirit.state = update.state
    if (update.goal !== undefined) spirit.goal = update.goal
    if (update.subgoal !== undefined) spirit.subgoal = update.subgoal
    return spirit
  }

  updateSpiritEnergy(
    id: string,
    mentalEnergy: number,
    maxMentalEnergy: number,
  ): SpiritState | undefined {
    const spirit = this.spirits.get(id)
    if (!spirit) return undefined
    spirit.mentalEnergy = mentalEnergy
    spirit.maxMentalEnergy = maxMentalEnergy
    return spirit
  }

  // --- Beds ---

  getBeds(): BedInfo[] {
    return this.map.beds
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

    const MIN_SPIRIT_DISTANCE = 1.5
    const SPIRIT_RADIUS = 0.4 // character half-width
    const MAX_MOVE_DISTANCE = 5.0

    let finalX = targetX
    let finalZ = targetZ

    // 0. 1回の移動上限: 5m
    const moveDx = finalX - spirit.position[0]
    const moveDz = finalZ - spirit.position[2]
    const requestedDist = Math.sqrt(moveDx * moveDx + moveDz * moveDz)
    if (requestedDist > MAX_MOVE_DISTANCE) {
      const scale = MAX_MOVE_DISTANCE / requestedDist
      finalX = spirit.position[0] + moveDx * scale
      finalZ = spirit.position[2] + moveDz * scale
    }

    // 1. Clamp to world bounds
    const { bounds } = this.map
    finalX = Math.max(bounds.minX + SPIRIT_RADIUS, Math.min(bounds.maxX - SPIRIT_RADIUS, finalX))
    finalZ = Math.max(bounds.minZ + SPIRIT_RADIUS, Math.min(bounds.maxZ - SPIRIT_RADIUS, finalZ))

    // 2. Object collision: push out of bounding boxes (家はスキップ — 精霊は家に入れる)
    for (const obj of this.map.objects) {
      if (obj.type === 'house') continue
      const bb = obj.boundingBox
      // Check if finalX/Z is inside the XZ footprint of the bounding box (with spirit radius padding)
      const padMinX = bb.min[0] - SPIRIT_RADIUS
      const padMaxX = bb.max[0] + SPIRIT_RADIUS
      const padMinZ = bb.min[2] - SPIRIT_RADIUS
      const padMaxZ = bb.max[2] + SPIRIT_RADIUS
      if (finalX > padMinX && finalX < padMaxX && finalZ > padMinZ && finalZ < padMaxZ) {
        // Push to nearest edge
        const dLeft = finalX - padMinX
        const dRight = padMaxX - finalX
        const dFront = finalZ - padMinZ
        const dBack = padMaxZ - finalZ
        const minD = Math.min(dLeft, dRight, dFront, dBack)
        if (minD === dLeft) finalX = padMinX
        else if (minD === dRight) finalX = padMaxX
        else if (minD === dFront) finalZ = padMinZ
        else finalZ = padMaxZ
      }
    }

    // 3. Spirit collision: stop short if another spirit is near the destination
    for (const other of this.spirits.values()) {
      if (other.id === spiritId) continue
      const sdx = finalX - other.position[0]
      const sdz = finalZ - other.position[2]
      const dist = Math.sqrt(sdx * sdx + sdz * sdz)
      if (dist < MIN_SPIRIT_DISTANCE) {
        // Push back along the movement direction
        if (dist > 0.01) {
          // Move to exactly MIN_SPIRIT_DISTANCE from the other spirit
          const scale = MIN_SPIRIT_DISTANCE / dist
          finalX = other.position[0] + sdx * scale
          finalZ = other.position[2] + sdz * scale
        } else {
          // Nearly overlapping: nudge away from original position
          finalX = spirit.position[0]
          finalZ = spirit.position[2]
        }
      }
    }

    const dx = finalX - spirit.position[0]
    const dz = finalZ - spirit.position[2]
    const moveDistance = Math.sqrt(dx * dx + dz * dz)

    // Stamina consumption: distance × 1.0
    this.applyStaminaRecovery(spirit)
    spirit.stamina = Math.max(0, spirit.stamina - moveDistance)
    spirit.staminaUpdatedAt = Date.now()

    // Calculate rotation: atan2(dx, dz) matches THREE.js convention where 0 = +Z direction
    const newRotation = Math.atan2(dx, dz)

    const newPosition: [number, number, number] = [
      finalX,
      getTerrainHeight(finalX, finalZ),
      finalZ,
    ]

    spirit.position = newPosition
    spirit.rotationY = newRotation
    spirit.lastThinkAt = Date.now()

    return { success: true, newPosition, newRotation }
  }

  lookAt(
    spiritId: string,
    targetX: number,
    targetZ: number,
  ): { success: boolean; newRotation: number } {
    const spirit = this.spirits.get(spiritId)
    if (!spirit) {
      return { success: false, newRotation: 0 }
    }

    const dx = targetX - spirit.position[0]
    const dz = targetZ - spirit.position[2]
    const newRotation = Math.atan2(dx, dz)

    spirit.rotationY = newRotation
    return { success: true, newRotation }
  }

  observe(spiritId: string): ObservationResult {
    const spirit = this.spirits.get(spiritId)
    if (!spirit) {
      return { objects: [], spirits: [], timeOfDay: this.getTimeOfDay(), voices: [] }
    }

    // 1. Compute visible objects using frustum-based vision
    const objects: VisibleObject[] = computeVisibleObjects(
      spirit.position,
      spirit.rotationY,
      this.map.objects,
    )

    // 2. Find visible spirits within FOV (same 90° as objects, 15 unit radius)
    const spirits: NearbySpiritInfo[] = this.getVisibleSpirits(spiritId)

    // 3. Get heard voices (spatial broadcast)
    const voices = this.getHeardVoices(spiritId)

    // 4. Return combined observation
    return {
      objects,
      spirits,
      timeOfDay: this.getTimeOfDay(),
      voices,
    }
  }

  getVisibleSpirits(spiritId: string, radius: number = 15, fovDeg: number = 150): NearbySpiritInfo[] {
    const spirit = this.spirits.get(spiritId)
    if (!spirit) {
      return []
    }

    const halfFov = (fovDeg / 2) * Math.PI / 180
    // Forward direction from rotationY (THREE.js convention: 0 = +Z)
    const forwardX = Math.sin(spirit.rotationY)
    const forwardZ = Math.cos(spirit.rotationY)

    const results: NearbySpiritInfo[] = []

    for (const other of this.spirits.values()) {
      if (other.id === spiritId) continue

      const dx = other.position[0] - spirit.position[0]
      const dz = other.position[2] - spirit.position[2]
      const distance = Math.sqrt(dx * dx + dz * dz)

      if (distance > radius || distance < 0.01) continue

      // Angle between forward direction and direction to other spirit
      const dirX = dx / distance
      const dirZ = dz / distance
      const dot = forwardX * dirX + forwardZ * dirZ
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)))

      if (angle <= halfFov) {
        results.push({
          id: other.id,
          name: other.name,
          distance: Math.round(distance * 10) / 10,
          position: other.position,
        })
      }
    }

    results.sort((a, b) => a.distance - b.distance)
    return results
  }

  // --- Spatial communication ---

  say(
    fromId: string,
    message: string,
    volume: Volume,
    toId?: string,
  ): { success: boolean; hearers: number; error?: string } {
    const from = this.spirits.get(fromId)
    if (!from) return { success: false, hearers: 0, error: 'speaker not found' }

    let toName: string | undefined
    if (toId) {
      const toSpirit = this.spirits.get(toId)
      if (toSpirit) toName = toSpirit.name
    }

    // Stamina consumption for speaking
    const sayCost = volume === 'shout' ? 3 : volume === 'normal' ? 1 : 0
    if (sayCost > 0) {
      this.applyStaminaRecovery(from)
      from.stamina = Math.max(0, from.stamina - sayCost)
      from.staminaUpdatedAt = Date.now()
    }

    // Update speaker's lastSpeech for frontend display
    from.lastSpeech = message
    from.lastSpeechAt = Date.now()
    from.lastSpeechVolume = volume

    const msg: SpatialMessage = {
      from: from.name,
      fromId,
      to: toId,
      toName,
      message,
      volume,
      position: [...from.position],
      timestamp: Date.now(),
    }
    this.spatialMessages.push(msg)

    // Clean up old messages (> 5 minutes)
    const cutoff = Date.now() - 5 * 60 * 1000
    this.spatialMessages = this.spatialMessages.filter((m) => m.timestamp > cutoff)

    // Count how many spirits can hear this right now
    const range = VOLUME_RANGE[volume]
    let hearers = 0
    for (const spirit of this.spirits.values()) {
      if (spirit.id === fromId) continue
      const dx = spirit.position[0] - msg.position[0]
      const dy = spirit.position[1] - msg.position[1]
      const dz = spirit.position[2] - msg.position[2]
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (dist <= range) hearers++
    }

    return { success: true, hearers }
  }

  private getHeardVoices(spiritId: string): HeardVoice[] {
    const spirit = this.spirits.get(spiritId)
    if (!spirit) return []

    const since = this.lastObserveAt.get(spiritId) ?? 0
    this.lastObserveAt.set(spiritId, Date.now())

    const voices: HeardVoice[] = []
    for (const msg of this.spatialMessages) {
      // Skip own messages
      if (msg.fromId === spiritId) continue
      // Only messages since last observe
      if (msg.timestamp <= since) continue
      // Distance check
      const dx = spirit.position[0] - msg.position[0]
      const dy = spirit.position[1] - msg.position[1]
      const dz = spirit.position[2] - msg.position[2]
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const range = VOLUME_RANGE[msg.volume]
      if (dist > range) continue

      voices.push({
        from: msg.from,
        fromId: msg.fromId,
        to: msg.to,
        toName: msg.toName,
        message: msg.message,
        volume: msg.volume,
        distance: Math.round(dist * 10) / 10,
      })
    }

    return voices
  }

  // --- World objects ---

  getAllObjects(): WorldObjectEntry[] {
    return this.map.objects
  }

  getObjectById(id: string): WorldObjectEntry | undefined {
    return this.map.objects.find((obj) => obj.id === id)
  }
}
