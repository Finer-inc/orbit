import { useState, useEffect } from 'react'
import { WorldLayout } from '../layouts/WorldLayout'
import { useWorldState } from '../hooks/useWorldState'
import { useSpirits } from '../hooks/useSpirits'
import { useAgentManager } from '../hooks/useAgentManager'
import { useCameraMode } from '../hooks/useCameraMode'
import WorldEnvironment from '../components/world/WorldEnvironment'
import WorldGLB from '../components/world/WorldGLB'
import LegacyWorldStage, { getLegacyBedPositions } from '../components/world/LegacyWorldStage'
import Character from '../components/world/Character'
import SpiritLabel from '../components/world/SpiritLabel'
import CameraController from '../components/world/CameraController'
import CameraHUD from '../components/ui/CameraHUD'
import ControlPanel from '../components/ui/ControlPanel'
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
  const { agents, spawning, spawnError, spawnAgent, despawnAgent } = useAgentManager()
  const { mode, selectedIndex, toggleMode, setSelectedIndex } = useCameraMode(spirits.length)

  const selectedSpirit = spirits[selectedIndex]

  const handleAdd = async (name: string, workspace: Record<string, string>) => {
    const filtered: Record<string, string> = {}
    for (const [key, value] of Object.entries(workspace)) {
      if (value.trim()) filtered[key] = value.trim()
    }
    await spawnAgent({
      name: name || undefined,
      workspace: Object.keys(filtered).length > 0 ? filtered : undefined,
    })
  }

  const handleRemove = async (id: string) => {
    await despawnAgent(id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', width: '100vw', height: '100vh' }}>
      <div style={{ flex: '3 0 0', minWidth: 0 }}>
        <ControlPanel
          agents={agents}
          spawning={spawning}
          spawnError={spawnError}
          onAdd={handleAdd}
          onRemove={handleRemove}
        />
      </div>
      <div style={{ flex: '7 0 0', position: 'relative', minWidth: 0 }}>
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
          position: 'absolute', top: 12, right: 16, zIndex: 10,
          color: '#fff', fontSize: 20, fontFamily: 'monospace',
          textShadow: '0 0 6px rgba(0,0,0,0.8)',
          pointerEvents: 'none',
        }}>
          {hh}:{mm}
        </div>
        <button
          onClick={() => exportWorldGLB().catch(console.error)}
          style={{
            position: 'absolute', bottom: 16, right: 16, zIndex: 10,
            padding: '6px 14px', fontSize: 13, borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer',
          }}
        >
          Export GLB
        </button>
        <WorldLayout style={{ width: '100%', height: '100%' }}>
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
      </div>
    </div>
  )
}
