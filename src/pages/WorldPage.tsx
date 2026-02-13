import { useMemo } from 'react'
import { WorldLayout } from '../layouts/WorldLayout'
import { useWorldState } from '../hooks/useWorldState'
import { useSpirits } from '../hooks/useSpirits'
import { useCameraMode } from '../hooks/useCameraMode'
import WorldEnvironment from '../components/world/WorldEnvironment'
import Ground from '../components/world/Ground'
import Fountain from '../components/world/Fountain'
import House, { BED_LOCAL_OFFSET } from '../components/world/House'
import Trees from '../components/world/Trees'
import Character from '../components/world/Character'
import SpiritLabel from '../components/world/SpiritLabel'
import StreetLight from '../components/world/StreetLight'
import CameraController from '../components/world/CameraController'
import CameraHUD from '../components/ui/CameraHUD'
import { VOLUME_RANGE } from '../types/world'
import { exportWorldGLB } from '../utils/worldExporter'

const SPEECH_DISPLAY_DURATION = 10_000

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
  const { timeOfDay, hour, houses, trees } = useWorldState()
  const hh = String(Math.floor(hour)).padStart(2, '0')
  const mm = String(Math.floor((hour % 1) * 60)).padStart(2, '0')
  const bedPositions = useMemo(() => computeBedWorldPositions(houses), [houses])
  const spirits = useSpirits()
  const { mode, selectedIndex, toggleMode, setSelectedIndex } = useCameraMode(spirits.length)

  const selectedSpirit = spirits[selectedIndex]

  return (
    <>
    {spirits.length > 0 && (
      <CameraHUD
        spirits={spirits.map((s) => ({ id: s.id, name: s.name }))}
        selectedIndex={selectedIndex}
        mode={mode}
        onSelectIndex={setSelectedIndex}
        onToggleMode={toggleMode}
      />
    )}
    <div style={{
      position: 'fixed', top: 12, right: 16, zIndex: 10,
      color: '#fff', fontSize: 20, fontFamily: 'monospace',
      textShadow: '0 0 6px rgba(0,0,0,0.8)',
      pointerEvents: 'none',
    }}>
      {hh}:{mm}
    </div>
    <button
      onClick={() => exportWorldGLB().catch(console.error)}
      style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 10,
        padding: '6px 14px', fontSize: 13, borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.3)',
        background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer',
      }}
    >
      Export GLB
    </button>
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
        const now = Date.now()
        const isSpeaking = spirit.lastSpeechAt && (now - spirit.lastSpeechAt) < SPEECH_DISPLAY_DURATION
        const speechRadius = isSpeaking
          ? VOLUME_RANGE[spirit.lastSpeechVolume ?? 'normal']
          : undefined
        return (
          <Character
            key={spirit.id}
            position={spirit.position}
            rotationY={spirit.rotationY}
            color={spirit.color}
            isResting={nearBed}
            speechRadius={speechRadius}
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
      {selectedSpirit && (
        <CameraController
          targetPosition={selectedSpirit.position}
          targetRotationY={selectedSpirit.rotationY}
          mode={mode}
        />
      )}
    </WorldLayout>
    </>
  )
}
