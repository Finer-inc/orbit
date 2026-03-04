import { useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { MOUSE } from 'three'
import type { ReactNode } from 'react'
import { setExportScene } from '../utils/worldExporter'

const MIN_DISTANCE = 2
const MAX_DISTANCE = 200
/** 1スクロールでカメラ→ヒット点間の距離のこの割合だけ移動 */
const ZOOM_FACTOR = 0.15
/** 1スクロールあたりの最大移動距離 */
const MAX_ZOOM_STEP = 5

/**
 * マウス位置にレイキャストし、ヒット点に向かってズームする。
 * ヒットがなければY=0平面との交点を使う。
 */
function RaycastZoom() {
  const { camera, controls, gl, scene } = useThree()
  const controlsRef = useRef(controls)
  controlsRef.current = controls

  useEffect(() => {
    const canvas = gl.domElement
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const planeHit = new THREE.Vector3()

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const ctrl = controlsRef.current as unknown as { target: THREE.Vector3 } | null
      if (!ctrl) return

      // マウスNDC座標
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)

      // シーン内オブジェクトとのヒット → なければY=0平面
      const hits = raycaster.intersectObjects(scene.children, true)
      let hitPoint: THREE.Vector3 | null = null
      if (hits.length > 0) {
        hitPoint = hits[0].point
      } else {
        const ray = raycaster.ray
        if (ray.intersectsPlane(groundPlane)) {
          ray.intersectPlane(groundPlane, planeHit)
          hitPoint = planeHit
        }
      }
      if (!hitPoint) return

      const zoomIn = e.deltaY < 0
      const camToHit = hitPoint.clone().sub(camera.position)
      const distToHit = camToHit.length()

      // 距離制限チェック
      const camToTarget = camera.position.distanceTo(ctrl.target)
      if (zoomIn && camToTarget < MIN_DISTANCE) return
      if (!zoomIn && camToTarget > MAX_DISTANCE) return

      const step = Math.min(distToHit * ZOOM_FACTOR, MAX_ZOOM_STEP)
      const moveDir = camToHit.normalize()

      if (zoomIn) {
        // ズームイン: カメラとtarget両方をヒット点に向けて移動
        if (distToHit < MIN_DISTANCE) return
        camera.position.addScaledVector(moveDir, step)
        ctrl.target.addScaledVector(moveDir, step)
      } else {
        // ズームアウト: ヒット点から遠ざかる
        camera.position.addScaledVector(moveDir, -step)
        ctrl.target.addScaledVector(moveDir, -step)
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [camera, gl, scene])

  return null
}

/** Canvas内のsceneをexporter用に登録する */
function SceneCapture() {
  const { scene } = useThree()
  useEffect(() => {
    setExportScene(scene)
    return () => setExportScene(null)
  }, [scene])
  return null
}

interface WorldLayoutProps {
  children: ReactNode
  style?: React.CSSProperties
}

export function WorldLayout({ children, style }: WorldLayoutProps) {
  return (
    <Canvas
      camera={{ position: [30, 25, 30], fov: 60 }}
      style={style ?? { width: '100vw', height: '100vh' }}
    >
      {children}
      <SceneCapture />
      <OrbitControls
        makeDefault
        enablePan
        enableZoom={false}
        minDistance={MIN_DISTANCE}
        maxDistance={MAX_DISTANCE}
        maxPolarAngle={Math.PI / 2.1}
        mouseButtons={{
          LEFT: MOUSE.ROTATE,
          MIDDLE: MOUSE.PAN,
          RIGHT: MOUSE.DOLLY,
        }}
      />
      <RaycastZoom />
    </Canvas>
  )
}
