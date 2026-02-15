/**
 * GLB → world.json 変換スクリプト
 *
 * Usage: npx tsx scripts/glb-to-world-json.ts
 *
 * 既存の seirei-world.glb から world.json を生成する。
 * terrain の頂点はワールド座標に変換済みで出力される。
 */
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { parseWorldGLB } from '../server/world/parseGLB.ts'

const glbPath = path.join(import.meta.dirname!, '..', 'public', 'worlds', 'seirei-world.glb')
const outPath = path.join(import.meta.dirname!, '..', 'public', 'worlds', 'world.json')

console.log(`GLB読み込み: ${glbPath}`)
const { colNodes, terrainRaw } = parseWorldGLB(glbPath)

// terrain頂点をワールド座標に変換
let terrain: { positions: number[]; indices: number[] } | undefined
if (terrainRaw) {
  const { positions, indices, worldMatrix: wm } = terrainRaw
  const vertCount = positions.length / 3
  const worldPositions: number[] = new Array(vertCount * 3)

  for (let i = 0; i < vertCount; i++) {
    const lx = positions[i * 3]
    const ly = positions[i * 3 + 1]
    const lz = positions[i * 3 + 2]
    worldPositions[i * 3]     = wm[0] * lx + wm[4] * ly + wm[8] * lz + wm[12]
    worldPositions[i * 3 + 1] = wm[1] * lx + wm[5] * ly + wm[9] * lz + wm[13]
    worldPositions[i * 3 + 2] = wm[2] * lx + wm[6] * ly + wm[10] * lz + wm[14]
  }

  terrain = {
    positions: worldPositions,
    indices: Array.from(indices),
  }
}

const worldJson = {
  colNodes: colNodes.map(n => ({
    name: n.name,
    type: n.type,
    index: n.index,
    translation: n.translation,
    rotationY: n.rotationY,
    localMin: n.localMin,
    localMax: n.localMax,
  })),
  terrain,
}

writeFileSync(outPath, JSON.stringify(worldJson))
console.log(`出力: ${outPath}`)
console.log(`  colNodes: ${colNodes.length}個`)
if (terrain) {
  console.log(`  terrain: ${terrain.positions.length / 3}頂点, ${terrain.indices.length / 3}三角形`)
}
