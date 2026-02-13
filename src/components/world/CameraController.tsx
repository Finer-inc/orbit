import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import type { CameraMode } from '../../hooks/useCameraMode'

interface CameraControllerProps {
  targetPosition: [number, number, number]
  targetRotationY: number
  mode: CameraMode
}

// 俯瞰モード: 南東上空からの固定方向
const OVERHEAD_DIRECTION = new THREE.Vector3(0, 8, 12).normalize()

// TPS モード: 精霊の背後オフセット（ローカル座標）
const TPS_OFFSET = new THREE.Vector3(0, 3, -6)
const TPS_LOOK_HEIGHT = 1.5

const LERP_SPEED = 0.05

// ユーザー操作後、カメラ角度の自動復帰を待つ時間（ms）
const TPS_RETURN_DELAY = 10_000

export default function CameraController({ targetPosition, targetRotationY, mode }: CameraControllerProps) {
  const { camera, controls } = useThree()
  const targetVec = useRef(new THREE.Vector3())
  const cameraGoal = useRef(new THREE.Vector3())
  const offsetWorld = useRef(new THREE.Vector3())
  const lastUserInteraction = useRef(0)

  // OrbitControls の操作を検知して時刻を記録
  useEffect(() => {
    if (!controls) return
    const orbitControls = controls as unknown as OrbitControlsType
    const onStart = () => { lastUserInteraction.current = Date.now() }
    orbitControls.addEventListener('start', onStart)
    return () => { orbitControls.removeEventListener('start', onStart) }
  }, [controls])

  useFrame(() => {
    if (!controls) return
    const orbitControls = controls as unknown as OrbitControlsType
    if (!orbitControls.target) return

    const [tx, ty, tz] = targetPosition

    if (mode === 'overhead') {
      // 注視点: 精霊の少し上
      targetVec.current.set(tx, ty + 1, tz)
      orbitControls.target.lerp(targetVec.current, LERP_SPEED)

      // カメラ位置: 方向は固定、距離はユーザー操作を尊重
      const currentDist = camera.position.distanceTo(orbitControls.target)
      cameraGoal.current.copy(OVERHEAD_DIRECTION).multiplyScalar(currentDist).add(targetVec.current)
      camera.position.lerp(cameraGoal.current, LERP_SPEED)
    } else {
      // 注視点は常に精霊に追従（位置だけは追う）
      targetVec.current.set(tx, ty + TPS_LOOK_HEIGHT, tz)
      orbitControls.target.lerp(targetVec.current, LERP_SPEED)

      // カメラ角度の自動復帰: ユーザー操作後10秒待つ
      const elapsed = Date.now() - lastUserInteraction.current
      if (elapsed < TPS_RETURN_DELAY) return

      // ローカルオフセットをrotationYで回転してワールド座標に変換
      const cosR = Math.cos(targetRotationY)
      const sinR = Math.sin(targetRotationY)
      offsetWorld.current.set(
        TPS_OFFSET.x * cosR + TPS_OFFSET.z * sinR,
        TPS_OFFSET.y,
        -TPS_OFFSET.x * sinR + TPS_OFFSET.z * cosR,
      )

      // カメラ目標位置
      cameraGoal.current.set(
        tx + offsetWorld.current.x,
        ty + offsetWorld.current.y,
        tz + offsetWorld.current.z,
      )
      camera.position.lerp(cameraGoal.current, LERP_SPEED)
    }
  })

  return null
}
