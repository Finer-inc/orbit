import type { CameraMode } from '../../hooks/useCameraMode'

interface SpiritOption {
  id: string
  name: string
}

interface CameraHUDProps {
  spirits: SpiritOption[]
  selectedIndex: number
  mode: CameraMode
  onSelectIndex: (index: number) => void
  onToggleMode: () => void
}

export default function CameraHUD({ spirits, selectedIndex, mode, onSelectIndex, onToggleMode }: CameraHUDProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 12,
      left: 16,
      zIndex: 10,
      display: 'flex',
      gap: 8,
      alignItems: 'center',
    }}>
      <button
        onClick={onToggleMode}
        style={{
          padding: '4px 12px',
          fontSize: 14,
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.3)',
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {mode === 'overhead' ? '\u2713 Overview' : '\u2713 TPS'}
      </button>
      {mode === 'tps' && (
        <select
          value={selectedIndex}
          onChange={(e) => onSelectIndex(Number(e.target.value))}
          style={{
            padding: '4px 8px',
            fontSize: 14,
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {spirits.map((s, i) => (
            <option key={s.id} value={i}>{s.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
