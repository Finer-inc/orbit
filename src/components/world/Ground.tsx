import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getTerrainHeight, HIGHLAND_Y } from '../../utils/terrainHeight'

const STAIRS_COUNT = 10
const TERRAIN_SIZE = 200
const TERRAIN_SEGMENTS = 160

// --- 地形メッシュコンポーネント ---

function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null)

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      TERRAIN_SIZE, TERRAIN_SIZE,
      TERRAIN_SEGMENTS, TERRAIN_SEGMENTS,
    )
    geo.rotateX(-Math.PI / 2)

    const pos = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const grassColor = new THREE.Color('#6db87e')
    const highlandGrass = new THREE.Color('#7ab87e')
    const dirtColor = new THREE.Color('#8a7a5a')

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)

      const y = getTerrainHeight(x, z)
      pos.setY(i, y)

      // 色
      const t = Math.min(1, Math.max(0, y) / HIGHLAND_Y)
      const col = grassColor.clone().lerp(highlandGrass, t)
      if (Math.abs(y) > 0.7) {
        const steepness = Math.min(1, (Math.abs(y) - 0.7) / 1.0)
        col.lerp(dirtColor, steepness * 0.3)
      }

      colors[i * 3] = col.r
      colors[i * 3 + 1] = col.g
      colors[i * 3 + 2] = col.b
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  }, [])

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial vertexColors flatShading />
    </mesh>
  )
}

/** 階段1段分 */
function StairStep({ index, width }: { index: number; width: number }) {
  const stepHeight = 0.6
  const stepDepth = 1.7
  const y = index * stepHeight + stepHeight / 2
  const z = -28 - index * stepDepth - stepDepth / 2
  return (
    <mesh position={[0, y, z]}>
      <boxGeometry args={[width, stepHeight, stepDepth]} />
      <meshStandardMaterial color="#a09080" flatShading />
    </mesh>
  )
}

export default function Ground() {
  const stoneColor = '#c4b8a8'
  const waterColor = '#4a90d9'

  return (
    <group>
      {/* 凸凹地形メッシュ */}
      <Terrain />

      {/* 中央広場（石畳） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[12, 48]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* === 道 === */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 5]}>
        <planeGeometry args={[3, 60]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.5, 0.01, 5]}>
        <planeGeometry args={[55, 3]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -21]}>
        <planeGeometry args={[3, 14]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>
      {/* 高台上の道 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, HIGHLAND_Y + 0.02, -58]}>
        <planeGeometry args={[3, 26]} />
        <meshStandardMaterial color={stoneColor} flatShading />
      </mesh>

      {/* ===== 階段 ===== */}
      {Array.from({ length: STAIRS_COUNT }, (_, i) => (
        <StairStep key={`stair-${i}`} index={i} width={6} />
      ))}

      {/* ===== 川 ===== */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[44, -0.1, 10]}>
        <planeGeometry args={[8, 100]} />
        <meshStandardMaterial color={waterColor} transparent opacity={0.6} flatShading />
      </mesh>

      {/* ===== 湖 ===== */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[28, -0.1, 52]}>
        <circleGeometry args={[12, 48]} />
        <meshStandardMaterial color={waterColor} transparent opacity={0.55} flatShading />
      </mesh>

      {/* ===== 農地 ===== */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12, 0.02, 55]}>
        <planeGeometry args={[8, 10]} />
        <meshStandardMaterial color="#8B6914" flatShading />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2, 0.02, 55]}>
        <planeGeometry args={[8, 10]} />
        <meshStandardMaterial color="#8B6914" flatShading />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, 0.02, 55]}>
        <planeGeometry args={[8, 10]} />
        <meshStandardMaterial color="#8B6914" flatShading />
      </mesh>
    </group>
  )
}
