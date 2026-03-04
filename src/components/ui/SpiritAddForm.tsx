import { useState } from 'react'
import { WORKSPACE_TABS, type WorkspaceTabKey } from '../../types/management'

const defaultWorkspace = (): Record<WorkspaceTabKey, string> =>
  Object.fromEntries(WORKSPACE_TABS.map(t => [t.key, t.defaultValue])) as Record<WorkspaceTabKey, string>

interface SpiritAddFormProps {
  onSubmit: (name: string, workspace: Record<WorkspaceTabKey, string>) => void
  disabled: boolean
  error: string | null
}

export default function SpiritAddForm({ onSubmit, disabled, error }: SpiritAddFormProps) {
  const [name, setName] = useState('')
  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>('identity')
  const [workspace, setWorkspace] = useState<Record<WorkspaceTabKey, string>>(defaultWorkspace)

  const handleFieldChange = (value: string) => {
    setWorkspace(prev => ({ ...prev, [activeTab]: value }))
  }

  const handleSubmit = () => {
    onSubmit(name.trim(), workspace)
    setName('')
    setWorkspace(defaultWorkspace())
    setActiveTab('identity')
  }

  const activeTabDef = WORKSPACE_TABS.find(t => t.key === activeTab)!

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="名前（空欄で自動生成）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 10px',
            fontSize: 14,
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.4)',
            color: '#fff',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled}
          style={{
            padding: '6px 16px',
            fontSize: 14,
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.3)',
            background: disabled ? 'rgba(0,0,0,0.2)' : 'rgba(60,120,200,0.6)',
            color: '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {disabled ? '追加中...' : 'エージェントを追加'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.2)', flexWrap: 'wrap' }}>
        {WORKSPACE_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #6b9fff' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <textarea
        placeholder={activeTabDef.placeholder}
        value={workspace[activeTab]}
        onChange={(e) => handleFieldChange(e.target.value)}
        rows={5}
        style={{
          width: '100%',
          padding: '6px 10px',
          fontSize: 13,
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.3)',
          background: 'rgba(0,0,0,0.4)',
          color: '#fff',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'monospace',
          boxSizing: 'border-box',
        }}
      />

      {error && (
        <div style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</div>
      )}
    </div>
  )
}
