import type { TimeOfDay } from '../../src/types/world.ts'

export class WorldClock {
  private startedAt: number
  private timeScale: number
  private forcedHour: number | null = null

  constructor(timeScale: number = 60) {
    this.startedAt = Date.now()
    this.timeScale = timeScale
  }

  getHour(): number {
    if (this.forcedHour !== null) {
      return this.forcedHour
    }
    return ((Date.now() - this.startedAt) * this.timeScale / 3600000) % 24
  }

  getTimeOfDay(): TimeOfDay {
    const hour = this.getHour()
    if (hour >= 6 && hour < 10) return 'morning'
    if (hour >= 10 && hour < 17) return 'day'
    if (hour >= 17 && hour < 20) return 'evening'
    return 'night'
  }

  setHour(hour: number): void {
    this.forcedHour = ((hour % 24) + 24) % 24
  }
}
