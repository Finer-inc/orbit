import { useMemo } from 'react'
import * as THREE from 'three'
import type { CharacterState, VisibleObject, VisionAPI } from '../types/world'
import { getAllWorldObjects, getWorldObjectBox3 } from '../services/worldObjectRegistry'

export function useVision(
  stateRef: React.RefObject<CharacterState>,
): VisionAPI {
  const api = useMemo<VisionAPI>(() => ({
    getVisibleObjects(): VisibleObject[] {
      const state = stateRef.current
      const eyeHeight = 1.5
      const eyePos = new THREE.Vector3(
        state.position[0],
        state.position[1] + eyeHeight,
        state.position[2],
      )

      // 仮想一人称カメラを構築
      const camera = new THREE.PerspectiveCamera(90, 1, 0.5, 30)
      camera.position.copy(eyePos)

      // キャラの向き方向に視線を設定
      const lookAt = new THREE.Vector3(
        eyePos.x + Math.sin(state.rotationY),
        eyePos.y,
        eyePos.z + Math.cos(state.rotationY),
      )
      camera.lookAt(lookAt)
      camera.updateMatrixWorld()

      // Frustum構築
      const projScreenMatrix = new THREE.Matrix4()
      projScreenMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      )
      const frustum = new THREE.Frustum()
      frustum.setFromProjectionMatrix(projScreenMatrix)

      // BBox8頂点をNDC空間に投影しスクリーン占有率を計算
      const projectBox3ToScreenArea = (box3: THREE.Box3): number => {
        const corners = [
          new THREE.Vector3(box3.min.x, box3.min.y, box3.min.z),
          new THREE.Vector3(box3.min.x, box3.min.y, box3.max.z),
          new THREE.Vector3(box3.min.x, box3.max.y, box3.min.z),
          new THREE.Vector3(box3.min.x, box3.max.y, box3.max.z),
          new THREE.Vector3(box3.max.x, box3.min.y, box3.min.z),
          new THREE.Vector3(box3.max.x, box3.min.y, box3.max.z),
          new THREE.Vector3(box3.max.x, box3.max.y, box3.min.z),
          new THREE.Vector3(box3.max.x, box3.max.y, box3.max.z),
        ]

        let ndcMinX = 1, ndcMaxX = -1, ndcMinY = 1, ndcMaxY = -1
        let anyInFront = false

        for (const c of corners) {
          c.applyMatrix4(projScreenMatrix)
          // W除算前のzで前方判定（クリップ空間のw = 元のカメラ空間のz反転）
          // applyMatrix4は自動でw除算するので、projectedのzが-1〜1の範囲内かで判定
          // ただしapplyMatrix4はw除算済みNDCを返す。カメラ背後の頂点はz>1になる
          if (c.z >= -1 && c.z <= 1) {
            anyInFront = true
            ndcMinX = Math.min(ndcMinX, Math.max(c.x, -1))
            ndcMaxX = Math.max(ndcMaxX, Math.min(c.x, 1))
            ndcMinY = Math.min(ndcMinY, Math.max(c.y, -1))
            ndcMaxY = Math.max(ndcMaxY, Math.min(c.y, 1))
          }
        }

        if (!anyInFront || ndcMaxX <= ndcMinX || ndcMaxY <= ndcMinY) return 0
        // NDC空間は -1〜1 (2×2=4) → 占有率 = 投影面積 / 4
        return ((ndcMaxX - ndcMinX) * (ndcMaxY - ndcMinY)) / 4
      }

      // 全登録オブジェクトを判定
      const results: VisibleObject[] = []
      for (const entry of getAllWorldObjects()) {
        const box3 = getWorldObjectBox3(entry)
        if (frustum.intersectsBox(box3)) {
          const objCenter = new THREE.Vector3(
            entry.position[0],
            entry.position[1],
            entry.position[2],
          )
          results.push({
            id: entry.id,
            type: entry.type,
            position: entry.position,
            distance: eyePos.distanceTo(objCenter),
            screenOccupancy: projectBox3ToScreenArea(box3),
          })
        }
      }

      // 距離順ソート
      results.sort((a, b) => a.distance - b.distance)
      return results
    },
  }), [stateRef])

  return api
}
