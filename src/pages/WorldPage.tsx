import { useState, useEffect } from 'react'
import { WorldLayout } from '../layouts/WorldLayout'
import { useWorldState } from '../hooks/useWorldState'
import { useSpirits } from '../hooks/useSpirits'
import { useCameraMode } from '../hooks/useCameraMode'
import WorldEnvironment from '../components/world/WorldEnvironment'
import WorldGLB from '../components/world/WorldGLB'
import LegacyWorldStage, { getLegacyBedPositions } from '../components/world/LegacyWorldStage'
import Character from '../components/world/Character'
import SpiritLabel from '../components/world/SpiritLabel'
import CameraController from '../components/world/CameraController'
import CameraHUD from '../components/ui/CameraHUD'
import { VOLUME_RANGE } from '../types/world'
import { exportWorldGLB } from '../utils/worldExporter'

const LEGACY_STAGE = import.meta.env.VITE_STAGE === 'legacy'

const SPEECH_DISPLAY_DURATION = 10_000
const BED_PROXIMITY = 2.0

interface BedInfo {
  houseId: string
  position: [number, number, number]
}

function useBeds(): [number, number][] {
  const [beds, setBeds] = useState<[number, number][]>(() =>
    LEGACY_STAGE ? getLegacyBedPositions() : [],
  )

  useEffect(() => {
    if (LEGACY_STAGE) return
    fetch('/api/world/beds')
      .then((r) => r.json())
      .then((data: BedInfo[]) => {
        setBeds(data.map((b) => [b.position[0], b.position[2]]))
      })
      .catch(console.error)
  }, [])

  return beds
}

export function WorldPage() {
  const { timeOfDay, hour } = useWorldState()
  const hh = String(Math.floor(hour)).padStart(2, '0')
  const mm = String(Math.floor((hour % 1) * 60)).padStart(2, '0')
  const bedPositions = useBeds()
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
      <group name="__world__">
        {LEGACY_STAGE
          ? <LegacyWorldStage timeOfDay={timeOfDay} />
          : <WorldGLB timeOfDay={timeOfDay} />
        }
      </group>
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
      {mode === 'tps' && selectedSpirit && (
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
