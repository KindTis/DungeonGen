import { describe, expect, it } from 'vitest'
import { generateDungeon } from '../../src/core/generate'
import { createRng } from '../../src/core/rng'
import { validateDungeon } from '../../src/core/validate'

describe('generateDungeon', () => {
  it('builds expected node counts and required node types', () => {
    const params = {
      roomCount: 40,
      branching: 1.8,
      loopChance: 0.3,
      style: 'branchy' as const,
    }
    const dungeon = generateDungeon(params, createRng(2026))
    expect(dungeon.nodes).toHaveLength(40)
    expect(dungeon.nodes.filter((node) => node.type === 'start')).toHaveLength(1)
    expect(dungeon.nodes.filter((node) => node.type === 'boss')).toHaveLength(1)
  })

  it('passes validator constraints for a typical seed', () => {
    const params = {
      roomCount: 48,
      branching: 1.5,
      loopChance: 0.25,
      style: 'loopy' as const,
    }
    const dungeon = generateDungeon(params, createRng(987654))
    const validation = validateDungeon(dungeon, params)
    expect(validation.valid).toBe(true)
    expect(validation.stats.connected).toBe(true)
    expect(validation.stats.startBossDistance).toBeGreaterThan(0)
  })
})

