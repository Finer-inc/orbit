import { useRef } from 'react'
import type { TimeOfDay } from '../../types/world'

interface StreetLightProps {
  position: [number, number, number]
  timeOfDay: TimeOfDay
}

export default function StreetLight({ position, timeOfDay }: StreetLightProps) {
  const lightRef = useRef(null)

  const isLit = timeOfDay === 'night' || timeOfDay === 'evening'
  const intensity = timeOfDay === 'night' ? 8 : timeOfDay === 'evening' ? 3 : 0
  const emissiveIntensity = isLit ? 1 : 0

  return (
    <group position={position}>
      {/* ポール: 細い円柱 */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3, 8]} />
        <meshStandardMaterial color="#444444" />
      </mesh>

      {/* ランプヘッド */}
      <mesh position={[0, 3.1, 0]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial
          color={isLit ? '#ffdd88' : '#888888'}
          emissive={isLit ? '#ffdd88' : '#000000'}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>

      {/* PointLight: 点灯時のみ */}
      {intensity > 0 && (
        <pointLight
          ref={lightRef}
          position={[0, 3.0, 0]}
          color="#ffcc66"
          intensity={intensity}
          distance={15}
          decay={2}
        />
      )}
    </group>
  )
}
