import Ground from './Ground'
import Fountain from './Fountain'
import House, { BED_LOCAL_OFFSET } from './House'
import { Tree } from './Trees'
import StreetLight from './StreetLight'
import type { TimeOfDay } from '../../types/world'

interface LegacyWorldStageProps {
  timeOfDay: TimeOfDay
}

// House: 6(X) x 3.5(Y) x 5(Z), door at local +Z
const HOUSE_COL: [number, number, number] = [6, 4, 5]
const HOUSE_COL_Y = 2

// Tree: trunk+leaves ~3.8 high, canopy radius ~0.8
const TREE_COL_R = 0.8
const TREE_COL_H = 3.8

// Fountain: base r=3.5, total height ~3
const FOUNTAIN_COL_R = 3.5
const FOUNTAIN_COL_H = 3

// StreetLight: pole height 3, thin
const LIGHT_COL_R = 0.15
const LIGHT_COL_H = 3

const HOUSES: {
  position: [number, number, number]
  rotation: [number, number, number]
  wallColor?: string
  roofColor?: string
}[] = [
  // --- 高台の住宅 (0-7: residential, Y=6) ---
  { position: [-18, 6, -55], rotation: [0, Math.PI / 3, 0] },
  { position: [-8, 6, -60], rotation: [0, -Math.PI / 6, 0] },
  { position: [5, 6, -58], rotation: [0, Math.PI / 4, 0] },
  { position: [18, 6, -54], rotation: [0, -Math.PI / 3, 0] },
  { position: [-15, 6, -72], rotation: [0, Math.PI / 5, 0] },
  { position: [-5, 6, -76], rotation: [0, -Math.PI / 4, 0] },
  { position: [8, 6, -74], rotation: [0, Math.PI / 6, 0] },
  { position: [16, 6, -70], rotation: [0, -Math.PI / 5, 0] },
  // --- 商業・公共施設 (8-13) ---
  { position: [0, 0, -20], rotation: [0, 0, 0], wallColor: '#e8dcc8', roofColor: '#6b5b4f' },
  { position: [16, 0, 5], rotation: [0, Math.PI, 0], wallColor: '#f5e6d0', roofColor: '#c4713a' },
  { position: [26, 0, 5], rotation: [0, Math.PI, 0], wallColor: '#d4c5a9', roofColor: '#7a6b5a' },
  { position: [-16, 0, 5], rotation: [0, Math.PI, 0], wallColor: '#c4b8a8', roofColor: '#8a7a6a' },
  { position: [-14, 6, -62], rotation: [0, Math.PI / 2, 0], wallColor: '#e8d5c0', roofColor: '#9a6b4a' },
  { position: [14, 6, -58], rotation: [0, -Math.PI / 2, 0], wallColor: '#d4c8b8', roofColor: '#7a8a6a' },
]

const TREES: {
  position: [number, number, number]
  scale?: number
}[] = [
  // 森エリア
  { position: [-38, 0, -10], scale: 1.3 }, { position: [-42, 0, -5], scale: 1.1 },
  { position: [-45, 0, 0], scale: 1.4 }, { position: [-40, 0, 5], scale: 0.9 },
  { position: [-48, 0, 8], scale: 1.2 }, { position: [-36, 0, 12], scale: 1.0 },
  { position: [-50, 0, 15], scale: 1.3 }, { position: [-43, 0, 18], scale: 0.8 },
  { position: [-55, 0, 5], scale: 1.4 }, { position: [-52, 0, -8], scale: 1.1 },
  { position: [-58, 0, 0], scale: 1.2 }, { position: [-47, 0, 22], scale: 1.0 },
  { position: [-60, 0, 10], scale: 1.3 }, { position: [-55, 0, 20], scale: 0.9 },
  { position: [-63, 0, -5], scale: 1.1 }, { position: [-50, 0, 28], scale: 1.2 },
  { position: [-65, 0, 8], scale: 0.7 }, { position: [-58, 0, 25], scale: 1.0 },
  { position: [-68, 0, 15], scale: 1.4 }, { position: [-62, 0, 30], scale: 0.8 },
  { position: [-70, 0, 5], scale: 1.1 }, { position: [-44, 0, 32], scale: 1.3 },
  { position: [-56, 0, -12], scale: 0.9 }, { position: [-39, 0, -14], scale: 1.0 },
  { position: [-67, 0, 22], scale: 1.2 }, { position: [-72, 0, 12], scale: 0.6 },
  { position: [-53, 0, 33], scale: 1.1 }, { position: [-46, 0, -12], scale: 1.0 },
  { position: [-61, 0, -10], scale: 0.8 }, { position: [-37, 0, 25], scale: 1.2 },
  // 公園エリア
  { position: [-22, 0, 16], scale: 1.1 }, { position: [-25, 0, 20], scale: 0.9 },
  { position: [-19, 0, 22], scale: 1.3 }, { position: [-24, 0, 14], scale: 0.8 },
  { position: [-20, 0, 18], scale: 1.0 },
  // 高台
  { position: [-12, 6, -50], scale: 1.0 }, { position: [12, 6, -48], scale: 0.9 },
  { position: [-20, 6, -65], scale: 1.1 }, { position: [20, 6, -62], scale: 0.8 },
  { position: [-10, 6, -78], scale: 1.2 }, { position: [10, 6, -80], scale: 0.7 },
  { position: [0, 6, -82], scale: 1.0 }, { position: [-22, 6, -75], scale: 0.9 },
  // 湖の周り
  { position: [20, 0, 48], scale: 1.1 }, { position: [35, 0, 45], scale: 1.3 },
  { position: [22, 0, 58], scale: 0.9 }, { position: [36, 0, 56], scale: 1.0 },
  { position: [28, 0, 42], scale: 0.8 },
  // 川沿い
  { position: [38, 0, -20], scale: 1.0 }, { position: [39, 0, -5], scale: 1.2 },
  { position: [38, 0, 15], scale: 0.9 }, { position: [39, 0, 30], scale: 1.1 },
  { position: [38, 0, 45], scale: 0.8 },
]

