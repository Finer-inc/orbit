import { useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import type { PointLight } from 'three'
import type { TimeOfDay } from '../../types/world'

const GLB_PATH = '/worlds/seirei-world.glb'

interface WorldGLBProps {
  timeOfDay: TimeOfDay
}

export default function WorldGLB({ timeOfDay }: WorldGLBProps) {
  const { scene } = useGLTF(GLB_PATH)

  useEffect(() => {
    const lightIntensity = timeOfDay === 'night' ? 8 : timeOfDay === 'evening' ? 3 : 0
    scene.traverse((child) => {
      if (child.name.startsWith('col_')) {
        child.visible = false
      }
      if (child.name.startsWith('light_') && (child as PointLight).isLight) {
        const light = child as PointLight
        light.intensity = lightIntensity
        light.distance = 15
        light.decay = 2
      }
    })
  }, [scene, timeOfDay])

  return <primitive object={scene} />
}

useGLTF.preload(GLB_PATH)
