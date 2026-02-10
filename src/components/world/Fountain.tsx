import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface FountainProps {
  position?: [number, number, number]
}

export default function Fountain({ position = [0, 0, 0] }: FountainProps) {
  const waterDropsRef = useRef<(THREE.Mesh | null)[]>([])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    const baseY = 2.5
    const speed = 3
    const amplitude = 0.5

    for (let i = 0; i < 8; i++) {
      const mesh = waterDropsRef.current[i]
      if (mesh) {
        const offset = (Math.PI * 2) / 8 * i
        mesh.position.y = baseY + Math.sin(time * speed + offset) * amplitude
      }
    }
  })

  return (
    <group position={position}>
      {/* 台座 — 八角形の石台 */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[3, 3.5, 0.8, 8]} />
        <meshStandardMaterial color="#9a9a9a" flatShading />
      </mesh>

      {/* 内側プール — 水面 */}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[2.5, 2.5, 0.3, 8]} />
        <meshStandardMaterial
          color="#4a90d9"
          transparent
          opacity={0.7}
          flatShading
        />
      </mesh>

      {/* 中央柱 */}
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 2, 8]} />
        <meshStandardMaterial color="#9a9a9a" flatShading />
      </mesh>

      {/* 上段受け皿 */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[1, 1.2, 0.3, 8]} />
        <meshStandardMaterial color="#9a9a9a" flatShading />
      </mesh>

      {/* 水柱アニメーション — 8個のローポリ球 */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (Math.PI * 2) / 8 * i
        const radius = 0.15
        return (
          <mesh
            key={i}
            ref={(el) => {
              waterDropsRef.current[i] = el
            }}
            position={[
              Math.cos(angle) * radius,
              2.5,
              Math.sin(angle) * radius,
            ]}
          >
            <sphereGeometry args={[0.08, 4, 4]} />
            <meshStandardMaterial
              color="#6ab4f0"
              transparent
              opacity={0.6}
              flatShading
            />
          </mesh>
        )
      })}
    </group>
  )
}
