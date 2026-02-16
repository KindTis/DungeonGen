import { describe, expect, it } from 'vitest'
import { createRng, hashStringToU32, normalizeSeed } from '../../src/core/rng'

describe('rng', () => {
  it('produces deterministic sequence for same seed', () => {
    const a = createRng(12345)
    const b = createRng(12345)
    const seqA = [a.next(), a.next(), a.next(), a.next(), a.next()]
    const seqB = [b.next(), b.next(), b.next(), b.next(), b.next()]
    expect(seqA).toEqual(seqB)
  })

  it('normalizes string seed deterministically', () => {
    expect(normalizeSeed('abc-seed')).toBe(hashStringToU32('abc-seed'))
    expect(normalizeSeed('abc-seed')).toBe(2588829171)
  })

  it('normalizes numeric string and number to same u32', () => {
    expect(normalizeSeed('42')).toBe(normalizeSeed(42))
  })
})
