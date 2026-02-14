import type { TimeOfDay } from '../../types/world'

interface StreetLightProps {
  timeOfDay: TimeOfDay
}

/** 街灯のビジュアルのみ（PointLightは親グループで管理） */
export default function StreetLight({ timeOfDay }: StreetLightProps) {
  const isLit = timeOfDay === 'night' || timeOfDay === 'evening'
  const emissiveIntensity = isLit ? 1 : 0

  return (
    <group>
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
    </group>
  )
}
