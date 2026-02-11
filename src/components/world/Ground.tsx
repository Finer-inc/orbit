interface GroundProps {
  size?: number
}

// 広場4つの中心座標（2×2グリッド）
const PLAZA_1 = [0, 0] as const
const PLAZA_2 = [18, 0] as const
const PLAZA_3 = [0, 18] as const
const PLAZA_4 = [18, 18] as const
const PLAZA_RADIUS = 8

export default function Ground({ size = 60 }: GroundProps) {
  const pathWidth = 1.2
  const pathLength = 8
  const stoneColor = '#c4b8a8'

  return (
    <group>
      {/* 芝生の地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[9, 0, 9]}>
        <circleGeometry args={[size, 32]} />
        <meshStandardMaterial color="#6db87e" flatShading />
      </mesh>

      {/* === 広場1（北西） === */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PLAZA_1[0], 0.01, PLAZA_1[1]]}>
        <circleGeometry args={[PLAZA_RADIUS, 32]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* 広場1: -Z小道（外周方向） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PLAZA_1[0], 0.005, -(pathLength / 2 + PLAZA_RADIUS)]}>
        <boxGeometry args={[pathWidth, pathLength, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* 広場1: -X小道（外周方向） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-(pathLength / 2 + PLAZA_RADIUS), 0.005, PLAZA_1[1]]}>
        <boxGeometry args={[pathLength, pathWidth, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* === 広場1-2間の接続通路 === */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[9, 0.008, 0]}>
        <boxGeometry args={[2, pathWidth, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* === 広場2（北東） === */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PLAZA_2[0], 0.01, PLAZA_2[1]]}>
        <circleGeometry args={[PLAZA_RADIUS, 32]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* 広場2: -Z小道（外周方向） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PLAZA_2[0], 0.005, -(pathLength / 2 + PLAZA_RADIUS)]}>
        <boxGeometry args={[pathWidth, pathLength, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* 広場2: +X小道（外周方向） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PLAZA_2[0] + pathLength / 2 + PLAZA_RADIUS, 0.005, PLAZA_2[1]]}>
        <boxGeometry args={[pathLength, pathWidth, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* === 広場3（南西） === */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PLAZA_3[0], 0.01, PLAZA_3[1]]}>
        <circleGeometry args={[PLAZA_RADIUS, 32]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* 広場3: +Z小道（外周方向） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PLAZA_3[0], 0.005, PLAZA_3[1] + pathLength / 2 + PLAZA_RADIUS]}>
        <boxGeometry args={[pathWidth, pathLength, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* 広場3: -X小道（外周方向） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-(pathLength / 2 + PLAZA_RADIUS), 0.005, PLAZA_3[1]]}>
        <boxGeometry args={[pathLength, pathWidth, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* === 広場3-4間の接続通路 === */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[9, 0.008, 18]}>
        <boxGeometry args={[2, pathWidth, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* === 広場4（南東） === */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PLAZA_4[0], 0.01, PLAZA_4[1]]}>
        <circleGeometry args={[PLAZA_RADIUS, 32]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* 広場4: +Z小道（外周方向） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PLAZA_4[0], 0.005, PLAZA_4[1] + pathLength / 2 + PLAZA_RADIUS]}>
        <boxGeometry args={[pathWidth, pathLength, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* 広場4: +X小道（外周方向） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[PLAZA_4[0] + pathLength / 2 + PLAZA_RADIUS, 0.005, PLAZA_4[1]]}>
        <boxGeometry args={[pathLength, pathWidth, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* === 広場1-3間の接続通路（Z方向） === */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 9]}>
        <boxGeometry args={[pathWidth, 2, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* === 広場2-4間の接続通路（Z方向） === */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[18, 0.008, 9]}>
        <boxGeometry args={[pathWidth, 2, 0.05]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>
    </group>
  )
}
