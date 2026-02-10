import type { Tool } from './types.ts'
import type { ToolDefinition } from '../../src/types/world.ts'
import type { WorldServer } from '../world/WorldServer.ts'
import type { WorldStore } from '../store/MemoryStore.ts'
import { createObserveTool } from './observe.ts'
import { createMoveToTool } from './moveTo.ts'
import { createTalkToTool } from './talkTo.ts'
import { createThinkTool } from './think.ts'

export function createToolRegistry(world: WorldServer, store: WorldStore): Map<string, Tool> {
  const registry = new Map<string, Tool>()

  const tools: Tool[] = [
    createObserveTool(world),
    createMoveToTool(world),
    createTalkToTool(world, store),
    createThinkTool(store),
  ]

  for (const tool of tools) {
    registry.set(tool.definition.name, tool)
  }

  return registry
}

export function getToolDefinitions(registry: Map<string, Tool>): ToolDefinition[] {
  const definitions: ToolDefinition[] = []
  for (const tool of registry.values()) {
    definitions.push(tool.definition)
  }
  return definitions
}
