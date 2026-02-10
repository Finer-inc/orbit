import type { TimeOfDay } from '../types/world'

export type { TimeOfDay }

export interface WorldState {
  timeOfDay: TimeOfDay
  houses: {
    position: [number, number, number]
    rotation: [number, number, number]
    wallColor?: string
    roofColor?: string
  }[]
  trees: {
    position: [number, number, number]
    scale?: number
    trunkColor?: string
    leafColor?: string
  }[]
}

export function useWorldState(): WorldState {
  return {
    timeOfDay: 'day',
    houses: [
      {
        position: [-10, 0, -5],
        rotation: [0, Math.PI / 4, 0],
      },
      {
        position: [10, 0, -5],
        rotation: [0, -Math.PI / 4, 0],
        wallColor: '#d4c5a9',
      },
    ],
    trees: [
      { position: [-6, 0, 8], scale: 1.2 },
      { position: [7, 0, 9], scale: 0.9 },
      { position: [-14, 0, 3], scale: 1.0 },
      { position: [14, 0, 2], scale: 1.1 },
      { position: [-8, 0, -12], scale: 0.8 },
      { position: [9, 0, -11], scale: 1.3 },
      { position: [0, 0, -14], scale: 1.0 },
      { position: [-3, 0, 12], scale: 0.7 },
    ],
  }
}
