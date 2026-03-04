import { useState, useEffect, useCallback } from 'react'

export type CameraMode = 'overhead' | 'tps'

export interface CameraModeState {
  mode: CameraMode
  selectedIndex: number
  toggleMode: () => void
  setSelectedIndex: (index: number) => void
}

export function useCameraMode(spiritCount: number): CameraModeState {
  const [mode, setMode] = useState<CameraMode>('overhead')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // spiritCount が減ったら範囲内に収める
  useEffect(() => {
    if (spiritCount > 0 && selectedIndex >= spiritCount) {
      setSelectedIndex(0)
    }
  }, [spiritCount, selectedIndex])

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'overhead' ? 'tps' : 'overhead'))
  }, [])

  // A/D キーでエージェント切替（TPSのみ）、V キーでモード切替
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // input/select にフォーカスがある場合は無視
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return

      if ((e.key === 'a' || e.key === 'A') && mode === 'tps') {
        if (spiritCount === 0) return
        setSelectedIndex((prev) => (prev - 1 + spiritCount) % spiritCount)
      } else if ((e.key === 'd' || e.key === 'D') && mode === 'tps') {
        if (spiritCount === 0) return
        setSelectedIndex((prev) => (prev + 1) % spiritCount)
      } else if (e.key === 'v' || e.key === 'V') {
        toggleMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [spiritCount, mode, toggleMode])

  return { mode, selectedIndex, toggleMode, setSelectedIndex }
}
