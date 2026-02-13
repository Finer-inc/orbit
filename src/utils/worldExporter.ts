/**
 * 現在のワールドをGLB形式でエクスポートする。
 * ビジュアルメッシュ + コリジョンメッシュ + スポーンポイントを含む。
 *
 * 命名規則:
 *   vis_*     — 表示用メッシュ
 *   col_*     — コリジョン用メッシュ（簡略化、Blender上で非表示にする想定）
 *   spawn_*   — 位置マーカー（Empty相当、小さなメッシュで代用）
 */
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

// ---- データ定義（WorldPage / useWorldState と同じ） ----

const PLAZAS: [number, number][] = [[0, 0], [18, 0], [0, 18], [18, 18]]
const PLAZA_RADIUS = 8

const HOUSES = [
  { position: [-10, 0, -5] as const, rotation: [0, Math.PI / 4, 0] as const, wallColor: '#f8eedc', roofColor: '#d47858' },
  { position: [-10, 0, 6] as const, rotation: [0, -Math.PI / 6, 0] as const, wallColor: '#f8eedc', roofColor: '#d47858' },
  { position: [28, 0, -5] as const, rotation: [0, -Math.PI / 4, 0] as const, wallColor: '#d4c5a9', roofColor: '#d47858' },
  { position: [28, 0, 6] as const, rotation: [0, Math.PI / 6, 0] as const, wallColor: '#f8eedc', roofColor: '#d47858' },
]

const TREES = [
  { position: [-6, 0, 10], scale: 1.2 },
  { position: [-14, 0, 3], scale: 1.0 },
  { position: [-8, 0, -12], scale: 0.8 },
  { position: [0, 0, -14], scale: 1.0 },
  { position: [-3, 0, 12], scale: 0.7 },
  { position: [9, 0, 6], scale: 0.9 },
  { position: [9, 0, -6], scale: 1.1 },
  { position: [24, 0, 10], scale: 1.2 },
  { position: [18, 0, -14], scale: 1.0 },
  { position: [32, 0, 3], scale: 1.0 },
  { position: [26, 0, -12], scale: 0.8 },
  { position: [21, 0, 12], scale: 0.7 },
  { position: [12, 0, 10], scale: 1.3 },
]

// ---- ヘルパー ----

function mat(color: string, opts?: { transparent?: boolean; opacity?: number }) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    transparent: opts?.transparent,
    opacity: opts?.opacity,
  })
}

/** コリジョンメッシュ用マテリアル（半透明グレー） */
function colMat() {
  return new THREE.MeshStandardMaterial({ color: '#888888', flatShading: true, transparent: true, opacity: 0.4 })
}

/** スポーンポイント用マーカー（小さな球） */
function spawnMarker(name: string, x: number, y: number, z: number, parent: THREE.Group) {
  const geo = new THREE.SphereGeometry(0.15, 4, 4)
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#00ff00', flatShading: true }))
  mesh.name = name
  mesh.position.set(x, y, z)
  parent.add(mesh)
}

// ---- シーン構築 ----

function buildGround(root: THREE.Group) {
  const stoneColor = '#c4b8a8'

  // 芝生
  const grass = new THREE.Mesh(new THREE.CircleGeometry(60, 32), mat('#6db87e'))
  grass.rotation.x = -Math.PI / 2
  grass.position.set(9, 0, 9)
  grass.name = 'vis_terrain'
  root.add(grass)

  // 広場
  PLAZAS.forEach(([cx, cz], i) => {
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_RADIUS, 32), mat(stoneColor))
    plaza.rotation.x = -Math.PI / 2
    plaza.position.set(cx, 0.01, cz)
    plaza.name = `vis_plaza_${i}`
    root.add(plaza)

    spawnMarker(`spawn_plaza_${i}`, cx, 0, cz, root)
  })

  // 接続通路
  const pathData: { pos: [number, number, number]; size: [number, number]; name: string }[] = [
    { pos: [9, 0.008, 0], size: [2, 1.2], name: 'vis_path_h_01' },
    { pos: [9, 0.008, 18], size: [2, 1.2], name: 'vis_path_h_23' },
    { pos: [0, 0.008, 9], size: [1.2, 2], name: 'vis_path_v_02' },
    { pos: [18, 0.008, 9], size: [1.2, 2], name: 'vis_path_v_13' },
  ]
  pathData.forEach(({ pos, size, name }) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], 0.05), mat(stoneColor))
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(...pos)
    mesh.name = name
    root.add(mesh)
  })

  // 外周小道（各広場から2本ずつ）
  const outerPaths: { pos: [number, number, number]; size: [number, number]; name: string }[] = [
    // Plaza 0
    { pos: [0, 0.005, -(4 + 8)], size: [1.2, 8], name: 'vis_outerpath_0a' },
    { pos: [-(4 + 8), 0.005, 0], size: [8, 1.2], name: 'vis_outerpath_0b' },
    // Plaza 1
    { pos: [18, 0.005, -(4 + 8)], size: [1.2, 8], name: 'vis_outerpath_1a' },
    { pos: [18 + 4 + 8, 0.005, 0], size: [8, 1.2], name: 'vis_outerpath_1b' },
    // Plaza 2
    { pos: [0, 0.005, 18 + 4 + 8], size: [1.2, 8], name: 'vis_outerpath_2a' },
    { pos: [-(4 + 8), 0.005, 18], size: [8, 1.2], name: 'vis_outerpath_2b' },
    // Plaza 3
    { pos: [18, 0.005, 18 + 4 + 8], size: [1.2, 8], name: 'vis_outerpath_3a' },
    { pos: [18 + 4 + 8, 0.005, 18], size: [8, 1.2], name: 'vis_outerpath_3b' },
  ]
  outerPaths.forEach(({ pos, size, name }) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], 0.05), mat(stoneColor))
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(...pos)
    mesh.name = name
    root.add(mesh)
  })
}

