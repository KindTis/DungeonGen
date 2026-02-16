import type { Dungeon, RoomType } from './model'
import { createRng } from './rng'

export type TileType = 'void' | 'floor' | 'wall' | 'door'

export interface RoomRect {
  id: string
  type: RoomType
  x: number
  y: number
  w: number
  h: number
}

export interface DoorPoint {
  x: number
  y: number
  roomA: string
  roomB: string
}

export interface Tilemap {
  width: number
  height: number
  tileSize: number
  tiles: TileType[]
  rooms: RoomRect[]
  doors: DoorPoint[]
  startRoomId: string
  bossRoomId: string
  meta: {
    seed: number
    version: string
  }
}

export interface TilemapBuildOptions {
  width: number
  height: number
  tileSize?: number
  roomMinSize?: number
  roomMaxSize?: number
  roomPadding?: number
  placementRetries?: number
  rngSeed?: number
}

export interface TilemapStats {
  roomCount: number
  doorCount: number
  floorTiles: number
  corridorTiles: number
  connected: boolean
  startBossDistance: number
}

export interface TilemapValidationIssue {
  code: string
  message: string
}

export interface TilemapValidationResult {
  valid: boolean
  issues: TilemapValidationIssue[]
  stats: TilemapStats
}

const TILEMAP_VERSION = 'tilemap-mvp-1'

interface Point {
  x: number
  y: number
}

function tileIndex(width: number, x: number, y: number): number {
  return y * width + x
}

function isInside(width: number, height: number, x: number, y: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function rectIntersects(a: RoomRect, b: RoomRect, padding: number): boolean {
  return (
    a.x - padding < b.x + b.w &&
    a.x + a.w + padding > b.x &&
    a.y - padding < b.y + b.h &&
    a.y + a.h + padding > b.y
  )
}

function findNodeRange(dungeon: Dungeon): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const node of dungeon.nodes) {
    const px = node.pos?.x ?? 0
    const py = node.pos?.y ?? 0
    minX = Math.min(minX, px)
    minY = Math.min(minY, py)
    maxX = Math.max(maxX, px)
    maxY = Math.max(maxY, py)
  }

  return { minX, maxX, minY, maxY }
}

function findCenter(rect: RoomRect): Point {
  return {
    x: rect.x + Math.floor(rect.w / 2),
    y: rect.y + Math.floor(rect.h / 2),
  }
}

function carveRoom(tiles: TileType[], width: number, height: number, room: RoomRect): void {
  for (let y = room.y; y < room.y + room.h; y += 1) {
    for (let x = room.x; x < room.x + room.w; x += 1) {
      if (isInside(width, height, x, y)) {
        tiles[tileIndex(width, x, y)] = 'floor'
      }
    }
  }
}

function carveLine(tiles: TileType[], width: number, height: number, from: Point, to: Point): void {
  let x = from.x
  let y = from.y
  const dx = Math.sign(to.x - from.x)
  const dy = Math.sign(to.y - from.y)
  while (x !== to.x || y !== to.y) {
    if (isInside(width, height, x, y)) {
      tiles[tileIndex(width, x, y)] = 'floor'
    }
    if (x !== to.x) {
      x += dx
    } else if (y !== to.y) {
      y += dy
    }
  }
  if (isInside(width, height, x, y)) {
    tiles[tileIndex(width, x, y)] = 'floor'
  }
}

function toGridPoint(
  x: number,
  y: number,
  range: { minX: number; maxX: number; minY: number; maxY: number },
  width: number,
  height: number,
): Point {
  const rx = Math.max(1, range.maxX - range.minX)
  const ry = Math.max(1, range.maxY - range.minY)
  return {
    x: clamp(Math.round(((x - range.minX) / rx) * (width - 1)), 1, width - 2),
    y: clamp(Math.round(((y - range.minY) / ry) * (height - 1)), 1, height - 2),
  }
}

