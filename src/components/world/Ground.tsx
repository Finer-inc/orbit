interface GroundProps {
  size?: number
}

export default function Ground({ size = 50 }: GroundProps) {
  const pathWidth = 1.2
  const pathLength = 8
  const stoneColor = '#8a8578'

  return (
    <group>
      {/* 芝生の地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[size, 32]} />
        <meshStandardMaterial color="#4a7c59" flatShading />
      </mesh>

      {/* 中央の石畳エリア */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[8, 32]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* 十字型の小道: +Z方向 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, pathLength / 2 + 8]}>
        <boxGeometry args={[pathWidth, pathLength, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* 十字型の小道: -Z方向 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -(pathLength / 2 + 8)]}>
        <boxGeometry args={[pathWidth, pathLength, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* 十字型の小道: +X方向 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[pathLength / 2 + 8, 0.005, 0]}>
        <boxGeometry args={[pathLength, pathWidth, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* 十字型の小道: -X方向 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-(pathLength / 2 + 8), 0.005, 0]}>
        <boxGeometry args={[pathLength, pathWidth, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>
    </group>
  )
}