const FOUNTAIN_POSITIONS: [number, number, number][] = [
  [0, 0, 0], [18, 0, 0], [0, 0, 18], [18, 0, 18],
]

const PLAZA_CENTERS: [number, number, string][] = [
  [0, 0, 'sw'], [18, 0, 'se'], [0, 18, 'nw'], [18, 18, 'ne'],
]

/** レガシーステージのベッド位置を計算 */
export function getLegacyBedPositions(): [number, number][] {
  return HOUSES.map((h) => {
    const cosR = Math.cos(h.rotation[1])
    const sinR = Math.sin(h.rotation[1])
    const wx = h.position[0] + BED_LOCAL_OFFSET[0] * cosR + BED_LOCAL_OFFSET[2] * sinR
    const wz = h.position[2] + (-BED_LOCAL_OFFSET[0] * sinR + BED_LOCAL_OFFSET[2] * cosR)
    return [wx, wz]
  })
}

export default function LegacyWorldStage({ timeOfDay }: LegacyWorldStageProps) {
  let lightIdx = 0
  const lightIntensity = timeOfDay === 'night' ? 8 : timeOfDay === 'evening' ? 3 : 0

  return (
    <>
      {/* ===== Terrain ===== */}
      <group name="vis_terrain">
        <Ground />
      </group>

      {/* ===== Fountains ===== */}
      {FOUNTAIN_POSITIONS.map((pos, i) => (
        <group key={`fountain-${i}`} name={`fountain_${i}`} position={pos}>
          <group name={`vis_fountain_${i}`}>
            <Fountain />
          </group>
          <mesh
            name={`col_fountain_${i}`}
            position={[0, FOUNTAIN_COL_H / 2, 0]}
            visible={false}
          >
            <cylinderGeometry args={[FOUNTAIN_COL_R, FOUNTAIN_COL_R, FOUNTAIN_COL_H, 8]} />
            <meshStandardMaterial color="#888" transparent opacity={0.4} />
          </mesh>
        </group>
      ))}

      {/* ===== Street Lights ===== */}
      {PLAZA_CENTERS.map(([cx, cz, tag]) =>
        Array.from({ length: 8 }, (_, i) => {
          const angle = (Math.PI / 8) + (Math.PI * 2 / 8) * i
          const x = cx + Math.cos(angle) * 9
          const z = cz + Math.sin(angle) * 9
          const idx = lightIdx++
          return (
            <group key={`light-${tag}-${i}`} name={`streetlight_${idx}`} position={[x, 0, z]}>
              <group name={`vis_streetlight_${idx}`}>
                <StreetLight timeOfDay={timeOfDay} />
              </group>
              <mesh
                name={`col_streetlight_${idx}`}
                position={[0, LIGHT_COL_H / 2, 0]}
                visible={false}
              >
                <cylinderGeometry args={[LIGHT_COL_R, LIGHT_COL_R, LIGHT_COL_H, 4]} />
                <meshStandardMaterial color="#888" transparent opacity={0.4} />
              </mesh>
              <pointLight
                name={`light_streetlight_${idx}`}
                position={[0, 3.0, 0]}
                color="#ffcc66"
                intensity={lightIntensity}
                distance={15}
                decay={2}
              />
            </group>
          )
        })
      )}

      {/* ===== Houses ===== */}
      {HOUSES.map((house, i) => (
        <group key={`house-${i}`} name={`house_${i}`} position={house.position} rotation={house.rotation}>
          <group name={`vis_house_${i}`}>
            <House wallColor={house.wallColor} roofColor={house.roofColor} />
          </group>
          <mesh
            name={`col_house_${i}`}
            position={[0, HOUSE_COL_Y, 0]}
            visible={false}
          >
            <boxGeometry args={HOUSE_COL} />
            <meshStandardMaterial color="#888" transparent opacity={0.4} />
          </mesh>
        </group>
      ))}

      {/* ===== Trees ===== */}
      {TREES.map((tree, i) => {
        const s = tree.scale ?? 1
        const h = TREE_COL_H * s
        return (
          <group key={`tree-${i}`} name={`tree_${i}`} position={tree.position}>
            <group name={`vis_tree_${i}`}>
              <Tree scale={s} />
            </group>
            <mesh
              name={`col_tree_${i}`}
              position={[0, h / 2, 0]}
              visible={false}
            >
              <cylinderGeometry args={[TREE_COL_R * s, TREE_COL_R * s, h, 6]} />
              <meshStandardMaterial color="#888" transparent opacity={0.4} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}
