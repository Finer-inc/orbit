import type { Tool } from './types.ts'
import type { ToolResult } from '../../src/types/world.ts'
import type { WorldServer } from '../world/WorldServer.ts'

function parseCoordinates(target: string): { x: number; z: number } | null {
  const parts = target.split(',')
  if (parts.length !== 2) return null

  const x = Number(parts[0].trim())
  const z = Number(parts[1].trim())

  if (Number.isNaN(x) || Number.isNaN(z)) return null
  return { x, z }
}

export function createMoveToTool(world: WorldServer): Tool {
  return {
    definition: {
      name: 'move_to',
      description: '指定した場所に移動する。オブジェクトID（例: "fountain-0"）または座標（例: "5,3"）を指定できる。',
      parameters: {
        target: {
          type: 'string',
          description: '移動先。オブジェクトID（例: "fountain-0"）または "x,z" 形式の座標',
          required: true,
        },
      },
    },

    async execute(spiritId: string, args: Record<string, unknown>): Promise<ToolResult> {
      const target = args.target as string | undefined
      if (!target || typeof target !== 'string') {
        return {
          success: false,
          data: null,
          message: 'target パラメータが必要です。',
        }
      }

      // First, try to look up as an object ID
      const obj = world.getObjectById(target)
      if (obj) {
        const result = world.moveSpirit(spiritId, obj.position[0], obj.position[2])
        return {
          success: result.success,
          data: { position: result.newPosition, targetObject: obj.id },
          message: `${obj.type}(${obj.id})に向かって移動した。現在位置: (${result.newPosition[0].toFixed(1)}, ${result.newPosition[2].toFixed(1)})`,
        }
      }

      // Try parsing as "x,z" coordinates
      const coords = parseCoordinates(target)
      if (coords) {
        const result = world.moveSpirit(spiritId, coords.x, coords.z)
        return {
          success: result.success,
          data: { position: result.newPosition },
          message: `座標(${coords.x}, ${coords.z})に向かって移動した。現在位置: (${result.newPosition[0].toFixed(1)}, ${result.newPosition[2].toFixed(1)})`,
        }
      }

      return {
        success: false,
        data: null,
        message: `"${target}" はオブジェクトIDとして見つからず、座標としても解析できませんでした。`,
      }
    },
  }
}
