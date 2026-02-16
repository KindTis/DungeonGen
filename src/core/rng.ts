const UINT32_SIZE = 0x1_0000_0000

export interface Rng {
  readonly seed: number
  next: () => number
  nextInt: (maxExclusive: number) => number
  pick: <T>(items: T[]) => T
}

export function hashStringToU32(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function normalizeSeed(seedInput: string | number): number {
  if (typeof seedInput === 'number' && Number.isFinite(seedInput)) {
    return seedInput >>> 0
  }

  const trimmed = String(seedInput).trim()
  if (trimmed === '') {
    return hashStringToU32('default-seed')
  }

  const asNumber = Number(trimmed)
  if (Number.isFinite(asNumber)) {
    return asNumber >>> 0
  }

  return hashStringToU32(trimmed)
}

function createMulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_SIZE
  }
}

export function createRng(seed: number): Rng {
  const normalizedSeed = normalizeSeed(seed)
  const nextFloat = createMulberry32(normalizedSeed)

  return {
    seed: normalizedSeed,
    next: () => nextFloat(),
    nextInt: (maxExclusive: number) => {
      if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) {
        return 0
      }
      return Math.floor(nextFloat() * maxExclusive)
    },
    pick: <T>(items: T[]) => {
      if (items.length === 0) {
        throw new Error('Cannot pick from an empty array.')
      }
      return items[Math.floor(nextFloat() * items.length)]
    },
  }
}

