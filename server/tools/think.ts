import type { Tool } from './types.ts'
import type { ToolResult } from '../../src/types/world.ts'
import type { WorldStore } from '../store/MemoryStore.ts'

export function createThinkTool(store: WorldStore): Tool {
  return {
    definition: {
      name: 'think',
      description: '考えを整理する。思考内容は記録され、後で振り返ることができる。',
      parameters: {
        thought: {
          type: 'string',
          description: '考えた内容',
          required: true,
        },
      },
    },

    async execute(spiritId: string, args: Record<string, unknown>): Promise<ToolResult> {
      const thought = args.thought as string | undefined

      if (!thought || typeof thought !== 'string') {
        return {
          success: false,
          data: null,
          message: 'thought パラメータが必要です。',
        }
      }

      store.saveThought(spiritId, thought, Date.now())

      return {
        success: true,
        data: { thought },
        message: `考えた: 「${thought}」`,
      }
    },
  }
}
