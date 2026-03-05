import { useState, useEffect, useRef, useCallback } from 'react'
import type { AgentInfo, SpawnRequest, SpawnResult } from '../types/management'

const POLL_INTERVAL = 3000

export function useAgentManager() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [spawning, setSpawning] = useState(false)
  const [spawnError, setSpawnError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const fetchAgents = useCallback(async () => {
    const res = await fetch('/mgmt/agents')
    if (res.ok) {
      const data: AgentInfo[] = await res.json()
      setAgents(data)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
    intervalRef.current = setInterval(fetchAgents, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchAgents])

  const spawnAgent = useCallback(async (req: SpawnRequest): Promise<SpawnResult> => {
    setSpawning(true)
    setSpawnError(null)
    const res = await fetch('/mgmt/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    setSpawning(false)
    if (!res.ok) {
      const text = await res.text()
      setSpawnError(text)
      throw new Error(text)
    }
    const result: SpawnResult = await res.json()
    await fetchAgents()
    return result
  }, [fetchAgents])

  const despawnAgent = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/mgmt/agents/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text)
    }
    await fetchAgents()
  }, [fetchAgents])

  return { agents, spawning, spawnError, spawnAgent, despawnAgent }
}