function pickRoomSize(
  type: RoomType,
  roomMinSize: number,
  roomMaxSize: number,
  rngNextInt: (maxExclusive: number) => number,
): { w: number; h: number } {
  const majorBoost = type === 'start' || type === 'boss' ? 2 : 0
  const min = roomMinSize + majorBoost
  const max = roomMaxSize + majorBoost
  return {
    w: min + rngNextInt(max - min + 1),
    h: min + rngNextInt(max - min + 1),
  }
}

function placeRoomCandidate(
  nodeId: string,
  nodeType: RoomType,
  anchor: Point,
  existing: RoomRect[],
  options: {
    width: number
    height: number
    roomMinSize: number
    roomMaxSize: number
    roomPadding: number
    placementRetries: number
    next: () => number
    nextInt: (maxExclusive: number) => number
  },
): RoomRect {
  const { width, height, roomMinSize, roomMaxSize, roomPadding, placementRetries, next, nextInt } = options
  const size = pickRoomSize(nodeType, roomMinSize, roomMaxSize, nextInt)

  const clampRect = (x: number, y: number): RoomRect => {
    const nx = clamp(x, 1, width - size.w - 2)
    const ny = clamp(y, 1, height - size.h - 2)
    return { id: nodeId, type: nodeType, x: nx, y: ny, w: size.w, h: size.h }
  }

  for (let attempt = 0; attempt < placementRetries; attempt += 1) {
    const radius = Math.ceil((attempt + 1) / 2)
    const jitterX = Math.round((next() * 2 - 1) * radius * 2.5)
    const jitterY = Math.round((next() * 2 - 1) * radius * 2.5)
    const candidate = clampRect(anchor.x - Math.floor(size.w / 2) + jitterX, anchor.y - Math.floor(size.h / 2) + jitterY)
    const intersects = existing.some((rect) => rectIntersects(candidate, rect, roomPadding))
    if (!intersects) {
      return candidate
    }
  }

  // Deterministic fallback scan around the anchor.
  for (let radius = 1; radius < Math.max(width, height); radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
          continue
        }
        const candidate = clampRect(anchor.x + dx - Math.floor(size.w / 2), anchor.y + dy - Math.floor(size.h / 2))
        const intersects = existing.some((rect) => rectIntersects(candidate, rect, roomPadding))
        if (!intersects) {
          return candidate
        }
      }
    }
  }

  return clampRect(anchor.x - Math.floor(size.w / 2), anchor.y - Math.floor(size.h / 2))
}

function createDoorAndOutside(room: RoomRect, target: Point): { door: Point; outside: Point } {
  const center = findCenter(room)
  const dx = target.x - center.x
  const dy = target.y - center.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0) {
      const y = clamp(target.y, room.y + 1, room.y + room.h - 2)
      return { door: { x: room.x + room.w - 1, y }, outside: { x: room.x + room.w, y } }
    }
    const y = clamp(target.y, room.y + 1, room.y + room.h - 2)
    return { door: { x: room.x, y }, outside: { x: room.x - 1, y } }
  }
  if (dy >= 0) {
    const x = clamp(target.x, room.x + 1, room.x + room.w - 2)
    return { door: { x, y: room.y + room.h - 1 }, outside: { x, y: room.y + room.h } }
  }
  const x = clamp(target.x, room.x + 1, room.x + room.w - 2)
  return { door: { x, y: room.y }, outside: { x, y: room.y - 1 } }
}

function addWalls(tiles: TileType[], width: number, height: number): TileType[] {
  const result = tiles.slice()
  const dirs: Point[] = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = tileIndex(width, x, y)
      if (tiles[index] !== 'floor' && tiles[index] !== 'door') {
        continue
      }
      for (const dir of dirs) {
        const nx = x + dir.x
        const ny = y + dir.y
        if (!isInside(width, height, nx, ny)) {
          continue
        }
        const neighborIndex = tileIndex(width, nx, ny)
        if (result[neighborIndex] === 'void') {
          result[neighborIndex] = 'wall'
        }
      }
    }
  }
  return result
}

