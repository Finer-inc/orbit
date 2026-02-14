import { useState, useEffect, useRef } from 'react'
import type { TimeOfDay } from '../types/world'

export type { TimeOfDay }

const TIME_POLL_INTERVAL = 30_000
const CLOCK_TICK_INTERVAL = 1_000

function hourToTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 6 && hour < 10) return 'morning'
  if (hour >= 10 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'evening'
  return 'night'
}

export interface WorldState {
  timeOfDay: TimeOfDay
  hour: number
}

export function useWorldState(): WorldState {
  const [hour, setHour] = useState(12)
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day')
  const syncRef = useRef<{ serverHour: number; fetchedAt: number; timeScale: number } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval>>()
  const clockRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    const fetchTime = async () => {
      try {
        const res = await fetch('/api/world/time')
        if (res.ok) {
          const data: { timeOfDay: TimeOfDay; hour: number; timeScale: number } = await res.json()
          syncRef.current = { serverHour: data.hour, fetchedAt: Date.now(), timeScale: data.timeScale }
          setHour(data.hour)
          setTimeOfDay(data.timeOfDay)
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
      const h = (syncRef.current.serverHour + elapsed * syncRef.current.timeScale) % 24
      setHour(h)
      setTimeOfDay(hourToTimeOfDay(h))
    }, CLOCK_TICK_INTERVAL)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (clockRef.current) clearInterval(clockRef.current)
    }
  }, [])

  return { timeOfDay, hour }
}
