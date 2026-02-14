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
import { WorldClock } from './WorldClock.ts'
import type { WorldMapData, BedInfo } from './WorldMap.ts'
import { computeVisibleObjects } from './vision.ts'

// Stamina: 2/分 base recovery (per ms)
const STAMINA_RECOVERY_PER_MS = 2 / 60_000
const RESTING_RECOVERY_MULTIPLIER = 2.0

// Default Lv1 stats
const DEFAULT_MAX_STAMINA = 200
const DEFAULT_MAX_MENTAL_ENERGY = 100

// Continuous movement
const MOVE_TICK_MS = 200
const DEFAULT_MOVE_SPEED = 2.0
const ARRIVAL_THRESHOLD = 0.3
const SPIRIT_RADIUS = 0.4
const MIN_SPIRIT_DISTANCE = 1.5

export class WorldServer {
  private clock: WorldClock
  private map: WorldMapData
  private spirits: Map<string, SpiritState>
  private spatialMessages: SpatialMessage[]
  private lastObserveAt: Map<string, number>
  private movementTickId: ReturnType<typeof setInterval> | null = null

  constructor(map: WorldMapData) {
    this.clock = new WorldClock()
    this.map = map
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

  getTimeScale(): number {
    return this.clock.getTimeScale()
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
      this.map.heightMap.getHeight(position[0], position[2]),
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
      movingTo: null,
      moveSpeed: DEFAULT_MOVE_SPEED,
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

  // --- Collision helpers ---

  /** Clamp position to world bounds */
  private clampToBounds(x: number, z: number): [number, number] {
    const { bounds } = this.map
    return [
      Math.max(bounds.minX + SPIRIT_RADIUS, Math.min(bounds.maxX - SPIRIT_RADIUS, x)),
      Math.max(bounds.minZ + SPIRIT_RADIUS, Math.min(bounds.maxZ - SPIRIT_RADIUS, z)),
    ]
  }

  /** Check if position is inside any non-house object AABB. Returns the colliding object or null. */
  private findObjectCollision(x: number, z: number): WorldObjectEntry | null {
    for (const obj of this.map.objects) {
      if (obj.type === 'house') continue
      const bb = obj.boundingBox
      const padMinX = bb.min[0] - SPIRIT_RADIUS
      const padMaxX = bb.max[0] + SPIRIT_RADIUS
      const padMinZ = bb.min[2] - SPIRIT_RADIUS
      const padMaxZ = bb.max[2] + SPIRIT_RADIUS
      if (x > padMinX && x < padMaxX && z > padMinZ && z < padMaxZ) {
        return obj
      }
    }
    return null
  }

  /** Check if position is too close to another spirit. Returns true if blocked. */
  private checkSpiritCollision(spiritId: string, x: number, z: number): boolean {
    for (const other of this.spirits.values()) {
      if (other.id === spiritId) continue
      const sdx = x - other.position[0]
      const sdz = z - other.position[2]
      const dist = Math.sqrt(sdx * sdx + sdz * sdz)
      if (dist < MIN_SPIRIT_DISTANCE) return true
    }
    return false
  }

  // --- Continuous movement (tick-based) ---

  startMovementTick(): void {
    if (this.movementTickId) return
    this.movementTickId = setInterval(() => {
      this.processMovementTick()
    }, MOVE_TICK_MS)
  }

  stopMovementTick(): void {
    if (this.movementTickId) {
      clearInterval(this.movementTickId)
      this.movementTickId = null
    }
  }

  walkTo(
    spiritId: string,
    targetX: number,
    targetZ: number,
  ): { success: boolean; movingTo: [number, number] | null } {
    const spirit = this.spirits.get(spiritId)
    if (!spirit) return { success: false, movingTo: null }

    spirit.movingTo = [targetX, targetZ]

    // Face target immediately
    const dx = targetX - spirit.position[0]
    const dz = targetZ - spirit.position[2]
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      spirit.rotationY = Math.atan2(dx, dz)
    }

    return { success: true, movingTo: spirit.movingTo }
  }

  stopWalking(spiritId: string): { success: boolean; position: [number, number, number] } {
    const spirit = this.spirits.get(spiritId)
    if (!spirit) return { success: false, position: [0, 0, 0] }

    spirit.movingTo = null
    return { success: true, position: spirit.position }
  }

  private processMovementTick(): void {
    const dt = MOVE_TICK_MS / 1000

    for (const spirit of this.spirits.values()) {
      if (!spirit.movingTo) continue

      const [targetX, targetZ] = spirit.movingTo
      const speed = spirit.moveSpeed ?? DEFAULT_MOVE_SPEED
      const stepDistance = speed * dt

      const dx = targetX - spirit.position[0]
      const dz = targetZ - spirit.position[2]
      const remainingDist = Math.sqrt(dx * dx + dz * dz)

      // Arrival
      if (remainingDist <= ARRIVAL_THRESHOLD) {
        spirit.movingTo = null
        continue
      }

      // Direction & step
      const dirX = dx / remainingDist
      const dirZ = dz / remainingDist
      const actualStep = Math.min(stepDistance, remainingDist)
      let nextX = spirit.position[0] + dirX * actualStep
      let nextZ = spirit.position[2] + dirZ * actualStep

      // 1. World bounds
      ;[nextX, nextZ] = this.clampToBounds(nextX, nextZ)

      // 2. Object collision → wall sliding
      const colObj = this.findObjectCollision(nextX, nextZ)
      if (colObj) {
        // Wall sliding: project movement along the AABB face
        const slid = this.wallSlide(spirit, dirX, dirZ, actualStep, colObj)
        if (slid) {
          ;[nextX, nextZ] = slid
          // Re-check bounds after sliding
          ;[nextX, nextZ] = this.clampToBounds(nextX, nextZ)
          // If still colliding after slide, stop
          if (this.findObjectCollision(nextX, nextZ)) {
            spirit.movingTo = null
            continue
          }
        } else {
          spirit.movingTo = null
          continue
        }
      }

      // 3. Spirit collision → stop
      if (this.checkSpiritCollision(spirit.id, nextX, nextZ)) {
        spirit.movingTo = null
        continue
      }

      // 4. Stamina
      this.applyStaminaRecovery(spirit)
      spirit.stamina = Math.max(0, spirit.stamina - actualStep)
      spirit.staminaUpdatedAt = Date.now()
      if (spirit.stamina <= 0) {
        spirit.movingTo = null
      }

      // 5. Height
      const newY = this.map.heightMap.getHeight(nextX, nextZ, spirit.position[1])

      // 6. Update
      spirit.rotationY = Math.atan2(dirX, dirZ)
      spirit.position = [nextX, newY, nextZ]
    }
  }

  /**
   * Wall sliding: when movement hits an AABB, project the movement vector
   * onto the AABB surface normal to slide along it.
   * Returns new [x, z] after sliding, or null if sliding impossible.
   */
  private wallSlide(
    spirit: SpiritState,
    dirX: number,
    dirZ: number,
    step: number,
    obj: WorldObjectEntry,
  ): [number, number] | null {
    const bb = obj.boundingBox
    const padMinX = bb.min[0] - SPIRIT_RADIUS
    const padMaxX = bb.max[0] + SPIRIT_RADIUS
    const padMinZ = bb.min[2] - SPIRIT_RADIUS
    const padMaxZ = bb.max[2] + SPIRIT_RADIUS

    const sx = spirit.position[0]
    const sz = spirit.position[2]

    // Determine which face we're hitting by checking which axis we crossed
    // from the spirit's current (outside) position
    let slideX = sx + dirX * step
    let slideZ = sz + dirZ * step

    // Check which axis to zero out (slide along the perpendicular)
    const insideX = sx > padMinX && sx < padMaxX
    const insideZ = sz > padMinZ && sz < padMaxZ

    if (!insideX && insideZ) {
      // Approaching from X side: zero X component, keep Z
      slideX = sx
      slideZ = sz + dirZ * step
    } else if (insideX && !insideZ) {
      // Approaching from Z side: zero Z component, keep X
      slideX = sx + dirX * step
      slideZ = sz
    } else if (!insideX && !insideZ) {
      // Coming from corner: zero the dominant component
      if (Math.abs(dirX) > Math.abs(dirZ)) {
        slideX = sx
        slideZ = sz + dirZ * step
      } else {
        slideX = sx + dirX * step
        slideZ = sz
      }
    } else {
      // Already inside (shouldn't happen) — push out
      return null
    }

    // Check the slide position isn't too close to start (no meaningful movement)
    const sdx = slideX - sx
    const sdz = slideZ - sz
    if (Math.sqrt(sdx * sdx + sdz * sdz) < 0.01) return null

    return [slideX, slideZ]
  }

  // --- Spirit actions (instant move, kept for compatibility) ---

  moveSpirit(
    spiritId: string,
    targetX: number,
    targetZ: number,
  ): { success: boolean; newPosition: [number, number, number]; newRotation: number } {
    const spirit = this.spirits.get(spiritId)
    if (!spirit) {
      return { success: false, newPosition: [0, 0, 0], newRotation: 0 }
    }

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
    ;[finalX, finalZ] = this.clampToBounds(finalX, finalZ)

    // 2. Object collision: push out of bounding boxes (家はスキップ — 精霊は家に入れる)
    for (const obj of this.map.objects) {
      if (obj.type === 'house') continue
      const bb = obj.boundingBox
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
        if (dist > 0.01) {
          const scale = MIN_SPIRIT_DISTANCE / dist
          finalX = other.position[0] + sdx * scale
          finalZ = other.position[2] + sdz * scale
        } else {
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
      this.map.heightMap.getHeight(finalX, finalZ, spirit.position[1]),
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
