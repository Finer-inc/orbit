export interface ConversationEntry {
  fromId: string
  toId: string
  message: string
  timestamp: number
}

export interface ThoughtEntry {
  spiritId: string
  thought: string
  timestamp: number
}

export interface ActionEntry {
  spiritId: string
  action: string
  result: string
  timestamp: number
}

export interface WorldStore {
  saveConversation(fromId: string, toId: string, message: string, timestamp: number): void
  getConversations(spiritId: string, limit?: number): ConversationEntry[]
  saveThought(spiritId: string, thought: string, timestamp: number): void
  getThoughts(spiritId: string, limit?: number): ThoughtEntry[]
  saveAction(spiritId: string, action: string, result: string, timestamp: number): void
  getRecentActions(limit?: number): ActionEntry[]
}

const DEFAULT_LIMIT = 20

export class MemoryStore implements WorldStore {
  private conversations: ConversationEntry[] = []
  private thoughts: ThoughtEntry[] = []
  private actions: ActionEntry[] = []

  saveConversation(fromId: string, toId: string, message: string, timestamp: number): void {
    this.conversations.push({ fromId, toId, message, timestamp })
  }

  getConversations(spiritId: string, limit: number = DEFAULT_LIMIT): ConversationEntry[] {
    return this.conversations
      .filter((entry) => entry.fromId === spiritId || entry.toId === spiritId)
      .slice(-limit)
  }

  saveThought(spiritId: string, thought: string, timestamp: number): void {
    this.thoughts.push({ spiritId, thought, timestamp })
  }

  getThoughts(spiritId: string, limit: number = DEFAULT_LIMIT): ThoughtEntry[] {
    return this.thoughts
      .filter((entry) => entry.spiritId === spiritId)
      .slice(-limit)
  }

  saveAction(spiritId: string, action: string, result: string, timestamp: number): void {
    this.actions.push({ spiritId, action, result, timestamp })
  }

  getRecentActions(limit: number = DEFAULT_LIMIT): ActionEntry[] {
    return this.actions.slice(-limit)
  }
}
