import { useEffect } from 'react'
import type { CharacterAPI } from '../types/world'

export function useKeyboardControls(api: CharacterAPI): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
          api.moveForward(0.3)
          break
        case 's':
          api.moveForward(-0.3)
          break
        case 'a':
          api.rotate(-0.05)
          break
        case 'd':
          api.rotate(0.05)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [api])
}