function buildFountain(root: THREE.Group, pos: [number, number, number], index: number) {
  const group = new THREE.Group()
  group.name = `vis_fountain_${index}`
  group.position.set(...pos)

  // 台座
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 0.8, 8), mat('#ccc6be'))
  base.position.y = 0.4
  group.add(base)

  // プール
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.3, 8), mat('#6cbaf0', { transparent: true, opacity: 0.7 }))
  pool.position.y = 0.85
  group.add(pool)

  // 中央柱
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2, 8), mat('#ccc6be'))
  pillar.position.y = 1.8
  group.add(pillar)

  // 上段受け皿
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 0.3, 8), mat('#ccc6be'))
  dish.position.y = 2
  group.add(dish)

  root.add(group)

  // コリジョン: 円柱でシンプルに囲む
  const col = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 3, 8), colMat())
  col.name = `col_fountain_${index}`
  col.position.set(pos[0], 1.5, pos[2])
  root.add(col)

  spawnMarker(`spawn_fountain_${index}`, pos[0], 0, pos[2], root)
}

function buildHouse(root: THREE.Group, h: typeof HOUSES[number], index: number) {
  const group = new THREE.Group()
  group.name = `vis_house_${index}`
  group.position.set(...h.position)
  group.rotation.set(...h.rotation)

  const wc = h.wallColor
  const rc = h.roofColor

  // 壁（まとめてbox）
  const walls: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [
    // 後壁
    { pos: [0, 1.75, -2.5], size: [6, 3.5, 0.1], color: wc },
    // 左壁
    { pos: [-3, 1.75, 0], size: [0.1, 3.5, 5], color: wc },
    // 右壁
    { pos: [3, 1.75, 0], size: [0.1, 3.5, 5], color: wc },
    // 前壁上部
    { pos: [0, 3.025, 2.5], size: [6, 0.95, 0.1], color: wc },
    // 前壁下部左
    { pos: [-1.725, 0.925, 2.5], size: [2.55, 1.85, 0.1], color: wc },
    // 前壁下部右
    { pos: [1.725, 0.925, 2.5], size: [2.55, 1.85, 0.1], color: wc },
    // 前壁窓帯
    { pos: [-2.425, 2.2, 2.5], size: [1.15, 0.7, 0.1], color: wc },
    { pos: [0, 2.2, 2.5], size: [2.3, 0.7, 0.1], color: wc },
    { pos: [2.425, 2.2, 2.5], size: [1.15, 0.7, 0.1], color: wc },
    // 床
    { pos: [0, 0.02, 0], size: [5.9, 0.04, 4.9], color: '#c4a882' },
    // ドア
    { pos: [0, 0.9, 2.5], size: [0.9, 1.8, 0.1], color: '#8a5a3a' },
    // 煙突
    { pos: [1.5, 5.5, -1], size: [0.6, 1.4, 0.6], color: '#7a7a7a' },
  ]
  walls.forEach(({ pos, size, color }) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color))
    m.position.set(...pos)
    group.add(m)
  })

  // 窓
  const windowMat = mat('#87ceeb', { transparent: true, opacity: 0.7 })
  ;[[-1.5, 2.2, 2.5], [1.5, 2.2, 2.5]].forEach(([x, y, z]) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1), windowMat)
    w.position.set(x, y, z)
    group.add(w)
  })

  // 屋根
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(4.8, 2.5, 4),
    mat(rc, { transparent: true, opacity: 0.35 }),
  )
  roof.position.set(0, 4.75, 0)
  roof.rotation.y = Math.PI / 4
  group.add(roof)

  // ベッド
  const bedParts: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = [
    { pos: [1.5, 0.15, -0.5], size: [1.3, 0.3, 2.2], color: '#8a6a3a' },
    { pos: [1.5, 0.35, -0.5], size: [1.1, 0.12, 2.0], color: '#f5f0e8' },
    { pos: [1.5, 0.44, -1.3], size: [0.6, 0.1, 0.35], color: '#ffffff' },
    { pos: [1.5, 0.5, -1.55], size: [1.3, 0.7, 0.08], color: '#8a6a3a' },
  ]
  bedParts.forEach(({ pos, size, color }) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color))
    m.position.set(...pos)
    group.add(m)
  })

  root.add(group)

  // コリジョン: 家全体を囲むbox（ローカル座標で作り、同じ回転を適用）
  const colGroup = new THREE.Group()
  colGroup.name = `col_house_${index}`
  colGroup.position.set(...h.position)
  colGroup.rotation.set(...h.rotation)
  const colBox = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5), colMat())
  colBox.position.set(0, 2, 0)
  colGroup.add(colBox)
  root.add(colGroup)

  // スポーン（ドア前 = +Z側）
  const doorLocal = new THREE.Vector3(0, 0, 3.5)
  doorLocal.applyEuler(new THREE.Euler(...h.rotation))
  spawnMarker(
    `spawn_house_${index}`,
    h.position[0] + doorLocal.x,
    0,
    h.position[2] + doorLocal.z,
    root,
  )
}

