// ANSI-colored CLI logger for spirit actions

export interface Logger {
  spiritAction(spiritId: string, spiritName: string, action: string, detail: string): void
  worldEvent(event: string): void
  status(spirits: { id: string; name: string; position: [number, number, number] }[]): void
  error(message: string): void
}

const RESET = '\x1b[0m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'
const MAGENTA = '\x1b[35m'
const CYAN = '\x1b[36m'
const DIM = '\x1b[2m'

const ACTION_COLORS: Record<string, string> = {
  observe: CYAN,
  move_to: GREEN,
  talk_to: MAGENTA,
  think: BLUE,
}

function timestamp(): string {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function createConsoleLogger(): Logger {
  return {
    spiritAction(_spiritId: string, spiritName: string, action: string, detail: string): void {
      const color = ACTION_COLORS[action] ?? DIM
      const ts = timestamp()
      console.log(`${DIM}${ts}${RESET} ${color}[${spiritName}]${RESET} ${color}${action}${RESET} ${detail}`)
    },

    worldEvent(event: string): void {
      console.log(`${YELLOW}>>> ${event}${RESET}`)
    },

    status(spirits: { id: string; name: string; position: [number, number, number] }[]): void {
      console.log(`${DIM}--- World Status ---${RESET}`)
      for (const s of spirits) {
        const [x, y, z] = s.position
        console.log(`  ${s.name} (${s.id}) pos=(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`)
      }
    },

    error(message: string): void {
      console.log(`${RED}[ERROR] ${message}${RESET}`)
    },
  }
}
