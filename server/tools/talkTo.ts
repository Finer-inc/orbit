import type { Tool } from './types.ts'
import type { ToolResult } from '../../src/types/world.ts'
import type { WorldServer } from '../world/WorldServer.ts'
import type { WorldStore } from '../store/MemoryStore.ts'

const TALK_RANGE = 5

export function createTalkToTool(world: WorldServer, store: WorldStore): Tool {
  return {
    definition: {
      name: 'talk_to',
      description: '近くの精霊に話しかける。対象が近くにいない場合は失敗する。',
      parameters: {
        targetSpiritId: {
          type: 'string',
          description: '話しかけたい精霊のID',
          required: true,
        },
        message: {
          type: 'string',
          description: '伝えたいメッセージ',
          required: true,
        },
      },
    },

    async execute(spiritId: string, args: Record<string, unknown>): Promise<ToolResult> {
      const targetSpiritId = args.targetSpiritId as string | undefined
      const message = args.message as string | undefined

      if (!targetSpiritId || typeof targetSpiritId !== 'string') {
        return {
          success: false,
          data: null,
          message: 'targetSpiritId パラメータが必要です。',
        }
      }

      if (!message || typeof message !== 'string') {
        return {
          success: false,
          data: null,
          message: 'message パラメータが必要です。',
        }
      }

      // Check if the target spirit is nearby
      const nearbySpirits = world.getNearbySpirits(spiritId, TALK_RANGE)
      const target = nearbySpirits.find((s) => s.id === targetSpiritId)

      if (!target) {
        return {
          success: false,
          data: { nearbySpirits: nearbySpirits.map((s) => s.id) },
          message: `${targetSpiritId} は近くにいないため話しかけられない。(会話可能範囲: ${TALK_RANGE})`,
        }
      }

      // Save the conversation
      store.saveConversation(spiritId, targetSpiritId, message, Date.now())

      return {
        success: true,
        data: { targetId: targetSpiritId, targetName: target.name, message },
        message: `${target.name}に「${message}」と話しかけた。`,
      }
    },
  }
}
