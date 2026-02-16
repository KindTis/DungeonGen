import { describe, expect, it } from 'vitest'
import type { Dungeon } from '../../src/core/model'
import { validateDungeon } from '../../src/core/validate'

describe('validateDungeon', () => {
  it('returns failure when boss is unreachable', () => {
    const dungeon: Dungeon = {
      meta: {
        seed: 1,
        params: { roomCount: 3, branching: 1, loopChance: 0, style: 'linear' },
        version: 'test',
      },
      nodes: [
        { id: 's', type: 'start' },
        { id: 'n', type: 'normal' },
        { id: 'b', type: 'boss' },
      ],
      edges: [{ a: 's', b: 'n' }],
    }

    const result = validateDungeon(dungeon, {
      roomCount: 3,
      branching: 1,
      loopChance: 0,
      style: 'linear',
    })

    expect(result.valid).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'BOSS_UNREACHABLE')).toBe(true)
  })
})

