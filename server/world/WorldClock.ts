import type { TimeOfDay } from '../../src/types/world.ts'

/** ゲーム内1日の実時間（分）— コンストラクタ時に読み込み */
function getDayLengthMinutes(): number {
  return Number(process.env.DAY_LENGTH_MINUTES) || 24
}

export class WorldClock {
  private startedAt: number
  private timeScale: number
  private forcedHour: number | null = null

  constructor(dayLengthMinutes: number = getDayLengthMinutes()) {
    this.startedAt = Date.now()
    // 実時間 dayLengthMinutes 分 = ゲーム内24時間 → timeScale = 24*60 / dayLengthMinutes
    this.timeScale = (24 * 60) / dayLengthMinutes
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

  getTimeScale(): number {
    return this.timeScale
  }

  setHour(hour: number): void {
    this.forcedHour = ((hour % 24) + 24) % 24
  }
}
