import { bfsDistances, buildAdjacency } from './graph'
import type { Dungeon, DungeonParams, RoomNode } from './model'
import type { Rng } from './rng'
import { sanitizeDungeonParams } from './validate'

const MODEL_VERSION = 'mvp-1'

type DegreeMap = Map<string, number>

function incrementDegree(degrees: DegreeMap, id: string): void {
  const current = degrees.get(id) ?? 0
  degrees.set(id, current + 1)
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`
}

function weightedPickIndex(weights: number[], rng: Rng): number {
  const sum = weights.reduce((acc, value) => acc + value, 0)
  if (sum <= 0) {
    return rng.nextInt(weights.length)
  }
  let cursor = rng.next() * sum
  for (let i = 0; i < weights.length; i += 1) {
    cursor -= weights[i]
    if (cursor <= 0) {
      return i
    }
  }
  return weights.length - 1
}

function pickParent(candidates: RoomNode[], degrees: DegreeMap, branching: number, rng: Rng): string {
  const weights = candidates.map((node) => {
    const degree = degrees.get(node.id) ?? 0
    return Math.pow(1 / (1 + degree), branching)
  })
  return candidates[weightedPickIndex(weights, rng)].id
}

export function generateDungeon(paramsInput: DungeonParams, rng: Rng): Dungeon {
  const params = sanitizeDungeonParams(paramsInput)
  const styleBranchingMultiplier =
    params.style === 'linear' ? 0.75 : params.style === 'branchy' ? 1.25 : 1.0
  const styleLoopMultiplier = params.style === 'linear' ? 0.6 : params.style === 'loopy' ? 1.35 : 1.0
  const branching = params.branching * styleBranchingMultiplier
  const loopChance = Math.min(1, params.loopChance * styleLoopMultiplier)

  const nodes: RoomNode[] = []
  const edges: Array<{ a: string; b: string }> = []
  const edgeSet = new Set<string>()
  const degrees: DegreeMap = new Map<string, number>()

  const addNode = (type: RoomNode['type']): RoomNode => {
    const node = {
      id: `room-${nodes.length}`,
      type,
    } satisfies RoomNode
    nodes.push(node)
    degrees.set(node.id, 0)
    return node
  }

  const addEdge = (a: string, b: string): boolean => {
    if (a === b) {
      return false
    }
    const key = edgeKey(a, b)
    if (edgeSet.has(key)) {
      return false
    }
    edgeSet.add(key)
    edges.push({ a, b })
    incrementDegree(degrees, a)
    incrementDegree(degrees, b)
    return true
  }

  const start = addNode('start')
  const normalRoomCount = Math.max(0, params.roomCount - 2)

  for (let i = 0; i < normalRoomCount; i += 1) {
    const node = addNode('normal')
    const parentCandidates = nodes.filter((candidate) => candidate.type !== 'boss' && candidate.id !== node.id)
    const parentId = pickParent(parentCandidates, degrees, branching, rng)
    addEdge(parentId, node.id)
  }

  const boss = addNode('boss')
  const adjacencyBeforeBoss = buildAdjacency(nodes.filter((node) => node.id !== boss.id), edges)
  const distances = bfsDistances(start.id, adjacencyBeforeBoss)
  const normalCandidates = nodes.filter((node) => node.type === 'normal')
  let bossParentId = start.id
  if (normalCandidates.length > 0) {
    const sorted = normalCandidates
      .slice()
      .sort((a, b) => (distances.get(b.id) ?? 0) - (distances.get(a.id) ?? 0))
    if (params.style === 'linear') {
      bossParentId = sorted[0].id
    } else {
      const topSlice = sorted.slice(0, Math.max(1, Math.floor(sorted.length / 3)))
      bossParentId = rng.pick(topSlice).id
    }
  }
  addEdge(bossParentId, boss.id)

  const potentialPairs = Math.max(1, params.roomCount / 2)
  const loopTarget = Math.floor(loopChance * potentialPairs)
  const loopNodes = nodes.filter((node) => node.type !== 'boss')
  let loopsAdded = 0
  let attempts = loopTarget * 10 + 20

  while (loopsAdded < loopTarget && attempts > 0) {
    attempts -= 1
    const a = rng.pick(loopNodes)
    const b = rng.pick(loopNodes)
    if (addEdge(a.id, b.id)) {
      loopsAdded += 1
    }
  }

  return {
    meta: {
      seed: rng.seed,
      params,
      version: MODEL_VERSION,
    },
    nodes,
    edges,
  }
}

