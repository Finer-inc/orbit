import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { SpriteData, AnimFrame } from '../../services/spriteLoader'

// ---------------------------------------------------------------------------
// 8-direction table (ported from rpg-dot-maker PreviewStep.tsx)
// ---------------------------------------------------------------------------

const DIR_TABLE: readonly { name: string; angle: number }[] = [
  { name: 'front', angle: 0 },
  { name: 'left_front', angle: Math.PI * 0.25 },
  { name: 'left', angle: Math.PI * 0.5 },
  { name: 'left_back', angle: Math.PI * 0.75 },
  { name: 'back', angle: Math.PI },
  { name: 'right_back', angle: -Math.PI * 0.75 },
  { name: 'right', angle: -Math.PI * 0.5 },
  { name: 'right_front', angle: -Math.PI * 0.25 },
]

function getDirectionName(
  cameraPos: THREE.Vector3,
  spritePos: THREE.Vector3,
  spriteFacingAngle: number,
): string {
  const dx = cameraPos.x - spritePos.x
  const dz = cameraPos.z - spritePos.z
  const viewAngle = Math.atan2(dx, dz)
  let relative = viewAngle - spriteFacingAngle
  while (relative > Math.PI) relative -= Math.PI * 2
  while (relative < -Math.PI) relative += Math.PI * 2

  let best = DIR_TABLE[0]
  let bestDist = Infinity
  for (const dir of DIR_TABLE) {
    let diff = relative - dir.angle
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    if (Math.abs(diff) < bestDist) {
      bestDist = Math.abs(diff)
      best = dir
    }
  }
  return best.name
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPRITE_SCALE = 2.5
const CYCLE_DURATION = 0.4 // seconds per walk animation cycle

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BillboardCharacterProps {
  spriteData: SpriteData
  facingAngle: number
  isMoving: boolean
  isResting?: boolean
  speechRadius?: number
  children?: React.ReactNode
}

export default function BillboardCharacter({
  spriteData,
  facingAngle,
  isMoving,
  isResting = false,
  speechRadius,
  children,
}: BillboardCharacterProps) {
  const { camera } = useThree()
  const meshRef = useRef<THREE.Mesh>(null!)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null!)
  const tiltRef = useRef(0)

  // Animation state refs (not React state — updated every frame)
  const currentKeyRef = useRef('')
  const currentAnimFramesRef = useRef<AnimFrame[] | null>(null)
  const animTimeRef = useRef(0)
  const currentFrameRef = useRef(0)

  const geometry = useMemo(() => new THREE.PlaneGeometry(SPRITE_SCALE, SPRITE_SCALE), [])
  const shadowGeometry = useMemo(() => new THREE.CircleGeometry(0.6, 32), [])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    // Billboard: face camera
    const dx = camera.position.x - mesh.parent!.position.x
    const dz = camera.position.z - mesh.parent!.position.z
    mesh.rotation.y = Math.atan2(dx, dz)

    // Resting tilt
    const targetTilt = isResting ? -Math.PI / 2 : 0
    tiltRef.current += (targetTilt - tiltRef.current) * 0.08
    mesh.rotation.x = tiltRef.current

    // Determine animation key
    const prefix = isMoving ? 'walk' : 'idle'
    const dirName = getDirectionName(camera.position, mesh.parent!.position, facingAngle)
    const key = `${prefix}_${dirName}`

    if (key !== currentKeyRef.current) {
      currentKeyRef.current = key
      animTimeRef.current = 0
      currentFrameRef.current = 0

      const animFrames = spriteData.animFrames.get(key)
      if (animFrames && animFrames.length > 1) {
        currentAnimFramesRef.current = animFrames
        materialRef.current.map = animFrames[0].texture
        materialRef.current.needsUpdate = true
      } else {
        currentAnimFramesRef.current = null
        const tex = spriteData.textures.get(key)
        if (tex) {
          materialRef.current.map = tex
          materialRef.current.needsUpdate = true
        }
      }
    }

    // Multi-frame animation playback
    const frames = currentAnimFramesRef.current
    if (frames && frames.length > 1) {
      animTimeRef.current += delta
      const t = animTimeRef.current % CYCLE_DURATION

      let elapsed = 0
      for (let i = 0; i < frames.length; i++) {
        elapsed += frames[i].ratio * CYCLE_DURATION
        if (t < elapsed) {
          if (currentFrameRef.current !== i) {
            currentFrameRef.current = i
            materialRef.current.map = frames[i].texture
            materialRef.current.needsUpdate = true
          }
          break
        }
      }
    }
  })

  return (
    <>
      {/* Billboard sprite plane */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        position={[0, SPRITE_SCALE * 0.5, 0]}
      >
        <meshBasicMaterial
          ref={materialRef}
          transparent
          alphaTest={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Shadow */}
      <mesh
        geometry={shadowGeometry}
        rotation-x={-Math.PI / 2}
        position={[0, 0.01, 0]}
      >
        <meshBasicMaterial color={0x000000} transparent opacity={0.2} />
      </mesh>

      {/* Speech radius ring */}
      {speechRadius != null && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
          <ringGeometry args={[speechRadius - 0.05, speechRadius, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {children}
    </>
  )
}
