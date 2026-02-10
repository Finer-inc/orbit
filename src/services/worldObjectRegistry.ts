import * as THREE from 'three'
import type { WorldObjectEntry } from '../types/world'

const registry = new Map<string, WorldObjectEntry>()

export function registerWorldObject(entry: WorldObjectEntry): void {
  registry.set(entry.id, entry)
}

export function unregisterWorldObject(id: string): void {
  registry.delete(id)
}

export function getAllWorldObjects(): WorldObjectEntry[] {
  return Array.from(registry.values())
}

export function clearRegistry(): void {
  registry.clear()
}

export function getWorldObjectBox3(entry: WorldObjectEntry): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(...entry.boundingBox.min),
    new THREE.Vector3(...entry.boundingBox.max),
  )
}

export function computeFountainBBox(
  pos: [number, number, number],
): { min: [number, number, number]; max: [number, number, number] } {
  // 台座半径3.5, 高さは水柱含めて約3
  return {
    min: [pos[0] - 3.5, pos[1], pos[2] - 3.5],
    max: [pos[0] + 3.5, pos[1] + 3, pos[2] + 3.5],
  }
}

export function computeHouseBBox(
  pos: [number, number, number],
  rotation: [number, number, number],
): { min: [number, number, number]; max: [number, number, number] } {
  // 壁: 4×3×3, 屋根頂点: y=5, 煙突頂点: y=5.1
  // ローカル空間での角をrotationYで回転しAABBを再計算
  const halfW = 2  // 4/2
  const halfD = 1.5 // 3/2
  const height = 5.1

  const corners: [number, number][] = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, halfD],
    [-halfW, halfD],
  ]

  const rotY = rotation[1]
  const cosR = Math.cos(rotY)
  const sinR = Math.sin(rotY)

  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const [lx, lz] of corners) {
    const wx = lx * cosR + lz * sinR
    const wz = -lx * sinR + lz * cosR
    minX = Math.min(minX, wx)
    maxX = Math.max(maxX, wx)
    minZ = Math.min(minZ, wz)
    maxZ = Math.max(maxZ, wz)
  }

  return {
    min: [pos[0] + minX, pos[1], pos[2] + minZ],
    max: [pos[0] + maxX, pos[1] + height, pos[2] + maxZ],
  }
}

export function computeTreeBBox(
  pos: [number, number, number],
  scale: number = 1,
): { min: [number, number, number]; max: [number, number, number] } {
  // 葉の最大半径1, 高さ: 幹0-1.5 + 葉上段頂点3.75
  const r = 1 * scale
  const h = 3.75 * scale

  return {
    min: [pos[0] - r, pos[1], pos[2] - r],
    max: [pos[0] + r, pos[1] + h, pos[2] + r],
  }
}
