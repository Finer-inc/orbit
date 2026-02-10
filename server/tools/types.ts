import type { ToolDefinition, ToolResult } from '../../src/types/world.ts'

export interface Tool {
  definition: ToolDefinition
  execute(spiritId: string, args: Record<string, unknown>): Promise<ToolResult>
}
