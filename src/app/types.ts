import type { DungeonStyle } from '../core/model'

export type ExportScale = 1 | 2 | 4
export type ExportBackground = 'white' | 'transparent'

export interface UiState {
  seedInput: string
  roomCount: number
  branching: number
  loopChance: number
  style: DungeonStyle
  exportScale: ExportScale
  exportBackground: ExportBackground
}

