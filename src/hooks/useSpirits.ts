import { useState, useEffect, useRef } from 'react'
import type { SpiritState } from '../types/world'

const POLL_INTERVAL = 2000

export function useSpirits(): SpiritState[] {
  const [spirits, setSpirits] = useState<SpiritState[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    const fetchSpirits = async () => {
      try {
        const res = await fetch('/api/spirits')
        if (res.ok) {
          const data: SpiritState[] = await res.json()
          setSpirits(data)
        }
      } catch {
        // Server not available yet, keep polling
      }
    }

    fetchSpirits()
    intervalRef.current = setInterval(fetchSpirits, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return spirits
}
