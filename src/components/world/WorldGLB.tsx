import { useEffect } from 'react'
import { useGLTF } from '@react-three/drei'

const GLB_PATH = '/worlds/seirei-world.glb'

export default function WorldGLB() {
  const { scene } = useGLTF(GLB_PATH)

  useEffect(() => {
    scene.traverse((child) => {
      // col_* メッシュは非表示
      if (child.name.startsWith('col_')) {
        child.visible = false
      }
    })
  }, [scene])

  return <primitive object={scene} />
}

useGLTF.preload(GLB_PATH)
