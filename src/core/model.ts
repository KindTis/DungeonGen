export type RoomType = 'start' | 'boss' | 'normal'
export type DungeonStyle = 'linear' | 'branchy' | 'loopy'

export interface DungeonParams {
  roomCount: number
  branching: number
  loopChance: number
  style: DungeonStyle
}

export interface RoomPosition {
  x: number
  y: number
}

export interface RoomNode {
  id: string
  type: RoomType
  pos?: RoomPosition
}

export interface Edge {
  a: string
  b: string
  lockedBy?: string
}

export interface Dungeon {
  meta: {
    seed: number
    params: DungeonParams
    version: string
  }
  nodes: RoomNode[]
  edges: Edge[]
}

export interface DungeonStats {
  roomCount: number
  edgeCount: number
  connected: boolean
  startBossDistance: number
  branchCount: number
}

export interface ValidationIssue {
  code: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  stats: DungeonStats
}

