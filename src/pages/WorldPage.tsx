import { useMemo } from 'react'
import { WorldLayout } from '../layouts/WorldLayout'
import { useWorldState } from '../hooks/useWorldState'
import { useSpirits } from '../hooks/useSpirits'
import WorldEnvironment from '../components/world/WorldEnvironment'
import Ground from '../components/world/Ground'
import Fountain from '../components/world/Fountain'
import House, { BED_LOCAL_OFFSET } from '../components/world/House'
import Trees from '../components/world/Trees'
import Character from '../components/world/Character'
import SpiritLabel from '../components/world/SpiritLabel'
import StreetLight from '../components/world/StreetLight'

/** ベッドのローカル座標を家のワールド座標に変換 */
function computeBedWorldPositions(
  houses: { position: [number, number, number]; rotation: [number, number, number] }[],
): [number, number][] {
  return houses.map((h) => {
    const cosR = Math.cos(h.rotation[1])
    const sinR = Math.sin(h.rotation[1])
    const wx = h.position[0] + BED_LOCAL_OFFSET[0] * cosR + BED_LOCAL_OFFSET[2] * sinR
    const wz = h.position[2] + (-BED_LOCAL_OFFSET[0] * sinR + BED_LOCAL_OFFSET[2] * cosR)
    return [wx, wz]
  })
}

const BED_PROXIMITY = 2.0

export function WorldPage() {
  const { timeOfDay, houses, trees } = useWorldState()
  const bedPositions = useMemo(() => computeBedWorldPositions(houses), [houses])
  const spirits = useSpirits()

  return (
    <WorldLayout>
      <WorldEnvironment timeOfDay={timeOfDay} />
      <Ground />
      <Fountain position={[0, 0, 0]} />
      <Fountain position={[18, 0, 0]} />
      <Fountain position={[0, 0, 18]} />
      <Fountain position={[18, 0, 18]} />
      {/* 街灯: 各広場の外円 */}
      {([[0, 0, 'sw'], [18, 0, 'se'], [0, 18, 'nw'], [18, 18, 'ne']] as const).map(([cx, cz, tag]) =>
        Array.from({ length: 8 }, (_, i) => {
          const angle = (Math.PI / 8) + (Math.PI * 2 / 8) * i
          return (
            <StreetLight
              key={`light-${tag}-${i}`}
              position={[cx + Math.cos(angle) * 9, 0, cz + Math.sin(angle) * 9]}
              timeOfDay={timeOfDay}
            />
          )
        })
      )}
      {houses.map((house, i) => (
        <House key={i} {...house} />
      ))}
      <Trees trees={trees} />
      {spirits.map((spirit) => {
        const nearBed = spirit.state === 'resting' && bedPositions.some(([bx, bz]) => {
          const dx = spirit.position[0] - bx
          const dz = spirit.position[2] - bz
          return dx * dx + dz * dz < BED_PROXIMITY * BED_PROXIMITY
        })
        return (
          <Character
            key={spirit.id}
            position={spirit.position}
            rotationY={spirit.rotationY}
            color={spirit.color}
            isResting={nearBed}
          >
            <SpiritLabel
              name={spirit.name}
              lastSpeech={spirit.lastSpeech}
              lastSpeechAt={spirit.lastSpeechAt}
              state={spirit.state}
              stamina={spirit.stamina}
              maxStamina={spirit.maxStamina}
            />
          </Character>
        )
      })}
    </WorldLayout>
  )
}
