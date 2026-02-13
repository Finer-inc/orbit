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
  houses: {
    position: [number, number, number]
    rotation: [number, number, number]
    wallColor?: string
    roofColor?: string
  }[]
  trees: {
    position: [number, number, number]
    scale?: number
    trunkColor?: string
    leafColor?: string
  }[]
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

  return {
    timeOfDay,
    hour,
    houses: [
      // 広場1周辺
      { position: [-10, 0, -5], rotation: [0, Math.PI / 4, 0] as [number, number, number] },
      { position: [-10, 0, 6], rotation: [0, -Math.PI / 6, 0] as [number, number, number] },
      // 広場2周辺
      { position: [28, 0, -5], rotation: [0, -Math.PI / 4, 0] as [number, number, number], wallColor: '#d4c5a9' },
      { position: [28, 0, 6], rotation: [0, Math.PI / 6, 0] as [number, number, number] },
    ],
    trees: [
      // 広場1周辺
      { position: [-6, 0, 10], scale: 1.2 },
      { position: [-14, 0, 3], scale: 1.0 },
      { position: [-8, 0, -12], scale: 0.8 },
      { position: [0, 0, -14], scale: 1.0 },
      { position: [-3, 0, 12], scale: 0.7 },
      // 広場間
      { position: [9, 0, 6], scale: 0.9 },
      { position: [9, 0, -6], scale: 1.1 },
      // 広場2周辺
      { position: [24, 0, 10], scale: 1.2 },
      { position: [18, 0, -14], scale: 1.0 },
      { position: [32, 0, 3], scale: 1.0 },
      { position: [26, 0, -12], scale: 0.8 },
      { position: [21, 0, 12], scale: 0.7 },
      { position: [12, 0, 10], scale: 1.3 },
    ],
  }
}
