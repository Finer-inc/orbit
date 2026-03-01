import { Sky } from '@react-three/drei'

interface WorldEnvironmentProps {
  timeOfDay?: 'morning' | 'day' | 'evening' | 'night'
}

const TIME_CONFIG = {
  morning: {
    sunPosition: [100, 10, 0] as [number, number, number],
    sunColor: '#ffcc88',
    sunIntensity: 0.8,
    ambientIntensity: 0.5,
    fogColor: '#FFB347',
    turbidity: 4,
    rayleigh: 2,
  },
  day: {
    sunPosition: [50, 80, 50] as [number, number, number],
    sunColor: '#fff5e6',
    sunIntensity: 1.8,
    ambientIntensity: 0.65,
    fogColor: '#b0e0f6',
    turbidity: 8,
    rayleigh: 0.5,
  },
  evening: {
    sunPosition: [-100, 5, 0] as [number, number, number],
    sunColor: '#ff8866',
    sunIntensity: 0.6,
    ambientIntensity: 0.4,
    fogColor: '#FF6B6B',
    turbidity: 10,
    rayleigh: 3,
  },
  night: {
    sunPosition: [0, -20, 0] as [number, number, number],
    sunColor: '#4466aa',
    sunIntensity: 0.3,
    ambientIntensity: 0.2,
    fogColor: '#1a1a2e',
    turbidity: 20,
    rayleigh: 0,
  },
} as const

export default function WorldEnvironment({
  timeOfDay = 'day',
}: WorldEnvironmentProps) {
  const config = TIME_CONFIG[timeOfDay]

  return (
    <>
      <Sky
        sunPosition={config.sunPosition}
        turbidity={config.turbidity}
        rayleigh={config.rayleigh}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      <directionalLight
        color={config.sunColor}
        intensity={config.sunIntensity}
        position={config.sunPosition}
        castShadow
      />
      <ambientLight intensity={config.ambientIntensity} />
      {/* <fog attach="fog" args={[config.fogColor, 80, 250]} /> */}
    </>
  )
}
