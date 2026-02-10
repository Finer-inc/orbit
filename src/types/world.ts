// === 共通型（フロントエンド・バックエンド共有） ===

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night'

export type WorldObjectType = 'fountain' | 'house' | 'tree'

export interface WorldObjectEntry {
  id: string
  type: WorldObjectType
  position: [number, number, number]
  boundingBox: { min: [number, number, number]; max: [number, number, number] }
}

export interface VisibleObject {
  id: string
  type: WorldObjectType
  position: [number, number, number]
  distance: number
  screenOccupancy: number            // 視野内のスクリーン占有率 (0〜1)
}

export interface CharacterState {
  position: [number, number, number]
  rotationY: number
}

export interface CharacterAPI {
  moveTo(x: number, z: number): void
  moveForward(distance: number): void
  rotate(angle: number): void
  setPosition(x: number, z: number): void
  getPosition(): [number, number, number]
  getRotation(): number
}

export interface VisionAPI {
  getVisibleObjects(): VisibleObject[]
}

// === 精霊関連の型（バックエンド用） ===

export interface SpiritState {
  id: string
  name: string
  position: [number, number, number]
  rotationY: number
  currentAction: string | null
  lastThinkAt: number
}

export interface NearbySpiritInfo {
  id: string
  name: string
  distance: number
  position: [number, number, number]
}

export interface ObservationResult {
  objects: VisibleObject[]
  spirits: NearbySpiritInfo[]
  timeOfDay: TimeOfDay
}

// === ツール関連の型 ===

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, {
    type: string
    description: string
    required?: boolean
  }>
}

export interface ToolCall {
  name: string
  args: Record<string, unknown>
}

export interface ToolResult {
  success: boolean
  data: unknown
  message: string
}
