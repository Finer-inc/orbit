import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpriteData } from '../../services/spriteLoader'
import BillboardCharacter from './BillboardCharacter'

interface CharacterProps {
  position: [number, number, number]
  rotationY: number
  color?: string
  isResting?: boolean
  isMoving?: boolean
  spriteData?: SpriteData
  speechRadius?: number
  children?: React.ReactNode
}

const LERP_SPEED = 0.08

export default function Character({ position, rotationY, color = '#e8b88a', isResting = false, isMoving = false, spriteData, speechRadius, children }: CharacterProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const currentRotation = useRef(rotationY)
  const initialized = useRef(false)

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    if (!initialized.current) {
      group.position.set(position[0], position[1], position[2])
      currentRotation.current = rotationY
      initialized.current = true
      return
    }

    // 位置を補間
    group.position.lerp(
      { x: position[0], y: position[1], z: position[2] } as THREE.Vector3,
      LERP_SPEED,
    )

    // 回転を補間（最短経路）— BoxGeometry用。Billboard側は自前で向きを管理
    if (!spriteData) {
      const diff = rotationY - currentRotation.current
      const wrapped = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI
      currentRotation.current += wrapped * LERP_SPEED
      group.rotation.y = currentRotation.current
    }
  })

  return (
    <group ref={groupRef}>
      {spriteData ? (
        <BillboardCharacter
          spriteData={spriteData}
          facingAngle={rotationY}
          isMoving={isMoving}
          isResting={isResting}
          speechRadius={speechRadius}
        >
          {children}
        </BillboardCharacter>
      ) : (
        <BoxCharacter
          color={color}
          isResting={isResting}
          speechRadius={speechRadius}
        >
          {children}
        </BoxCharacter>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// BoxCharacter — the original box mesh body
// ---------------------------------------------------------------------------

function BoxCharacter({ color, isResting, speechRadius, children }: {
  color: string
  isResting: boolean
  speechRadius?: number
  children?: React.ReactNode
}) {
  const bodyRef = useRef<THREE.Group>(null!)
  const currentTilt = useRef(0)

  useFrame(() => {
    const body = bodyRef.current
    if (!body) return
    const targetTilt = isResting ? -Math.PI / 2 : 0
    currentTilt.current += (targetTilt - currentTilt.current) * LERP_SPEED
    body.rotation.x = currentTilt.current
    const targetY = isResting ? -0.7 : 0
    body.position.y += (targetY - body.position.y) * LERP_SPEED
  })

  return (
    <>
      <group ref={bodyRef}>
        {/* 胴体 */}
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[0.6, 0.8, 0.4]} />
          <meshStandardMaterial color={color} flatShading />
        </mesh>

        {/* 頭 */}
        <mesh position={[0, 1.95, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#f5d5b8" flatShading />
        </mesh>

        {/* 左腕 */}
        <mesh position={[-0.45, 1.3, 0]}>
          <boxGeometry args={[0.2, 0.6, 0.2]} />
          <meshStandardMaterial color={color} flatShading />
        </mesh>

        {/* 右腕 */}
        <mesh position={[0.45, 1.3, 0]}>
          <boxGeometry args={[0.2, 0.6, 0.2]} />
          <meshStandardMaterial color={color} flatShading />
        </mesh>

        {/* 左脚 */}
        <mesh position={[-0.15, 0.45, 0]}>
          <boxGeometry args={[0.25, 0.5, 0.25]} />
          <meshStandardMaterial color="#4a6fa5" flatShading />
        </mesh>

        {/* 右脚 */}
        <mesh position={[0.15, 0.45, 0]}>
          <boxGeometry args={[0.25, 0.5, 0.25]} />
          <meshStandardMaterial color="#4a6fa5" flatShading />
        </mesh>

        {/* 左目 */}
        <mesh position={[-0.1, 2.0, 0.26]}>
          <boxGeometry args={[0.08, 0.08, 0.02]} />
          <meshStandardMaterial color="#222222" />
        </mesh>

        {/* 右目 */}
        <mesh position={[0.1, 2.0, 0.26]}>
          <boxGeometry args={[0.08, 0.08, 0.02]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
      </group>

      {/* 声の範囲リング */}
      {speechRadius != null && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
          <ringGeometry args={[speechRadius - 0.05, speechRadius, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {children}
    </>
  )
}
