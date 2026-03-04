import type { AgentInfo } from '../../types/management'
import type { WorkspaceTabKey } from '../../types/management'
import SpiritAddForm from './SpiritAddForm'
import SpiritList from './SpiritList'

interface ControlPanelProps {
  agents: AgentInfo[]
  spawning: boolean
  spawnError: string | null
  onAdd: (name: string, workspace: Record<WorkspaceTabKey, string>) => void
  onRemove: (id: string) => void
}

export default function ControlPanel({
  agents,
  spawning,
  spawnError,
  onAdd,
  onRemove,
}: ControlPanelProps) {
  return (
    <div
      style={{
        height: '100%',
        padding: '12px 16px',
        background: 'rgba(15,15,25,0.95)',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflow: 'auto',
        boxSizing: 'border-box',
      }}
    >
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
        エージェント管理
        <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>
          ({agents.length})
        </span>
      </h3>
      <SpiritAddForm onSubmit={onAdd} disabled={spawning} error={spawnError} />
      <SpiritList agents={agents} onRemove={onRemove} />
    </div>
  )
}
