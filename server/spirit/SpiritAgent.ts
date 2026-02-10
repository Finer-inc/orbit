import type { ToolCall, ToolResult, ObservationResult } from '../../src/types/world.ts'
import type { Tool } from '../tools/types.ts'
import type { ThinkingEngine } from './SpiritThinking.ts'

const MAX_RECENT_ACTIONS = 10

export class SpiritAgent {
  readonly id: string
  readonly name: string
  private recentActions: ToolCall[] = []
  private tools: Map<string, Tool>
  private thinking: ThinkingEngine

  constructor(
    id: string,
    name: string,
    tools: Map<string, Tool>,
    thinking: ThinkingEngine,
  ) {
    this.id = id
    this.name = name
    this.tools = tools
    this.thinking = thinking
  }

  async tick(): Promise<{ action: ToolCall | null; result: ToolResult | null }> {
    // 1. Call observe tool to get current situation
    const observeTool = this.tools.get('observe')
    if (!observeTool) {
      return { action: null, result: null }
    }

    const observeResult = await observeTool.execute(this.id, {})
    const observation = observeResult.data as ObservationResult

    // 2. Call thinking engine to decide next action
    const action = await this.thinking.decideNextAction(
      this.id,
      observation,
      this.recentActions,
    )

    if (!action) {
      return { action: null, result: null }
    }

    // 3. Execute the decided tool
    const tool = this.tools.get(action.name)
    if (!tool) {
      return {
        action,
        result: {
          success: false,
          data: null,
          message: `Unknown tool: ${action.name}`,
        },
      }
    }

    const result = await tool.execute(this.id, action.args)

    // 4. Keep last N actions in recentActions
    this.recentActions.push(action)
    if (this.recentActions.length > MAX_RECENT_ACTIONS) {
      this.recentActions = this.recentActions.slice(-MAX_RECENT_ACTIONS)
    }

    return { action, result }
  }
}
