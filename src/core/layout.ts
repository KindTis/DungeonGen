import type { Dungeon } from './model'
import { createRng } from './rng'

export interface LayoutOptions {
  width: number
  height: number
  padding?: number
  iterations?: number
  seed?: number
}

interface Vector {
  x: number
  y: number
}

function magnitude(x: number, y: number): number {
  return Math.sqrt(x * x + y * y)
}

export function layoutDungeon(dungeon: Dungeon, options: LayoutOptions): Dungeon {
  const padding = options.padding ?? 48
  const iterations = options.iterations ?? 200
  const layoutSeed = options.seed ?? (dungeon.meta.seed ^ 0x9e3779b9)
  const rng = createRng(layoutSeed)

  const position = new Map<string, Vector>()
  const velocity = new Map<string, Vector>()
  const forces = new Map<string, Vector>()

  for (const node of dungeon.nodes) {
    position.set(node.id, {
      x: (rng.next() - 0.5) * options.width,
      y: (rng.next() - 0.5) * options.height,
    })
    velocity.set(node.id, { x: 0, y: 0 })
    forces.set(node.id, { x: 0, y: 0 })
  }

  const kRepulsion = 20_000
  const kSpring = 0.03
  const targetEdgeLength = Math.max(70, Math.min(150, 1800 / Math.sqrt(dungeon.nodes.length)))
  const damping = 0.85

  for (let iter = 0; iter < iterations; iter += 1) {
    dungeon.nodes.forEach((node) => {
      forces.set(node.id, { x: 0, y: 0 })
    })

    for (let i = 0; i < dungeon.nodes.length; i += 1) {
      for (let j = i + 1; j < dungeon.nodes.length; j += 1) {
        const a = dungeon.nodes[i]
        const b = dungeon.nodes[j]
        const posA = position.get(a.id)!
        const posB = position.get(b.id)!
        const dx = posB.x - posA.x
        const dy = posB.y - posA.y
        const dist = Math.max(0.01, magnitude(dx, dy))
        const force = kRepulsion / (dist * dist)
        const nx = dx / dist
        const ny = dy / dist
        const fa = forces.get(a.id)!
        const fb = forces.get(b.id)!
        fa.x -= nx * force
        fa.y -= ny * force
        fb.x += nx * force
        fb.y += ny * force
      }
    }

    for (const edge of dungeon.edges) {
      const posA = position.get(edge.a)
      const posB = position.get(edge.b)
      if (!posA || !posB) {
        continue
      }
      const dx = posB.x - posA.x
      const dy = posB.y - posA.y
      const dist = Math.max(0.01, magnitude(dx, dy))
      const delta = dist - targetEdgeLength
      const springForce = delta * kSpring
      const nx = dx / dist
      const ny = dy / dist
      const fa = forces.get(edge.a)!
      const fb = forces.get(edge.b)!
      fa.x += nx * springForce
      fa.y += ny * springForce
      fb.x -= nx * springForce
      fb.y -= ny * springForce
    }

    for (const node of dungeon.nodes) {
      const pos = position.get(node.id)!
      const vel = velocity.get(node.id)!
      const force = forces.get(node.id)!
      const centering = {
        x: -pos.x * 0.0015,
        y: -pos.y * 0.0015,
      }
      vel.x = (vel.x + force.x + centering.x) * damping
      vel.y = (vel.y + force.y + centering.y) * damping
      pos.x += vel.x
      pos.y += vel.y
    }
  }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  position.forEach((value) => {
    minX = Math.min(minX, value.x)
    maxX = Math.max(maxX, value.x)
    minY = Math.min(minY, value.y)
    maxY = Math.max(maxY, value.y)
  })

  const rangeX = Math.max(1, maxX - minX)
  const rangeY = Math.max(1, maxY - minY)
  const usableWidth = Math.max(1, options.width - padding * 2)
  const usableHeight = Math.max(1, options.height - padding * 2)

  const nodes = dungeon.nodes.map((node) => {
    const pos = position.get(node.id)!
    return {
      ...node,
      pos: {
        x: ((pos.x - minX) / rangeX) * usableWidth + padding,
        y: ((pos.y - minY) / rangeY) * usableHeight + padding,
      },
    }
  })

  return {
    ...dungeon,
    nodes,
  }
}

