import type { ToolCall, ObservationResult } from '../../src/types/world.ts'

export interface ThinkingEngine {
  decideNextAction(
    spiritId: string,
    observation: ObservationResult,
    recentActions: ToolCall[],
  ): Promise<ToolCall | null>
}

const GREETINGS = [
  'こんにちは！今日はいい天気ですね。',
  'やあ、元気にしてた？',
  'おーい！一緒に散歩しない？',
  'ここで会えるなんて嬉しいな。',
  'さっきから気になってたんだけど、何してるの？',
  'ねえねえ、あっちに面白いものがあったよ！',
]

const TIME_THOUGHTS: Record<string, string[]> = {
  morning: [
    '朝の空気は気持ちいいな。',
    '今日はどんなことがあるかな。',
  ],
  day: [
    '太陽が眩しいな。',
    'お昼時だ、のんびりしよう。',
  ],
  evening: [
    '夕焼けが綺麗だな。',
    'そろそろ日が暮れるね。',
  ],
  night: [
    '星が綺麗に見えるな。',
    '夜は静かで落ち着く。',
  ],
}

const OBJECT_THOUGHTS: Record<string, string[]> = {
  fountain: ['噴水の音が心地いいな。', 'あの噴水に近づいてみよう。'],
  house: ['あの家はどんな人が住んでるんだろう。', '家の近くは落ち着くな。'],
  tree: ['あの木は大きいな。', '木陰で休むのもいいかも。'],
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomCoord(): number {
  return Math.round((Math.random() * 30 - 15) * 10) / 10
}

export function createStubThinking(): ThinkingEngine {
  return {
    async decideNextAction(
      _spiritId: string,
      observation: ObservationResult,
      recentActions: ToolCall[],
    ): Promise<ToolCall | null> {
      const lastAction = recentActions.length > 0
        ? recentActions[recentActions.length - 1]
        : null

      // 1. If last action was NOT observe, always observe first
      if (!lastAction || lastAction.name !== 'observe') {
        return { name: 'observe', args: {} }
      }

      // 2. If nearby spirits exist, 50% chance to talk_to a random one
      if (observation.spirits.length > 0 && Math.random() < 0.5) {
        const target = randomItem(observation.spirits)
        return {
          name: 'talk_to',
          args: {
            targetSpiritId: target.id,
            message: randomItem(GREETINGS),
          },
        }
      }

      // 3. 20% chance to think
      if (Math.random() < 0.2) {
        // Pick a thought based on context
        let thought: string

        // If there are visible objects, sometimes think about them
        if (observation.objects.length > 0 && Math.random() < 0.5) {
          const obj = randomItem(observation.objects)
          const objThoughts = OBJECT_THOUGHTS[obj.type]
          thought = objThoughts ? randomItem(objThoughts) : `あの${obj.type}が気になるな。`
        } else {
          // Think about the time of day
          const timeThoughts = TIME_THOUGHTS[observation.timeOfDay]
          thought = timeThoughts ? randomItem(timeThoughts) : 'ふーむ、何をしようかな。'
        }

        return { name: 'think', args: { thought } }
      }

      // 4. If visible objects exist, move_to a random one
      if (observation.objects.length > 0) {
        const target = randomItem(observation.objects)
        return { name: 'move_to', args: { target: target.id } }
      }

      // 5. Otherwise, move_to random coordinates
      const x = randomCoord()
      const z = randomCoord()
      return { name: 'move_to', args: { target: `${x},${z}` } }
    },
  }
}
