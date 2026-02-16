import type { Edge, RoomNode } from './model'

export function buildAdjacency(nodes: RoomNode[], edges: Edge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>()
  for (const node of nodes) {
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    const aList = adjacency.get(edge.a)
    const bList = adjacency.get(edge.b)
    if (!aList || !bList) {
      continue
    }
    aList.push(edge.b)
    bList.push(edge.a)
  }

  return adjacency
}

export function bfsDistances(startId: string, adjacency: Map<string, string[]>): Map<string, number> {
  const distances = new Map<string, number>()
  if (!adjacency.has(startId)) {
    return distances
  }

  const queue: string[] = [startId]
  distances.set(startId, 0)

  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i]
    const currentDistance = distances.get(current) ?? 0
    const neighbors = adjacency.get(current) ?? []
    for (const neighbor of neighbors) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, currentDistance + 1)
        queue.push(neighbor)
      }
    }
  }

  return distances
}

export function shortestPathLength(startId: string, targetId: string, adjacency: Map<string, string[]>): number {
  const distances = bfsDistances(startId, adjacency)
  return distances.get(targetId) ?? -1
}

export function isConnected(startId: string, adjacency: Map<string, string[]>): boolean {
  const reachable = bfsDistances(startId, adjacency)
  return reachable.size === adjacency.size
}

export function countBranches(adjacency: Map<string, string[]>): number {
  let branchCount = 0
  adjacency.forEach((neighbors) => {
    if (neighbors.length > 2) {
      branchCount += 1
    }
  })
  return branchCount
}

