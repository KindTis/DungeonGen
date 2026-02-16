import { buildAdjacency, countBranches, isConnected, shortestPathLength } from './graph'
import type { Dungeon, DungeonParams, ValidationIssue, ValidationResult } from './model'

export const ROOM_COUNT_RANGE = { min: 10, max: 80 }
export const BRANCHING_RANGE = { min: 0.5, max: 3.0 }
export const LOOP_CHANCE_RANGE = { min: 0, max: 1 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function sanitizeDungeonParams(params: DungeonParams): DungeonParams {
  return {
    roomCount: Math.round(clamp(params.roomCount, ROOM_COUNT_RANGE.min, ROOM_COUNT_RANGE.max)),
    branching: clamp(params.branching, BRANCHING_RANGE.min, BRANCHING_RANGE.max),
    loopChance: clamp(params.loopChance, LOOP_CHANCE_RANGE.min, LOOP_CHANCE_RANGE.max),
    style: params.style,
  }
}

function validateParamRanges(params: DungeonParams): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (params.roomCount < ROOM_COUNT_RANGE.min || params.roomCount > ROOM_COUNT_RANGE.max) {
    issues.push({
      code: 'PARAM_ROOM_COUNT_RANGE',
      message: `roomCount must be in ${ROOM_COUNT_RANGE.min}..${ROOM_COUNT_RANGE.max}.`,
    })
  }
  if (params.branching < BRANCHING_RANGE.min || params.branching > BRANCHING_RANGE.max) {
    issues.push({
      code: 'PARAM_BRANCHING_RANGE',
      message: `branching must be in ${BRANCHING_RANGE.min}..${BRANCHING_RANGE.max}.`,
    })
  }
  if (params.loopChance < LOOP_CHANCE_RANGE.min || params.loopChance > LOOP_CHANCE_RANGE.max) {
    issues.push({
      code: 'PARAM_LOOP_RANGE',
      message: `loopChance must be in ${LOOP_CHANCE_RANGE.min}..${LOOP_CHANCE_RANGE.max}.`,
    })
  }
  return issues
}

export function validateDungeon(dungeon: Dungeon, expectedParams: DungeonParams): ValidationResult {
  const issues: ValidationIssue[] = [...validateParamRanges(expectedParams)]
  const ids = new Set<string>()

  let startCount = 0
  let bossCount = 0
  for (const node of dungeon.nodes) {
    if (ids.has(node.id)) {
      issues.push({ code: 'DUPLICATE_NODE', message: `Duplicate node id: ${node.id}` })
      continue
    }
    ids.add(node.id)
    if (node.type === 'start') {
      startCount += 1
    }
    if (node.type === 'boss') {
      bossCount += 1
    }
  }

  if (startCount !== 1) {
    issues.push({ code: 'START_COUNT', message: 'Exactly one start node is required.' })
  }
  if (bossCount !== 1) {
    issues.push({ code: 'BOSS_COUNT', message: 'Exactly one boss node is required.' })
  }
  if (dungeon.nodes.length !== expectedParams.roomCount) {
    issues.push({
      code: 'ROOM_COUNT_MISMATCH',
      message: `Expected ${expectedParams.roomCount} rooms but got ${dungeon.nodes.length}.`,
    })
  }

  const edgeSet = new Set<string>()
  for (const edge of dungeon.edges) {
    if (!ids.has(edge.a) || !ids.has(edge.b)) {
      issues.push({
        code: 'EDGE_NODE_NOT_FOUND',
        message: `Edge ${edge.a}<->${edge.b} references missing node.`,
      })
      continue
    }
    if (edge.a === edge.b) {
      issues.push({ code: 'SELF_LOOP', message: `Self-loop at ${edge.a} is not allowed.` })
      continue
    }
    const key = edge.a < edge.b ? `${edge.a}::${edge.b}` : `${edge.b}::${edge.a}`
    if (edgeSet.has(key)) {
      issues.push({ code: 'DUPLICATE_EDGE', message: `Duplicate edge ${edge.a}<->${edge.b}.` })
    } else {
      edgeSet.add(key)
    }
  }

  const adjacency = buildAdjacency(dungeon.nodes, dungeon.edges)
  const startNode = dungeon.nodes.find((node) => node.type === 'start')
  const bossNode = dungeon.nodes.find((node) => node.type === 'boss')

  const startBossDistance =
    startNode && bossNode ? shortestPathLength(startNode.id, bossNode.id, adjacency) : -1
  if (startBossDistance < 0) {
    issues.push({ code: 'BOSS_UNREACHABLE', message: 'Boss must be reachable from start.' })
  }

  const connected = startNode ? isConnected(startNode.id, adjacency) : false
  if (!connected) {
    issues.push({ code: 'GRAPH_DISCONNECTED', message: 'Graph must be connected.' })
  }

  return {
    valid: issues.length === 0,
    issues,
    stats: {
      roomCount: dungeon.nodes.length,
      edgeCount: dungeon.edges.length,
      connected,
      startBossDistance,
      branchCount: countBranches(adjacency),
    },
  }
}

