import { describe, expect, it } from 'vitest'
import { generateDungeon } from '../../src/core/generate'
import { layoutDungeon } from '../../src/core/layout'
import { createRng } from '../../src/core/rng'

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

describe('layoutDungeon', () => {
  it('assigns finite coordinates and limits severe overlap', () => {
    const dungeon = generateDungeon(
      {
        roomCount: 36,
        branching: 1.6,
        loopChance: 0.2,
        style: 'branchy',
      },
      createRng(42),
    )
    const layouted = layoutDungeon(dungeon, {
      width: 1200,
      height: 800,
      padding: 60,
      iterations: 160,
    })

    for (const node of layouted.nodes) {
      expect(Number.isFinite(node.pos?.x)).toBe(true)
      expect(Number.isFinite(node.pos?.y)).toBe(true)
    }

    let closePairs = 0
    let totalPairs = 0
    for (let i = 0; i < layouted.nodes.length; i += 1) {
      for (let j = i + 1; j < layouted.nodes.length; j += 1) {
        totalPairs += 1
        if (distance(layouted.nodes[i].pos!, layouted.nodes[j].pos!) < 8) {
          closePairs += 1
        }
      }
    }

    expect(closePairs / totalPairs).toBeLessThan(0.12)
  })
})

