import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface WorldEnvironmentProps {
  timeOfDay?: 'morning' | 'day' | 'evening' | 'night'
}

const TIME_CONFIG = {
  morning: {
    bgColor: '#FFB347',
    sunColor: '#ffcc88',
    sunIntensity: 0.8,
  },
  day: {
    bgColor: '#b0e0f6',
    sunColor: '#fff5e6',
    sunIntensity: 1.8,
  },
  evening: {
    bgColor: '#FF6B6B',
    sunColor: '#ff8866',
    sunIntensity: 0.6,
  },
  night: {
    bgColor: '#1a1a2e',
    sunColor: '#4466aa',
    sunIntensity: 0.3,
  },
} as const

export default function WorldEnvironment({
  timeOfDay = 'day',
}: WorldEnvironmentProps) {
  const { scene } = useThree()
  const config = TIME_CONFIG[timeOfDay]

  useLayoutEffect(() => {
    scene.background = new THREE.Color(config.bgColor)
  }, [scene, config.bgColor])

  return (
    <>
      <directionalLight
        color={config.sunColor}
        intensity={config.sunIntensity}
        position={[10, 20, 10]}
      />
      <ambientLight intensity={0.65} />
      <fog attach="fog" args={[config.bgColor, 30, 80]} />
    </>
  )
}
