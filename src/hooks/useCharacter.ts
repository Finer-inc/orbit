import { useState, useRef, useMemo } from 'react'
import type { CharacterState, CharacterAPI } from '../types/world'

export function useCharacter(
  initialPosition: [number, number, number] = [5, 0, 5],
): { state: CharacterState; stateRef: React.RefObject<CharacterState>; api: CharacterAPI } {
  const [state, setState] = useState<CharacterState>({
    position: initialPosition,
    rotationY: 0,
  })

  const stateRef = useRef(state)
  stateRef.current = state

  const api = useMemo<CharacterAPI>(() => ({
    moveTo(x: number, z: number) {
      const cur = stateRef.current
      const dx = x - cur.position[0]
      const dz = z - cur.position[2]
      const rotationY = Math.atan2(dx, dz)
      setState({ position: [x, 0, z], rotationY })
    },

    moveForward(distance: number) {
      const cur = stateRef.current
      const x = cur.position[0] + Math.sin(cur.rotationY) * distance
      const z = cur.position[2] + Math.cos(cur.rotationY) * distance
      setState({ position: [x, 0, z], rotationY: cur.rotationY })
    },

    rotate(angle: number) {
      const cur = stateRef.current
      setState({ ...cur, rotationY: cur.rotationY + angle })
    },

    setPosition(x: number, z: number) {
      const cur = stateRef.current
      setState({ ...cur, position: [x, 0, z] })
    },

    getPosition(): [number, number, number] {
      return [...stateRef.current.position]
    },

    getRotation(): number {
      return stateRef.current.rotationY
    },
  }), [])

  return { state, stateRef, api }
}