function buildTree(root: THREE.Group, t: typeof TREES[number], index: number) {
  const group = new THREE.Group()
  group.name = `vis_tree_${index}`
  group.position.set(t.position[0], t.position[1], t.position[2])
  group.scale.setScalar(t.scale)

  // 幹
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.5, 5), mat('#9b6e4c'))
  trunk.position.y = 0.75
  group.add(trunk)

  // 葉下段
  const leavesLow = new THREE.Mesh(new THREE.ConeGeometry(1, 2, 6), mat('#4daa55'))
  leavesLow.position.y = 2.2
  group.add(leavesLow)

  // 葉上段
  const leavesHigh = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.5, 6), mat('#4daa55'))
  leavesHigh.position.y = 3
  group.add(leavesHigh)

  root.add(group)

  // コリジョン: 円柱（幹 + 葉をカバー）
  const colHeight = 3.8 * t.scale
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8 * t.scale, 0.8 * t.scale, colHeight, 6),
    colMat(),
  )
  col.name = `col_tree_${index}`
  col.position.set(t.position[0], colHeight / 2, t.position[2])
  root.add(col)
}

function buildStreetLights(root: THREE.Group) {
  const plazaCenters: [number, number, string][] = [[0, 0, 'sw'], [18, 0, 'se'], [0, 18, 'nw'], [18, 18, 'ne']]
  let idx = 0
  plazaCenters.forEach(([cx, cz, _tag]) => {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 8) + (Math.PI * 2 / 8) * i
      const x = cx + Math.cos(angle) * 9
      const z = cz + Math.sin(angle) * 9

      const group = new THREE.Group()
      group.name = `vis_streetlight_${idx}`
      group.position.set(x, 0, z)

      // ポール
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 8), mat('#444444'))
      pole.position.y = 1.5
      group.add(pole)

      // ランプ
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), mat('#888888'))
      lamp.position.y = 3.1
      group.add(lamp)

      root.add(group)

      // コリジョン: 細い円柱
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 4), colMat())
      col.name = `col_streetlight_${idx}`
      col.position.set(x, 1.5, z)
      root.add(col)

      idx++
    }
  })
}

// ---- メイン ----

function buildExportScene(): THREE.Scene {
  const scene = new THREE.Scene()

  const visGroup = new THREE.Group()
  visGroup.name = 'visual'
  scene.add(visGroup)

  buildGround(visGroup)

  const fountainPositions: [number, number, number][] = [[0, 0, 0], [18, 0, 0], [0, 0, 18], [18, 0, 18]]
  fountainPositions.forEach((pos, i) => buildFountain(visGroup, pos, i))

  HOUSES.forEach((h, i) => buildHouse(visGroup, h, i))

  TREES.forEach((t, i) => buildTree(visGroup, t, i))

  buildStreetLights(visGroup)

  return scene
}

export async function exportWorldGLB(): Promise<void> {
  const scene = buildExportScene()
  const exporter = new GLTFExporter()

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], { type: 'application/octet-stream' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'seirei-world.glb'
        a.click()
        URL.revokeObjectURL(a.href)
        resolve()
      },
      (error) => reject(error),
      { binary: true },
    )
  })
}
