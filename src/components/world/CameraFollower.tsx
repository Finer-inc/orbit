import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'

interface CameraFollowerProps {
  target: [number, number, number]
  enabled?: boolean
}

export default function CameraFollower({
  target,
  enabled = true,
}: CameraFollowerProps) {
  const { controls } = useThree()
  const targetVec = new THREE.Vector3()

  useFrame(() => {
    if (!enabled || !controls) return
    const orbitControls = controls as unknown as OrbitControlsType
    if (!orbitControls.target) return

    targetVec.set(target[0], target[1] + 1, target[2])
    orbitControls.target.lerp(targetVec, 0.1)
  })

  return null
}
