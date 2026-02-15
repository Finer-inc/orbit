// === 共通型（フロントエンド・バックエンド共有） ===

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night'

export interface WorldObjectEntry {
  id: string
  name: string
  position: [number, number, number]
  rotationY: number
  boundingBox: { min: [number, number, number]; max: [number, number, number] }
}

export interface VisibleObject {
  id: string
  name: string
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

export type SpiritBehaviorState = 'idle' | 'active' | 'conversing' | 'resting'

export interface SpiritState {
  id: string
  name: string
  position: [number, number, number]
  rotationY: number
  currentAction: string | null
  lastThinkAt: number
  color: string
  lastSpeech?: string
  lastSpeechAt?: number
  lastSpeechVolume?: Volume
  // 行動システム
  state: SpiritBehaviorState
  goal?: string
  subgoal?: string
  stamina: number
  maxStamina: number
  staminaUpdatedAt: number
  mentalEnergy: number
  maxMentalEnergy: number
  // 連続移動
  movingTo?: [number, number] | null
  moveSpeed?: number
}

export interface NearbySpiritInfo {
  id: string
  name: string
  distance: number
  position: [number, number, number]
}

export type Volume = 'whisper' | 'normal' | 'shout'

// 到達距離（ユニット）
export const VOLUME_RANGE: Record<Volume, number> = {
  whisper: 1.5,
  normal: 5.0,
  shout: 15.0,
}

// サーバー内部で保持する発話メッセージ
export interface SpatialMessage {
  from: string                        // 発話者名
  fromId: string                      // 発話者ID
  to?: string                         // 宛先精霊ID（任意）
  toName?: string                     // 宛先精霊名（任意）
  message: string
  volume: Volume
  position: [number, number, number]  // 発話位置
  timestamp: number
}

// observe時に返される「聞こえた声」
export interface HeardVoice {
  from: string       // 発話者名
  fromId: string     // 発話者ID
  to?: string        // 宛先精霊ID
  toName?: string    // 宛先精霊名
  message: string
  volume: Volume
  distance: number   // リスナーからの距離
}

export interface ObservationResult {
  objects: VisibleObject[]
  spirits: NearbySpiritInfo[]
  timeOfDay: TimeOfDay
  voices: HeardVoice[]
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
