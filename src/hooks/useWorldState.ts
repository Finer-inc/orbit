import { useState, useEffect, useRef } from 'react'
import type { TimeOfDay } from '../types/world'

export type { TimeOfDay }

const TIME_POLL_INTERVAL = 30_000
const CLOCK_TICK_INTERVAL = 1_000

/** ゲーム内1日の実時間（分）— サーバーの DAY_LENGTH_MINUTES と合わせる */
const DAY_LENGTH_MINUTES = 24
const TIME_SCALE = (24 * 60) / DAY_LENGTH_MINUTES

export interface WorldState {
  timeOfDay: TimeOfDay
  hour: number
}

export function useWorldState(): WorldState {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day')
  const [hour, setHour] = useState(12)
  const syncRef = useRef<{ serverHour: number; fetchedAt: number } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>()
  const clockRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    const fetchTime = async () => {
      try {
        const res = await fetch('/api/world/time')
        if (res.ok) {
          const data: { timeOfDay: TimeOfDay; hour: number } = await res.json()
          setTimeOfDay(data.timeOfDay)
          syncRef.current = { serverHour: data.hour, fetchedAt: Date.now() }
          setHour(data.hour)
        }
      } catch {
        // Server not available yet
      }
    }

    fetchTime()
    pollRef.current = setInterval(fetchTime, TIME_POLL_INTERVAL)

    clockRef.current = setInterval(() => {
      if (!syncRef.current) return
      const elapsed = (Date.now() - syncRef.current.fetchedAt) / 3600000
      const h = (syncRef.current.serverHour + elapsed * TIME_SCALE) % 24
      setHour(h)
    }, CLOCK_TICK_INTERVAL)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (clockRef.current) clearInterval(clockRef.current)
    }
  }, [])

  return { timeOfDay, hour }
}
