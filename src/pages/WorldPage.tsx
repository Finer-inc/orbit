import { useEffect } from 'react'
import { WorldLayout } from '../layouts/WorldLayout'
import { useWorldState } from '../hooks/useWorldState'
import { useCharacter } from '../hooks/useCharacter'
import { useKeyboardControls } from '../hooks/useKeyboardControls'
import { useVision } from '../hooks/useVision'
import { useWorldObjectRegistration } from '../hooks/useWorldObjectRegistration'
import WorldEnvironment from '../components/world/WorldEnvironment'
import Ground from '../components/world/Ground'
import Fountain from '../components/world/Fountain'
import House from '../components/world/House'
import Trees from '../components/world/Trees'
import Character from '../components/world/Character'
import CameraFollower from '../components/world/CameraFollower'

declare global {
  interface Window {
    __seirei?: {
      character: import('../types/world').CharacterAPI
      vision: import('../types/world').VisionAPI
    }
  }
}

export function WorldPage() {
  const worldState = useWorldState()
  const { timeOfDay, houses, trees } = worldState

  const { state: characterState, stateRef, api: characterAPI } = useCharacter([5, 0, 5])
  useKeyboardControls(characterAPI)
  useWorldObjectRegistration(worldState)
  const visionAPI = useVision(stateRef)

  // コンソールAPI公開
  useEffect(() => {
    window.__seirei = {
      character: characterAPI,
      vision: visionAPI,
    }
    return () => { delete window.__seirei }
  }, [characterAPI, visionAPI])

  return (
    <WorldLayout>
      <WorldEnvironment timeOfDay={timeOfDay} />
      <Ground />
      <Fountain position={[0, 0, 0]} />
      {houses.map((house, i) => (
        <House key={i} {...house} />
      ))}
      <Trees trees={trees} />
      <Character
        position={characterState.position}
        rotationY={characterState.rotationY}
      />
      <CameraFollower target={characterState.position} />
    </WorldLayout>
  )
}