export function buildTilemapFromDungeon(dungeon: Dungeon, options: TilemapBuildOptions): Tilemap {
  const width = options.width
  const height = options.height
  const tileSize = options.tileSize ?? 16
  const roomMinSize = options.roomMinSize ?? 6
  const roomMaxSize = options.roomMaxSize ?? 10
  const roomPadding = options.roomPadding ?? 1
  const placementRetries = options.placementRetries ?? 120
  const rngSeed = options.rngSeed ?? (dungeon.meta.seed ^ 0xa53f9d21)

  const rng = createRng(rngSeed)
  const range = findNodeRange(dungeon)
  const tiles: TileType[] = new Array(width * height).fill('void')
  const rooms: RoomRect[] = []
  const roomById = new Map<string, RoomRect>()

  for (const node of dungeon.nodes) {
    const px = node.pos?.x ?? 0
    const py = node.pos?.y ?? 0
    const anchor = toGridPoint(px, py, range, width, height)
    const room = placeRoomCandidate(node.id, node.type, anchor, rooms, {
      width,
      height,
      roomMinSize,
      roomMaxSize,
      roomPadding,
      placementRetries,
      next: rng.next,
      nextInt: rng.nextInt,
    })
    rooms.push(room)
    roomById.set(room.id, room)
    carveRoom(tiles, width, height, room)
  }

  const doors: DoorPoint[] = []
  const doorSet = new Set<string>()
  for (const edge of dungeon.edges) {
    const roomA = roomById.get(edge.a)
    const roomB = roomById.get(edge.b)
    if (!roomA || !roomB) {
      continue
    }

    const centerA = findCenter(roomA)
    const centerB = findCenter(roomB)
    const a = createDoorAndOutside(roomA, centerB)
    const b = createDoorAndOutside(roomB, centerA)

    const firstHorizontal = rng.next() > 0.5
    if (firstHorizontal) {
      carveLine(tiles, width, height, a.outside, { x: b.outside.x, y: a.outside.y })
      carveLine(tiles, width, height, { x: b.outside.x, y: a.outside.y }, b.outside)
    } else {
      carveLine(tiles, width, height, a.outside, { x: a.outside.x, y: b.outside.y })
      carveLine(tiles, width, height, { x: a.outside.x, y: b.outside.y }, b.outside)
    }

    const keyA = `${a.door.x},${a.door.y}`
    if (!doorSet.has(keyA)) {
      doors.push({ x: a.door.x, y: a.door.y, roomA: roomA.id, roomB: roomB.id })
      doorSet.add(keyA)
    }
    const keyB = `${b.door.x},${b.door.y}`
    if (!doorSet.has(keyB)) {
      doors.push({ x: b.door.x, y: b.door.y, roomA: roomA.id, roomB: roomB.id })
      doorSet.add(keyB)
    }
  }

  const finalized = addWalls(tiles, width, height)
  for (const door of doors) {
    if (isInside(width, height, door.x, door.y)) {
      finalized[tileIndex(width, door.x, door.y)] = 'door'
    }
  }

  const startRoom = rooms.find((room) => room.type === 'start')
  const bossRoom = rooms.find((room) => room.type === 'boss')

  return {
    width,
    height,
    tileSize,
    tiles: finalized,
    rooms,
    doors,
    startRoomId: startRoom?.id ?? '',
    bossRoomId: bossRoom?.id ?? '',
    meta: {
      seed: dungeon.meta.seed,
      version: TILEMAP_VERSION,
    },
  }
}

function isPassable(tile: TileType): boolean {
  return tile === 'floor' || tile === 'door'
}

