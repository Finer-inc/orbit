import { useState } from 'react'
import type { AgentInfo } from '../../types/management'
import { WORKSPACE_TABS } from '../../types/management'

interface SpiritListProps {
  agents: AgentInfo[]
  onRemove: (id: string) => void
}

export default function SpiritList({ agents, onRemove }: SpiritListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (agents.length === 0) {
    return (
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, padding: '8px 0' }}>
        稼働中のエージェントはいません
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {agents.map((agent) => (
        <div key={agent.id}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 8px',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.05)',
              cursor: 'pointer',
            }}
            onClick={() => setExpandedId(expandedId === agent.id ? null : agent.id)}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: agent.color,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, fontSize: 14, color: '#fff' }}>
              {agent.name}
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginLeft: 8 }}>
                {expandedId === agent.id ? '▼' : '▶'} {agent.id}
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(agent.id) }}
              style={{
                padding: '2px 10px',
                fontSize: 12,
                borderRadius: 4,
                border: '1px solid rgba(255,100,100,0.4)',
                background: 'rgba(200,50,50,0.3)',
                color: '#ff9999',
                cursor: 'pointer',
              }}
            >
              削除
            </button>
          </div>

          {expandedId === agent.id && agent.workspace && (
            <div style={{
              padding: '8px 12px',
              marginLeft: 20,
              fontSize: 12,
              color: 'rgba(255,255,255,0.7)',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 4,
              marginTop: 2,
            }}>
              {WORKSPACE_TABS.map(tab => {
                const value = agent.workspace[tab.key]
                if (!value) return null
                return (
                  <div key={tab.key} style={{ marginBottom: 6 }}>
                    <div style={{ color: '#6b9fff', fontWeight: 600, fontSize: 11 }}>{tab.label}</div>
                    <div style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>{value}</div>
                  </div>
                )
              })}
              {Object.values(agent.workspace).every(v => !v) && (
                <div style={{ color: 'rgba(255,255,255,0.3)' }}>（ランダム生成）</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
