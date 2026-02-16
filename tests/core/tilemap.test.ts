import { describe, expect, it } from 'vitest'
import { generateDungeon } from '../../src/core/generate'
import { layoutDungeon } from '../../src/core/layout'
import { buildTilemapFromDungeon, validateTilemap } from '../../src/core/tilemap'
import { createRng } from '../../src/core/rng'

function hashTiles(tiles: string[]): string {
  let hash = 2166136261
  for (const tile of tiles) {
    for (let i = 0; i < tile.length; i += 1) {
      hash ^= tile.charCodeAt(i)
      hash = Math.imul(hash, 16777619)
    }
  }
  return (hash >>> 0).toString(16)
}

function buildSampleTilemap(seed: number) {
  const params = {
    roomCount: 44,
    branching: 1.8,
    loopChance: 0.35,
    style: 'branchy' as const,
  }
  const dungeon = generateDungeon(params, createRng(seed))
  const layouted = layoutDungeon(dungeon, {
    width: 1200,
    height: 800,
    iterations: 180,
    padding: 64,
    seed: seed ^ 0x9e3779b9,
  })
  return buildTilemapFromDungeon(layouted, {
    width: 128,
    height: 96,
    tileSize: 16,
    rngSeed: seed ^ 0xa53f9d21,
  })
}

describe('tilemap conversion', () => {
  it('is deterministic for the same seed and params', () => {
    const tilemapA = buildSampleTilemap(20260216)
    const tilemapB = buildSampleTilemap(20260216)
    expect(hashTiles(tilemapA.tiles)).toEqual(hashTiles(tilemapB.tiles))
    expect(tilemapA.rooms).toEqual(tilemapB.rooms)
    expect(tilemapA.doors).toEqual(tilemapB.doors)
  })

  it('builds non-overlapping room rectangles', () => {
    const tilemap = buildSampleTilemap(777)
    for (let i = 0; i < tilemap.rooms.length; i += 1) {
      for (let j = i + 1; j < tilemap.rooms.length; j += 1) {
        const a = tilemap.rooms[i]
        const b = tilemap.rooms[j]
        const overlap = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
        expect(overlap).toBe(false)
      }
    }
  })

  it('passes tilemap connectivity validation', () => {
    const tilemap = buildSampleTilemap(9911)
    const validation = validateTilemap(tilemap)
    expect(validation.valid).toBe(true)
    expect(validation.stats.connected).toBe(true)
    expect(validation.stats.startBossDistance).toBeGreaterThan(0)
  })
})