function bfsPassable(
  tilemap: Tilemap,
  start: Point,
): { distance: Map<number, number>; visited: Set<number> } {
  const distance = new Map<number, number>()
  const visited = new Set<number>()
  const startIndex = tileIndex(tilemap.width, start.x, start.y)
  if (!isInside(tilemap.width, tilemap.height, start.x, start.y)) {
    return { distance, visited }
  }
  if (!isPassable(tilemap.tiles[startIndex])) {
    return { distance, visited }
  }

  const queue: number[] = [startIndex]
  distance.set(startIndex, 0)
  visited.add(startIndex)

  const dirs: Point[] = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]

  for (let i = 0; i < queue.length; i += 1) {
    const index = queue[i]
    const x = index % tilemap.width
    const y = Math.floor(index / tilemap.width)
    const dist = distance.get(index) ?? 0

    for (const dir of dirs) {
      const nx = x + dir.x
      const ny = y + dir.y
      if (!isInside(tilemap.width, tilemap.height, nx, ny)) {
        continue
      }
      const nIndex = tileIndex(tilemap.width, nx, ny)
      if (visited.has(nIndex) || !isPassable(tilemap.tiles[nIndex])) {
        continue
      }
      visited.add(nIndex)
      distance.set(nIndex, dist + 1)
      queue.push(nIndex)
    }
  }

  return { distance, visited }
}

export function validateTilemap(tilemap: Tilemap): TilemapValidationResult {
  const issues: TilemapValidationIssue[] = []
  const startRoom = tilemap.rooms.find((room) => room.id === tilemap.startRoomId)
  const bossRoom = tilemap.rooms.find((room) => room.id === tilemap.bossRoomId)
  if (!startRoom) {
    issues.push({ code: 'MISSING_START_ROOM', message: 'Start room is missing in tilemap.' })
  }
  if (!bossRoom) {
    issues.push({ code: 'MISSING_BOSS_ROOM', message: 'Boss room is missing in tilemap.' })
  }

  const roomArea = tilemap.rooms.reduce((sum, room) => sum + room.w * room.h, 0)
  const floorTiles = tilemap.tiles.filter((tile) => tile === 'floor').length
  const doorCount = tilemap.tiles.filter((tile) => tile === 'door').length
  const passableTotal = tilemap.tiles.filter((tile) => isPassable(tile)).length

  let startBossDistance = -1
  let connected = false

  if (startRoom && bossRoom) {
    const startCenter = findCenter(startRoom)
    const bossCenter = findCenter(bossRoom)
    const bfs = bfsPassable(tilemap, startCenter)
    const bossIndex = tileIndex(tilemap.width, bossCenter.x, bossCenter.y)
    startBossDistance = bfs.distance.get(bossIndex) ?? -1
    connected = bfs.visited.size === passableTotal
    if (startBossDistance < 0) {
      issues.push({ code: 'START_BOSS_DISCONNECTED', message: 'No passable path from start to boss.' })
    }
    if (!connected) {
      issues.push({ code: 'PASSABLE_ISLANDS', message: 'Passable tiles are split into multiple regions.' })
    }
  }

  const dirs: Point[] = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]
  for (const door of tilemap.doors) {
    if (!isInside(tilemap.width, tilemap.height, door.x, door.y)) {
      issues.push({
        code: 'DOOR_OUT_OF_BOUNDS',
        message: `Door ${door.x},${door.y} is outside the tilemap bounds.`,
      })
      continue
    }
    const doorTile = tilemap.tiles[tileIndex(tilemap.width, door.x, door.y)]
    if (doorTile !== 'door') {
      issues.push({
        code: 'DOOR_TILE_MISMATCH',
        message: `Door ${door.x},${door.y} is not marked as door tile.`,
      })
    }
    let passableNeighbors = 0
    for (const dir of dirs) {
      const nx = door.x + dir.x
      const ny = door.y + dir.y
      if (!isInside(tilemap.width, tilemap.height, nx, ny)) {
        continue
      }
      if (isPassable(tilemap.tiles[tileIndex(tilemap.width, nx, ny)])) {
        passableNeighbors += 1
      }
    }
    if (passableNeighbors < 2) {
      issues.push({
        code: 'DOOR_ISOLATED',
        message: `Door ${door.x},${door.y} does not connect enough passable neighbors.`,
      })
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    stats: {
      roomCount: tilemap.rooms.length,
      doorCount,
      floorTiles,
      corridorTiles: Math.max(0, floorTiles - roomArea),
      connected,
      startBossDistance,
    },
  }
}
