import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { ReactNode } from 'react'

interface WorldLayoutProps {
  children: ReactNode
}

export function WorldLayout({ children }: WorldLayoutProps) {
  return (
    <Canvas
      camera={{ position: [15, 12, 15], fov: 60 }}
      style={{ width: '100vw', height: '100vh' }}
    >
      {children}
      <OrbitControls
        makeDefault
        target={[0, 1, 0]}
        minDistance={5}
        maxDistance={40}
      />
    </Canvas>
  )
}
