import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'

interface CameraFollowerProps {
  getTarget: () => [number, number, number]
}

// カメラ方向（正規化）: 南側（+Z）から北を向く、やや上から
const CAMERA_DIRECTION = new THREE.Vector3(0, 8, 12).normalize()

export default function CameraFollower({ getTarget }: CameraFollowerProps) {
  const { camera, controls } = useThree()
  const targetVec = new THREE.Vector3()
  const cameraGoal = new THREE.Vector3()

  useFrame(() => {
    if (!controls) return
    const orbitControls = controls as unknown as OrbitControlsType
    if (!orbitControls.target) return

    // 毎フレーム補間済みの位置を取得
    const target = getTarget()

    // 注視点: キャラの少し上
    targetVec.set(target[0], target[1] + 1, target[2])
    orbitControls.target.lerp(targetVec, 0.05)

    // 現在のカメラ距離（ユーザーのズームを保持）
    const currentDist = camera.position.distanceTo(orbitControls.target)

    // カメラ位置: 方向は固定、距離はユーザー操作を尊重
    cameraGoal.copy(CAMERA_DIRECTION).multiplyScalar(currentDist).add(targetVec)
    camera.position.lerp(cameraGoal, 0.05)
  })

  return null
}
