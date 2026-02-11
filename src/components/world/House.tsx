/** ベッド中心のローカル座標 [x, y, z] — House group 基準 */
export const BED_LOCAL_OFFSET: [number, number, number] = [1.5, 0.35, -0.5]

interface HouseProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  wallColor?: string
  roofColor?: string
}

export default function House({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  wallColor = '#f8eedc',
  roofColor = '#d47858',
}: HouseProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* === 前壁 (+Z) — ドア・窓の開口部を避けて分割 === */}
      {/* 前壁: 上部帯 (窓の上) y=2.55〜3.5 */}
      <mesh position={[0, 3.025, 2.5]}>
        <boxGeometry args={[6, 0.95, 0.1]} />
        <meshStandardMaterial color={wallColor} flatShading />
      </mesh>
      {/* 前壁: 窓帯 左端 x=-3〜-1.85 */}
      <mesh position={[-2.425, 2.2, 2.5]}>
        <boxGeometry args={[1.15, 0.7, 0.1]} />
        <meshStandardMaterial color={wallColor} flatShading />
      </mesh>
      {/* 前壁: 窓帯 中央 x=-1.15〜1.15 */}
      <mesh position={[0, 2.2, 2.5]}>
        <boxGeometry args={[2.3, 0.7, 0.1]} />
        <meshStandardMaterial color={wallColor} flatShading />
      </mesh>
      {/* 前壁: 窓帯 右端 x=1.85〜3 */}
      <mesh position={[2.425, 2.2, 2.5]}>
        <boxGeometry args={[1.15, 0.7, 0.1]} />
        <meshStandardMaterial color={wallColor} flatShading />
      </mesh>
      {/* 前壁: 下部 ドア左 x=-3〜-0.45 */}
      <mesh position={[-1.725, 0.925, 2.5]}>
        <boxGeometry args={[2.55, 1.85, 0.1]} />
        <meshStandardMaterial color={wallColor} flatShading />
      </mesh>
      {/* 前壁: 下部 ドア右 x=0.45〜3 */}
      <mesh position={[1.725, 0.925, 2.5]}>
        <boxGeometry args={[2.55, 1.85, 0.1]} />
        <meshStandardMaterial color={wallColor} flatShading />
      </mesh>

      {/* 後壁 (-Z) */}
      <mesh position={[0, 1.75, -2.5]}>
        <boxGeometry args={[6, 3.5, 0.1]} />
        <meshStandardMaterial color={wallColor} flatShading />
      </mesh>

      {/* 左壁 (-X) */}
      <mesh position={[-3, 1.75, 0]}>
        <boxGeometry args={[0.1, 3.5, 5]} />
        <meshStandardMaterial color={wallColor} flatShading />
      </mesh>

      {/* 右壁 (+X) */}
      <mesh position={[3, 1.75, 0]}>
        <boxGeometry args={[0.1, 3.5, 5]} />
        <meshStandardMaterial color={wallColor} flatShading />
      </mesh>

      {/* 床 */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[5.9, 0.04, 4.9]} />
        <meshStandardMaterial color="#c4a882" flatShading />
      </mesh>

      {/* 屋根 — 半透明 */}
      <mesh position={[0, 4.75, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[4.8, 2.5, 4]} />
        <meshStandardMaterial
          color={roofColor}
          flatShading
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>

      {/* ドア（開口部に収まる） */}
      <mesh position={[0, 0.9, 2.5]}>
        <boxGeometry args={[0.9, 1.8, 0.1]} />
        <meshStandardMaterial color="#8a5a3a" flatShading />
      </mesh>

      {/* 窓 左（開口部に収まる） */}
      <mesh position={[-1.5, 2.2, 2.5]}>
        <boxGeometry args={[0.7, 0.7, 0.1]} />
        <meshStandardMaterial
          color="#87ceeb"
          transparent
          opacity={0.7}
          flatShading
        />
      </mesh>

      {/* 窓 右（開口部に収まる） */}
      <mesh position={[1.5, 2.2, 2.5]}>
        <boxGeometry args={[0.7, 0.7, 0.1]} />
        <meshStandardMaterial
          color="#87ceeb"
          transparent
          opacity={0.7}
          flatShading
        />
      </mesh>

      {/* 煙突 */}
      <mesh position={[1.5, 5.5, -1]}>
        <boxGeometry args={[0.6, 1.4, 0.6]} />
        <meshStandardMaterial color="#7a7a7a" flatShading />
      </mesh>

      {/* === ベッド === */}
      {/* フレーム（木） */}
      <mesh position={[1.5, 0.15, -0.5]}>
        <boxGeometry args={[1.3, 0.3, 2.2]} />
        <meshStandardMaterial color="#8a6a3a" flatShading />
      </mesh>
      {/* マットレス */}
      <mesh position={[1.5, 0.35, -0.5]}>
        <boxGeometry args={[1.1, 0.12, 2.0]} />
        <meshStandardMaterial color="#f5f0e8" flatShading />
      </mesh>
      {/* 枕 */}
      <mesh position={[1.5, 0.44, -1.3]}>
        <boxGeometry args={[0.6, 0.1, 0.35]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      {/* ヘッドボード */}
      <mesh position={[1.5, 0.5, -1.55]}>
        <boxGeometry args={[1.3, 0.7, 0.08]} />
        <meshStandardMaterial color="#8a6a3a" flatShading />
      </mesh>
    </group>
  )
}
