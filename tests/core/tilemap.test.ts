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

function sideFrameNeighbors(door: { x: number; y: number; side: 'north' | 'east' | 'south' | 'west' }) {
  if (door.side === 'north' || door.side === 'south') {
    return [
      { x: door.x - 1, y: door.y },
      { x: door.x + 1, y: door.y },
    ]
  }
  return [
    { x: door.x, y: door.y - 1 },
    { x: door.x, y: door.y + 1 },
  ]
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

  it('creates two doors per edge', () => {
    const tilemap = buildSampleTilemap(123456)
    expect(tilemap.meta.doorCountExpected).toBe(tilemap.meta.edgeCount * 2)
    expect(tilemap.doors.length).toBe(tilemap.meta.doorCountExpected)
  })

  it('places doors on room boundaries with consistent throat metadata', () => {
    const tilemap = buildSampleTilemap(123456)
    const roomById = new Map(tilemap.rooms.map((room) => [room.id, room]))
    const sideDelta = (side: 'north' | 'east' | 'south' | 'west') => {
      if (side === 'north') {
        return { x: 0, y: -1 }
      }
      if (side === 'south') {
        return { x: 0, y: 1 }
      }
      if (side === 'west') {
        return { x: -1, y: 0 }
      }
      return { x: 1, y: 0 }
    }

    const isOnBoundary = (
      door: { x: number; y: number },
      room: { x: number; y: number; w: number; h: number },
    ) => {
      const onVertical =
        (door.x === room.x || door.x === room.x + room.w - 1) &&
        door.y >= room.y &&
        door.y < room.y + room.h
      const onHorizontal =
        (door.y === room.y || door.y === room.y + room.h - 1) &&
        door.x >= room.x &&
        door.x < room.x + room.w
      return onVertical || onHorizontal
    }

    const isInsideInterior = (
      door: { x: number; y: number },
      room: { x: number; y: number; w: number; h: number },
    ) => {
      return (
        door.x > room.x &&
        door.x < room.x + room.w - 1 &&
        door.y > room.y &&
        door.y < room.y + room.h - 1
      )
    }

    for (const door of tilemap.doors) {
      const roomA = roomById.get(door.roomA)
      expect(roomA).toBeTruthy()
      if (roomA) {
        expect(isOnBoundary(door, roomA)).toBe(true)
        expect(isInsideInterior(door, roomA)).toBe(false)
        const delta = sideDelta(door.side)
        expect(door.throatX).toBe(door.x + delta.x)
        expect(door.throatY).toBe(door.y + delta.y)
        const throatIndex = door.throatY * tilemap.width + door.throatX
        const throatTile = tilemap.tiles[throatIndex]
        expect(throatTile === 'floor' || throatTile === 'door').toBe(true)
      }
    }
  })

  it('keeps room boundary openings single-tile wide', () => {
    const tilemap = buildSampleTilemap(123456)
    const tileAt = (x: number, y: number) => tilemap.tiles[y * tilemap.width + x]

    for (const room of tilemap.rooms) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x += 1) {
        expect(tileAt(x, room.y)).not.toBe('floor')
        expect(tileAt(x, room.y + room.h - 1)).not.toBe('floor')
      }
      for (let y = room.y + 1; y < room.y + room.h - 1; y += 1) {
        expect(tileAt(room.x, y)).not.toBe('floor')
        expect(tileAt(room.x + room.w - 1, y)).not.toBe('floor')
      }
    }
  })

  it('keeps wall frame on both sides of every door', () => {
    const tilemap = buildSampleTilemap(123456)
    const tileAt = (x: number, y: number) => tilemap.tiles[y * tilemap.width + x]
    for (const door of tilemap.doors) {
      for (const frame of sideFrameNeighbors(door)) {
        expect(frame.x).toBeGreaterThanOrEqual(0)
        expect(frame.y).toBeGreaterThanOrEqual(0)
        expect(frame.x).toBeLessThan(tilemap.width)
        expect(frame.y).toBeLessThan(tilemap.height)
        expect(tileAt(frame.x, frame.y)).toBe('wall')
      }
    }
  })

  it('reports door-side wall violations', () => {
    const tilemap = buildSampleTilemap(9876)
    const door = tilemap.doors[0]
    const frame = sideFrameNeighbors(door)[0]
    const index = frame.y * tilemap.width + frame.x
    const corrupted = {
      ...tilemap,
      tiles: tilemap.tiles.map((tile, i) => (i === index ? 'void' : tile)),
    }
    const validation = validateTilemap(corrupted)
    expect(validation.issues.some((issue) => issue.code === 'DOOR_SIDE_NOT_WALL')).toBe(true)
  })

  it('reports a mismatch when door count differs from expected pair count', () => {
    const tilemap = buildSampleTilemap(2027)
    const firstNonDoor = tilemap.tiles.findIndex((tile) => tile !== 'door')
    expect(firstNonDoor).toBeGreaterThanOrEqual(0)
    const corrupted = {
      ...tilemap,
      tiles: tilemap.tiles.map((tile, index) => (index === firstNonDoor ? 'door' : tile)),
    }
    const validation = validateTilemap(corrupted)
    expect(validation.issues.some((issue) => issue.code === 'DOOR_COUNT_MISMATCH')).toBe(true)
  })

  it('reports boundary violations for off-boundary doors', () => {
    const tilemap = buildSampleTilemap(88)
    const badDoor = {
      ...tilemap.doors[0],
      x: tilemap.rooms[0].x + 2,
      y: tilemap.rooms[0].y + 2,
    }
    const corrupted = {
      ...tilemap,
      doors: [badDoor, ...tilemap.doors.slice(1)],
    }
    const validation = validateTilemap(corrupted)
    expect(validation.issues.some((issue) => issue.code === 'DOOR_NOT_ON_ROOM_BOUNDARY')).toBe(true)
  })
})
