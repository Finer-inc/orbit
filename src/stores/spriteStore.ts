import type { SpriteData } from '../services/spriteLoader'

const store = new Map<string, SpriteData>()
let pending: SpriteData | null = null

export function setPending(data: SpriteData | null): void {
  // Dispose previous pending if overwritten
  if (pending && pending !== data) {
    disposeData(pending)
  }
  pending = data
}

export function getPending(): SpriteData | null {
  return pending
}

export function commitPending(agentId: string): void {
  if (pending) {
    store.set(agentId, pending)
    pending = null
  }
}

export function getSpriteData(agentId: string): SpriteData | undefined {
  return store.get(agentId)
}

export function disposeSpriteData(agentId: string): void {
  const data = store.get(agentId)
  if (data) {
    disposeData(data)
    store.delete(agentId)
  }
}

function disposeData(data: SpriteData): void {
  for (const tex of data.textures.values()) {
    tex.dispose()
  }
  for (const frames of data.animFrames.values()) {
    for (const f of frames) {
      f.texture.dispose()
    }
  }
}
