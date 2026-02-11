import { useEffect } from 'react'
import type { WorldState } from '../hooks/useWorldState'
import {
  registerWorldObject,
  clearRegistry,
  computeFountainBBox,
  computeHouseBBox,
  computeTreeBBox,
} from '../services/worldObjectRegistry'

export function useWorldObjectRegistration(worldState: WorldState): void {
  useEffect(() => {
    // 噴水（4広場）
    const fountainPositions: [number, number, number][] = [
      [0, 0, 0], [18, 0, 0], [0, 0, 18], [18, 0, 18],
    ]
    fountainPositions.forEach((pos, i) => {
      registerWorldObject({
        id: `fountain-${i}`,
        type: 'fountain',
        position: pos,
        boundingBox: computeFountainBBox(pos),
      })
    })

    // 家
    worldState.houses.forEach((house, i) => {
      registerWorldObject({
        id: `house-${i}`,
        type: 'house',
        position: house.position,
        boundingBox: computeHouseBBox(house.position, house.rotation),
      })
    })

    // 木
    worldState.trees.forEach((tree, i) => {
      registerWorldObject({
        id: `tree-${i}`,
        type: 'tree',
        position: tree.position,
        boundingBox: computeTreeBBox(tree.position, tree.scale),
      })
    })

    return () => clearRegistry()
  }, [worldState])
}
