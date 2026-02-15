import type { Tool } from './types.ts'
import type { ToolResult, VisibleObject, NearbySpiritInfo } from '../../src/types/world.ts'
import type { WorldServer } from '../world/WorldServer.ts'

function formatDistance(d: number): string {
  return d.toFixed(1)
}

function formatObjects(objects: VisibleObject[]): string {
  if (objects.length === 0) return '周囲に目立つものは見えない。'

  const parts: string[] = []
  for (const obj of objects) {
    parts.push(`${obj.name}(${obj.id}, 距離${formatDistance(obj.distance)})`)
  }

  return parts.join('、') + 'が見える。'
}

function formatSpirits(spirits: NearbySpiritInfo[]): string {
  if (spirits.length === 0) return ''
  const parts = spirits.map(
    (s) => `${s.name}という精霊が近くにいる(距離${formatDistance(s.distance)})`,
  )
  return parts.join('。') + '。'
}

function formatTimeOfDay(timeOfDay: string): string {
  switch (timeOfDay) {
    case 'morning': return '今は朝だ。'
    case 'day': return '今は昼間だ。'
    case 'evening': return '今は夕方だ。'
    case 'night': return '今は夜だ。'
    default: return ''
  }
}

export function createObserveTool(world: WorldServer): Tool {
  return {
    definition: {
      name: 'observe',
      description: '周囲を観察して、見えるオブジェクトや近くの精霊、時間帯を確認する。',
      parameters: {},
    },

    async execute(spiritId: string, _args: Record<string, unknown>): Promise<ToolResult> {
      const observation = world.observe(spiritId)

      const objectsText = formatObjects(observation.objects)
      const spiritsText = formatSpirits(observation.spirits)
      const timeText = formatTimeOfDay(observation.timeOfDay)

      const message = [objectsText, spiritsText, timeText].filter(Boolean).join('')

      return {
        success: true,
        data: observation,
        message,
      }
    },
  }
}
