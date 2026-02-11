import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface CharacterProps {
  position: [number, number, number]
  rotationY: number
  color?: string
  isResting?: boolean
  children?: React.ReactNode
}

const LERP_SPEED = 0.08

export default function Character({ position, rotationY, color = '#e8b88a', isResting = false, children }: CharacterProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const bodyRef = useRef<THREE.Group>(null!)
  const currentRotation = useRef(rotationY)
  const currentTilt = useRef(0)
  const initialized = useRef(false)

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    // 初回はテレポート
    if (!initialized.current) {
      group.position.set(position[0], position[1], position[2])
      currentRotation.current = rotationY
      group.rotation.y = rotationY
      initialized.current = true
      return
    }

    // 位置を補間
    group.position.lerp(
      { x: position[0], y: position[1], z: position[2] } as THREE.Vector3,
      LERP_SPEED,
    )

    // 回転を補間（最短経路）
    const diff = rotationY - currentRotation.current
    const wrapped = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI
    currentRotation.current += wrapped * LERP_SPEED
    group.rotation.y = currentRotation.current

    // resting時の傾き補間
    const body = bodyRef.current
    if (body) {
      const targetTilt = isResting ? -Math.PI / 2 : 0
      currentTilt.current += (targetTilt - currentTilt.current) * LERP_SPEED
      body.rotation.x = currentTilt.current
      // resting時のY位置調整（仰向けになると中心が下がる）
      const targetY = isResting ? -0.7 : 0
      body.position.y += (targetY - body.position.y) * LERP_SPEED
    }
  })

  return (
    <group ref={groupRef}>
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
        <mesh position={[-0.5, 1.3, 0]}>
          <boxGeometry args={[0.2, 0.6, 0.2]} />
          <meshStandardMaterial color={color} flatShading />
        </mesh>

        {/* 右腕 */}
        <mesh position={[0.5, 1.3, 0]}>
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

      {children}
    </group>
  )
}
