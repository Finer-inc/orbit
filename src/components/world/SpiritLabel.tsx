import { Html } from '@react-three/drei'
import type { SpiritBehaviorState } from '../../types/world'

interface SpiritLabelProps {
  name: string
  lastSpeech?: string
  lastSpeechAt?: number
  state?: SpiritBehaviorState
  stamina?: number
  maxStamina?: number
}

const SPEECH_DISPLAY_DURATION = 10_000

const STATE_INDICATOR: Record<SpiritBehaviorState, string> = {
  idle: '',
  active: '',
  conversing: ' ...',
  resting: ' zzZ',
}

export default function SpiritLabel({
  name,
  lastSpeech,
  lastSpeechAt,
  state,
  stamina,
  maxStamina,
}: SpiritLabelProps) {
  const now = Date.now()
  const showSpeech = lastSpeech && lastSpeechAt && (now - lastSpeechAt) < SPEECH_DISPLAY_DURATION
  const stateIndicator = state ? STATE_INDICATOR[state] : ''
  const staminaRatio = (stamina != null && maxStamina) ? stamina / maxStamina : 1

  return (
    <Html
      position={[0, 2.8, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div style={containerStyle}>
        {showSpeech && (
          <div style={speechBubbleStyle}>
            {lastSpeech}
            <div style={speechArrowStyle} />
          </div>
        )}
        <div style={nameStyle}>
          {name}
          {stateIndicator && <span style={{ color: '#6cb4ff' }}>{stateIndicator}</span>}
        </div>
        {stamina != null && maxStamina != null && (
          <div style={staminaBarBgStyle}>
            <div style={{
              ...staminaBarFillStyle,
              width: `${Math.max(0, Math.min(100, staminaRatio * 100))}%`,
              backgroundColor: staminaRatio > 0.5 ? '#4ade80' : staminaRatio > 0.2 ? '#fbbf24' : '#ef4444',
            }} />
          </div>
        )}
      </div>
    </Html>
  )
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2px',
  whiteSpace: 'nowrap',
  transform: 'translate(-50%, -100%)',
}

const nameStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.6)',
  color: '#fff',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '13px',
  fontFamily: 'sans-serif',
  fontWeight: 'bold',
}

const speechBubbleStyle: React.CSSProperties = {
  position: 'relative',
  background: '#fff',
  color: '#333',
  padding: '4px 8px',
  borderRadius: '8px',
  fontSize: '9px',
  lineHeight: '1.3',
  fontFamily: 'sans-serif',
  width: 'max-content',
  maxWidth: '160px',
  whiteSpace: 'normal',
  textAlign: 'center',
  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
}

const speechArrowStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '-6px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '6px solid transparent',
  borderRight: '6px solid transparent',
  borderTop: '6px solid #fff',
}

const staminaBarBgStyle: React.CSSProperties = {
  width: '40px',
  height: '3px',
  background: 'rgba(0, 0, 0, 0.4)',
  borderRadius: '2px',
  overflow: 'hidden',
}

const staminaBarFillStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: '2px',
  transition: 'width 0.5s ease',
}
