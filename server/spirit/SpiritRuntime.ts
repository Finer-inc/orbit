import type { Logger } from '../cli/logger.ts'
import type { ToolCall } from '../../src/types/world.ts'
import { SpiritAgent } from './SpiritAgent.ts'
import { WorldServer } from '../world/WorldServer.ts'
import { createToolRegistry } from '../tools/registry.ts'
import { createStubThinking } from './SpiritThinking.ts'
import { MemoryStore } from '../store/MemoryStore.ts'

interface SpiritEntry {
  agent: SpiritAgent
  intervalId: ReturnType<typeof setInterval> | null
  thinkIntervalMs: number
  lastAction: string
}

export class SpiritRuntime {
  private world: WorldServer
  private logger: Logger
  private store: MemoryStore
  private spirits: Map<string, SpiritEntry> = new Map()
  private running: boolean = false

  constructor(world: WorldServer, logger: Logger) {
    this.world = world
    this.logger = logger
    this.store = new MemoryStore()
  }

  addSpirit(
    id: string,
    name: string,
    options?: {
      position?: [number, number, number]
      thinkIntervalMs?: number
    },
  ): void {
    const position: [number, number, number] = options?.position ?? [0, 0, 0]
    const thinkIntervalMs = options?.thinkIntervalMs ?? 5000

    // Register spirit in the world
    this.world.registerSpirit(id, name, position)

    // Create tools and thinking engine per spirit
    const tools = createToolRegistry(this.world, this.store)
    const thinking = createStubThinking()
    const agent = new SpiritAgent(id, name, tools, thinking)

    const entry: SpiritEntry = {
      agent,
      intervalId: null,
      thinkIntervalMs,
      lastAction: 'none',
    }

    this.spirits.set(id, entry)

    // If already running, start the interval immediately
    if (this.running) {
      this.startSpiritInterval(id, entry)
    }
  }

  removeSpirit(id: string): void {
    const entry = this.spirits.get(id)
    if (!entry) return

    if (entry.intervalId !== null) {
      clearInterval(entry.intervalId)
    }

    this.world.unregisterSpirit(id)
    this.spirits.delete(id)
  }

  start(): void {
    this.running = true

    for (const [id, entry] of this.spirits) {
      if (entry.intervalId === null) {
        this.startSpiritInterval(id, entry)
      }
    }
  }

  stop(): void {
    this.running = false

    for (const entry of this.spirits.values()) {
      if (entry.intervalId !== null) {
        clearInterval(entry.intervalId)
        entry.intervalId = null
      }
    }
  }

  getSnapshot(): {
    time: string
    spirits: { id: string; name: string; position: [number, number, number]; lastAction: string }[]
  } {
    const spiritList: { id: string; name: string; position: [number, number, number]; lastAction: string }[] = []

    for (const [id, entry] of this.spirits) {
      const state = this.world.getSpiritState(id)
      spiritList.push({
        id,
        name: entry.agent.name,
        position: state?.position ?? [0, 0, 0],
        lastAction: entry.lastAction,
      })
    }

    return {
      time: new Date().toISOString(),
      spirits: spiritList,
    }
  }

  private startSpiritInterval(id: string, entry: SpiritEntry): void {
    const runTick = async (): Promise<void> => {
      try {
        const { action, result } = await entry.agent.tick()

        if (action && result) {
          entry.lastAction = action.name
          const detail = formatActionDetail(action, result.message)
          this.logger.spiritAction(id, entry.agent.name, action.name, detail)
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        this.logger.error(`[${entry.agent.name}] tick error: ${message}`)
      }
    }

    entry.intervalId = setInterval(() => {
      void runTick()
    }, entry.thinkIntervalMs)
  }
}

function formatActionDetail(action: ToolCall, resultMessage: string): string {
  switch (action.name) {
    case 'observe':
      return resultMessage
    case 'move_to':
      return `-> ${String(action.args.target)} | ${resultMessage}`
    case 'talk_to':
      return `-> ${String(action.args.targetSpiritId)}: "${String(action.args.message)}"`
    case 'think':
      return `"${String(action.args.thought)}"`
    default:
      return resultMessage
  }
}
