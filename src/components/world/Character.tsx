interface CharacterProps {
  position: [number, number, number]
  rotationY: number
}

export default function Character({ position, rotationY }: CharacterProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 胴体 */}
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.6, 0.8, 0.4]} />
        <meshStandardMaterial color="#e8b88a" flatShading />
      </mesh>

      {/* 頭 */}
      <mesh position={[0, 1.95, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#f5d5b8" flatShading />
      </mesh>

      {/* 左腕 */}
      <mesh position={[-0.5, 1.1, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color="#e8b88a" flatShading />
      </mesh>

      {/* 右腕 */}
      <mesh position={[0.5, 1.1, 0]}>
        <boxGeometry args={[0.2, 0.6, 0.2]} />
        <meshStandardMaterial color="#e8b88a" flatShading />
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

      {/* 鼻（向きマーカー） */}
      <mesh position={[0, 1.95, 0.3]}>
        <boxGeometry args={[0.1, 0.1, 0.15]} />
        <meshStandardMaterial color="#d4826a" flatShading />
      </mesh>
    </group>
  )
}
