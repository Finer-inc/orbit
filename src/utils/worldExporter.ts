/**
 * Seirei World Exporter — Scene-capture approach
 *
 * Exports the actual rendered scene (the group named "__world__")
 * rather than building a separate scene. This guarantees that the
 * exported GLB matches what is displayed on screen.
 *
 * Before export, each vis_* group is merged into a single mesh with
 * vertex colors so the GLB has clean, named objects for Blender.
 *
 * In GLB mode the loaded GLB already contains col_* objects (hidden
 * by WorldGLB). These are temporarily made visible before export so
 * they survive in the output file.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

let _scene: THREE.Scene | null = null

/** Called from SceneCapture (inside Canvas) to register the live scene. */
export function setExportScene(scene: THREE.Scene | null): void {
  _scene = scene
}

// ---------------------------------------------------------------------------
//  vis_* group → single mesh merging
// ---------------------------------------------------------------------------

/**
 * Collect all descendant Meshes of a group.
 */
function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      meshes.push(child as THREE.Mesh)
    }
  })
  return meshes
}

/**
 * Merge all descendant meshes of each vis_* group into a single
 * vertex-colored mesh. The resulting mesh keeps the vis_* name and
 * is placed in world space (position at origin).
 *
 * Groups that already contain only a single mesh are flattened
 * without merging.
 */
function mergeVisGroups(root: THREE.Object3D): void {
  // Collect targets first to avoid mutating during traversal
  const targets: { group: THREE.Object3D; parent: THREE.Object3D; index: number }[] = []
  root.traverse((obj) => {
    if (
      (obj as THREE.Group).isGroup &&
      obj.name.startsWith('vis_') &&
      obj.parent
    ) {
      targets.push({
        group: obj,
        parent: obj.parent,
        index: obj.parent.children.indexOf(obj),
      })
    }
  })

  for (const { group, parent, index } of targets) {
    const meshes = collectMeshes(group)
    if (meshes.length === 0) continue

    // Ensure world matrices are up to date
    group.updateWorldMatrix(true, true)

    const geos: THREE.BufferGeometry[] = []

    for (const mesh of meshes) {
      let geo = mesh.geometry.clone()

      // Convert indexed → non-indexed for consistent merge
      if (geo.index) geo = geo.toNonIndexed()

      // Apply full world transform so all verts are in world space
      geo.applyMatrix4(mesh.matrixWorld)

      // Ensure normals
      if (!geo.attributes.normal) geo.computeVertexNormals()

      // Add vertex colors from material (skip if already present, e.g. Terrain)
      if (!geo.attributes.color) {
        const mat = (
          Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        ) as THREE.MeshStandardMaterial
        const c = mat.color?.clone() ?? new THREE.Color(1, 1, 1)
        const count = geo.attributes.position.count
        const vc = new Float32Array(count * 3)
        for (let v = 0; v < count; v++) {
          vc[v * 3] = c.r
          vc[v * 3 + 1] = c.g
          vc[v * 3 + 2] = c.b
        }
        geo.setAttribute('color', new THREE.BufferAttribute(vc, 3))
      }

      // Normalise attribute set: keep only position, normal, color
      for (const name of Object.keys(geo.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'color') {
          geo.deleteAttribute(name)
        }
      }

      geos.push(geo)
    }

    const merged = mergeGeometries(geos)
    if (!merged) continue

    // Vertices are in world space; transform back to parent's local space
    // so they render correctly when placed under the parent's transform.
    parent.updateWorldMatrix(true, false)
    const parentWorldInverse = new THREE.Matrix4().copy(parent.matrixWorld).invert()
    merged.applyMatrix4(parentWorldInverse)

    merged.computeVertexNormals()

    const result = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }),
    )
    result.name = group.name

    // Replace group with single mesh in parent
    parent.children[index] = result
    result.parent = parent
    group.parent = null
  }
}

// ---------------------------------------------------------------------------
//  Public export
// ---------------------------------------------------------------------------

export async function exportWorldGLB(): Promise<void> {
  if (!_scene) throw new Error('No scene registered for export')

  const worldGroup = _scene.getObjectByName('__world__')
  if (!worldGroup) throw new Error('World group (__world__) not found in scene')

  // Temporarily reveal hidden objects (col_*) so they are included
  const hiddenObjects: THREE.Object3D[] = []
  worldGroup.traverse((obj) => {
    if (!obj.visible) {
      hiddenObjects.push(obj)
      obj.visible = true
    }
  })

  // Deep-clone to avoid mutating the live scene during merge
  const exportRoot = worldGroup.clone(true)
  exportRoot.updateWorldMatrix(true, true)

  // Merge vis_* groups into single meshes
  mergeVisGroups(exportRoot)

  try {
    const exporter = new GLTFExporter()
    await new Promise<void>((resolve, reject) => {
      exporter.parse(
        exportRoot,
        (result) => {
          const blob = new Blob([result as ArrayBuffer], {
            type: 'application/octet-stream',
          })
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
  } finally {
    // Restore hidden objects on live scene
    for (const obj of hiddenObjects) {
      obj.visible = false
    }
  }
}
