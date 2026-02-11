import { useState, useEffect, useCallback } from 'react'

/**
 * A/Dキーまたはボタンで追従対象のインデックスを切り替えるフック
 */
export function useCameraTarget(count: number) {
  const [index, setIndex] = useState(0)

  // count が減ったら範囲内に収める
  useEffect(() => {
    if (count > 0 && index >= count) {
      setIndex(0)
    }
  }, [count, index])

  const prev = useCallback(() => {
    if (count === 0) return
    setIndex((prev) => (prev - 1 + count) % count)
  }, [count])

  const next = useCallback(() => {
    if (count === 0) return
    setIndex((prev) => (prev + 1) % count)
  }, [count])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'a' || e.key === 'A') prev()
    else if (e.key === 'd' || e.key === 'D') next()
  }, [prev, next])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { index, prev, next }
}
