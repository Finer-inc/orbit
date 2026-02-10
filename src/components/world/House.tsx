interface HouseProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  wallColor?: string
  roofColor?: string
}

export default function House({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  wallColor = '#e8d5b7',
  roofColor = '#8b4513',
}: HouseProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* 壁 */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[4, 3, 3]} />
        <meshStandardMaterial color={wallColor} flatShading />
      </mesh>

      {/* 屋根 — 四角錐の切妻屋根風 */}
      <mesh position={[0, 4, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[3.5, 2, 4]} />
        <meshStandardMaterial color={roofColor} flatShading />
      </mesh>

      {/* ドア */}
      <mesh position={[0, 0.75, 1.525]}>
        <boxGeometry args={[0.8, 1.5, 0.05]} />
        <meshStandardMaterial color="#5c3a1e" flatShading />
      </mesh>

      {/* 窓 左 */}
      <mesh position={[-1.2, 1.8, 1.525]}>
        <boxGeometry args={[0.6, 0.6, 0.05]} />
        <meshStandardMaterial
          color="#87ceeb"
          transparent
          opacity={0.7}
          flatShading
        />
      </mesh>

      {/* 窓 右 */}
      <mesh position={[1.2, 1.8, 1.525]}>
        <boxGeometry args={[0.6, 0.6, 0.05]} />
        <meshStandardMaterial
          color="#87ceeb"
          transparent
          opacity={0.7}
          flatShading
        />
      </mesh>

      {/* 煙突 */}
      <mesh position={[1, 4.5, -0.5]}>
        <boxGeometry args={[0.5, 1.2, 0.5]} />
        <meshStandardMaterial color="#7a7a7a" flatShading />
      </mesh>
    </group>
  )
}
