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

export type DoorSide = 'north' | 'east' | 'south' | 'west'

export interface DoorPoint {
  x: number
  y: number
  roomA: string
  roomB: string
  side: DoorSide
  throatX: number
  throatY: number
  edgeKey: string
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
    edgeCount: number
    doorCountExpected: number
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

const TILEMAP_VERSION = 'tilemap-mvp-3'
const HEAT_WEIGHT = 1.0
const BEND_WEIGHT = 2
const DOOR_PROXIMITY_RADIUS = 4
const DOOR_PROXIMITY_WEIGHT = 6

interface Point {
  x: number
  y: number
}

interface DoorPlacement {
  door: Point
  outside: Point
  side: DoorSide
}

interface EdgeCorridorPath {
  points: Point[]
  bend: Point
}

function tileIndex(width: number, x: number, y: number): number {
  return y * width + x
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`
}

function isInside(width: number, height: number, x: number, y: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function rectIntersects(a: RoomRect, b: RoomRect, padding: number): boolean {
  return (
    a.x - padding < b.x + b.w &&
    a.x + a.w + padding > b.x &&
    a.y - padding < b.y + b.h &&
    a.y + a.h + padding > b.y
  )
}

function pointInRect(point: Point, rect: RoomRect): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.w &&
    point.y >= rect.y &&
    point.y < rect.y + rect.h
  )
}

function isPointOnRoomBoundary(point: Point, room: RoomRect): boolean {
  const onVertical =
    (point.x === room.x || point.x === room.x + room.w - 1) &&
    point.y >= room.y &&
    point.y < room.y + room.h
  const onHorizontal =
    (point.y === room.y || point.y === room.y + room.h - 1) &&
    point.x >= room.x &&
    point.x < room.x + room.w
  return onVertical || onHorizontal
}

function isInsideRoomInterior(point: Point, room: RoomRect): boolean {
  return (
    point.x > room.x &&
    point.x < room.x + room.w - 1 &&
    point.y > room.y &&
    point.y < room.y + room.h - 1
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

function carveRoomInterior(tiles: TileType[], width: number, height: number, room: RoomRect): void {
  for (let y = room.y + 1; y < room.y + room.h - 1; y += 1) {
    for (let x = room.x + 1; x < room.x + room.w - 1; x += 1) {
      if (isInside(width, height, x, y)) {
        tiles[tileIndex(width, x, y)] = 'floor'
      }
    }
  }
}

function linePoints(from: Point, to: Point): Point[] {
  const points: Point[] = []
  let x = from.x
  let y = from.y
  const dx = Math.sign(to.x - from.x)
  const dy = Math.sign(to.y - from.y)
  points.push({ x, y })
  while (x !== to.x || y !== to.y) {
    if (x !== to.x) {
      x += dx
    } else if (y !== to.y) {
      y += dy
    }
    points.push({ x, y })
  }
  return points
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

function chooseDoorSide(room: RoomRect, target: Point): DoorSide {
  const center = findCenter(room)
  const dx = target.x - center.x
  const dy = target.y - center.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'east' : 'west'
  }
  return dy >= 0 ? 'south' : 'north'
}

function sidePriority(primary: DoorSide): DoorSide[] {
  if (primary === 'north') {
    return ['north', 'east', 'west', 'south']
  }
  if (primary === 'south') {
    return ['south', 'east', 'west', 'north']
  }
  if (primary === 'east') {
    return ['east', 'north', 'south', 'west']
  }
  return ['west', 'north', 'south', 'east']
}

function enumerateDoorPlacements(room: RoomRect, side: DoorSide): DoorPlacement[] {
  const placements: DoorPlacement[] = []
  if (side === 'north' || side === 'south') {
    const y = side === 'north' ? room.y : room.y + room.h - 1
    const outsideY = side === 'north' ? room.y - 1 : room.y + room.h
    for (let x = room.x + 1; x < room.x + room.w - 1; x += 1) {
      placements.push({
        side,
        door: { x, y },
        outside: { x, y: outsideY },
      })
    }
    return placements
  }

  const x = side === 'west' ? room.x : room.x + room.w - 1
  const outsideX = side === 'west' ? room.x - 1 : room.x + room.w
  for (let y = room.y + 1; y < room.y + room.h - 1; y += 1) {
    placements.push({
      side,
      door: { x, y },
      outside: { x: outsideX, y },
    })
  }
  return placements
}

function doorwaySeparationPenalty(candidate: DoorPlacement, used: Point[]): number {
  let penalty = 0
  for (const door of used) {
    if (candidate.side === 'north' || candidate.side === 'south') {
      if (door.y === candidate.door.y) {
        const dx = Math.abs(door.x - candidate.door.x)
        if (dx <= 1) {
          penalty += 500
        } else if (dx <= 2) {
          penalty += 120
        }
      }
    } else if (door.x === candidate.door.x) {
      const dy = Math.abs(door.y - candidate.door.y)
      if (dy <= 1) {
        penalty += 500
      } else if (dy <= 2) {
        penalty += 120
      }
    }
  }
  return penalty
}

function violatesSingleTileEntry(candidate: DoorPlacement, used: Point[]): boolean {
  for (const door of used) {
    if (candidate.side === 'north' || candidate.side === 'south') {
      if (door.y === candidate.door.y && Math.abs(door.x - candidate.door.x) <= 1) {
        return true
      }
      continue
    }
    if (door.x === candidate.door.x && Math.abs(door.y - candidate.door.y) <= 1) {
      return true
    }
  }
  return false
}

function selectDoorPlacement(
  room: RoomRect,
  target: Point,
  width: number,
  height: number,
  rooms: RoomRect[],
  usedByRoom: Map<string, Point[]>,
): DoorPlacement | null {
  const primary = chooseDoorSide(room, target)
  const order = sidePriority(primary)
  const used = usedByRoom.get(room.id) ?? []

  let best: DoorPlacement | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const side of order) {
    const candidates = enumerateDoorPlacements(room, side)
    for (const candidate of candidates) {
      if (!isInside(width, height, candidate.outside.x, candidate.outside.y)) {
        continue
      }

      if (rooms.some((other) => other.id !== room.id && pointInRect(candidate.outside, other))) {
        continue
      }

      if (used.some((door) => door.x === candidate.door.x && door.y === candidate.door.y)) {
        continue
      }
      if (violatesSingleTileEntry(candidate, used)) {
        continue
      }

      const targetDistance = manhattan(candidate.outside, target)
      const centerDistance = manhattan(candidate.door, findCenter(room))
      const separationPenalty = doorwaySeparationPenalty(candidate, used)
      const score = targetDistance * 4 + centerDistance + separationPenalty

      if (score < bestScore) {
        best = candidate
        bestScore = score
      }
    }
    if (best) {
      break
    }
  }

  return best
}

function reserveDoorPlacement(usedByRoom: Map<string, Point[]>, roomId: string, door: Point): void {
  const nextUsed = usedByRoom.get(roomId) ?? []
  nextUsed.push({ x: door.x, y: door.y })
  usedByRoom.set(roomId, nextUsed)
}

function buildCorridorPath(from: Point, to: Point, horizontalFirst: boolean): EdgeCorridorPath {
  const bend = horizontalFirst ? { x: to.x, y: from.y } : { x: from.x, y: to.y }
  const first = linePoints(from, bend)
  const second = linePoints(bend, to).slice(1)
  return { bend, points: [...first, ...second] }
}

function pathIntersectsAnyRoom(path: EdgeCorridorPath, rooms: RoomRect[]): boolean {
  for (const point of path.points) {
    for (const room of rooms) {
      if (pointInRect(point, room)) {
        return true
      }
    }
  }
  return false
}

function scoreCorridorPath(
  path: EdgeCorridorPath,
  heat: number[],
  width: number,
  existingDoors: DoorPoint[],
): number {
  let heatPenalty = 0
  for (const point of path.points) {
    heatPenalty += heat[tileIndex(width, point.x, point.y)]
  }
  heatPenalty *= HEAT_WEIGHT

  const bendPenalty = BEND_WEIGHT

  let proximityPenalty = 0
  for (const door of existingDoors) {
    const distance = manhattan(path.bend, { x: door.x, y: door.y })
    if (distance <= DOOR_PROXIMITY_RADIUS) {
      proximityPenalty += (DOOR_PROXIMITY_RADIUS - distance + 1) * DOOR_PROXIMITY_WEIGHT
    }
  }

  return heatPenalty + bendPenalty + proximityPenalty
}

function findGridPathAvoidingRooms(
  from: Point,
  to: Point,
  width: number,
  height: number,
  rooms: RoomRect[],
): Point[] | null {
  const blocked = new Uint8Array(width * height)
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) {
        if (isInside(width, height, x, y)) {
          blocked[tileIndex(width, x, y)] = 1
        }
      }
    }
  }
  blocked[tileIndex(width, from.x, from.y)] = 0
  blocked[tileIndex(width, to.x, to.y)] = 0

  const parent = new Int32Array(width * height)
  parent.fill(-1)
  const visited = new Uint8Array(width * height)
  const start = tileIndex(width, from.x, from.y)
  const goal = tileIndex(width, to.x, to.y)
  const queue: number[] = [start]
  visited[start] = 1

  const dirs: Point[] = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]

  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i]
    if (current === goal) {
      break
    }
    const cx = current % width
    const cy = Math.floor(current / width)
    for (const dir of dirs) {
      const nx = cx + dir.x
      const ny = cy + dir.y
      if (!isInside(width, height, nx, ny)) {
        continue
      }
      const ni = tileIndex(width, nx, ny)
      if (visited[ni] || blocked[ni]) {
        continue
      }
      visited[ni] = 1
      parent[ni] = current
      queue.push(ni)
    }
  }

  if (!visited[goal]) {
    return null
  }

  const reversed: Point[] = []
  let cursor = goal
  while (cursor !== -1) {
    reversed.push({ x: cursor % width, y: Math.floor(cursor / width) })
    if (cursor === start) {
      break
    }
    cursor = parent[cursor]
  }
  reversed.reverse()
  return reversed
}

function bendFromPoints(points: Point[]): Point {
  if (points.length < 3) {
    return points[Math.floor(points.length / 2)] ?? { x: 0, y: 0 }
  }
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const c = points[i + 1]
    const dir1 = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) }
    const dir2 = { x: Math.sign(c.x - b.x), y: Math.sign(c.y - b.y) }
    if (dir1.x !== dir2.x || dir1.y !== dir2.y) {
      return b
    }
  }
  return points[Math.floor(points.length / 2)]
}

function selectCorridorPath(
  from: Point,
  to: Point,
  heat: number[],
  width: number,
  height: number,
  rooms: RoomRect[],
  existingDoors: DoorPoint[],
): EdgeCorridorPath | null {
  const candidates = [buildCorridorPath(from, to, true), buildCorridorPath(from, to, false)].filter((path) => {
    return !pathIntersectsAnyRoom(path, rooms)
  })

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      const scoreA = scoreCorridorPath(a, heat, width, existingDoors)
      const scoreB = scoreCorridorPath(b, heat, width, existingDoors)
      if (scoreA !== scoreB) {
        return scoreA - scoreB
      }
      if (a.bend.x !== b.bend.x) {
        return a.bend.x - b.bend.x
      }
      if (a.bend.y !== b.bend.y) {
        return a.bend.y - b.bend.y
      }
      return a.points.length - b.points.length
    })
    return candidates[0]
  }

  const fallbackPoints = findGridPathAvoidingRooms(from, to, width, height, rooms)
  if (!fallbackPoints || fallbackPoints.length === 0) {
    return null
  }
  return {
    points: fallbackPoints,
    bend: bendFromPoints(fallbackPoints),
  }
}

function carveCorridor(
  tiles: TileType[],
  heat: number[],
  width: number,
  height: number,
  path: EdgeCorridorPath,
): void {
  for (const point of path.points) {
    if (!isInside(width, height, point.x, point.y)) {
      continue
    }
    const index = tileIndex(width, point.x, point.y)
    tiles[index] = 'floor'
    heat[index] += 1
  }
}

function appendDoor(doors: DoorPoint[], doorSet: Set<string>, door: DoorPoint): void {
  const unique = `${door.x},${door.y}:${door.roomA}:${door.roomB}`
  if (doorSet.has(unique)) {
    return
  }
  doorSet.add(unique)
  doors.push(door)
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
        const nIndex = tileIndex(width, nx, ny)
        if (result[nIndex] === 'void') {
          result[nIndex] = 'wall'
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
  const heat: number[] = new Array(width * height).fill(0)
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
    carveRoomInterior(tiles, width, height, room)
  }

  const doors: DoorPoint[] = []
  const doorSet = new Set<string>()
  const doorPlacementsByRoom = new Map<string, Point[]>()

  for (const edge of dungeon.edges) {
    const roomA = roomById.get(edge.a)
    const roomB = roomById.get(edge.b)
    if (!roomA || !roomB) {
      continue
    }

    const centerA = findCenter(roomA)
    const centerB = findCenter(roomB)

    const placementA = selectDoorPlacement(roomA, centerB, width, height, rooms, doorPlacementsByRoom)
    const placementB = selectDoorPlacement(roomB, centerA, width, height, rooms, doorPlacementsByRoom)
    if (!placementA || !placementB) {
      continue
    }

    const path = selectCorridorPath(placementA.outside, placementB.outside, heat, width, height, rooms, doors)
    if (!path) {
      continue
    }
    reserveDoorPlacement(doorPlacementsByRoom, roomA.id, placementA.door)
    reserveDoorPlacement(doorPlacementsByRoom, roomB.id, placementB.door)
    carveCorridor(tiles, heat, width, height, path)

    const key = edgeKey(roomA.id, roomB.id)
    const doorA: DoorPoint = {
      x: placementA.door.x,
      y: placementA.door.y,
      roomA: roomA.id,
      roomB: roomB.id,
      side: placementA.side,
      throatX: placementA.outside.x,
      throatY: placementA.outside.y,
      edgeKey: key,
    }
    const doorB: DoorPoint = {
      x: placementB.door.x,
      y: placementB.door.y,
      roomA: roomB.id,
      roomB: roomA.id,
      side: placementB.side,
      throatX: placementB.outside.x,
      throatY: placementB.outside.y,
      edgeKey: key,
    }
    appendDoor(doors, doorSet, doorA)
    appendDoor(doors, doorSet, doorB)
  }

  for (const door of doors) {
    if (isInside(width, height, door.x, door.y)) {
      tiles[tileIndex(width, door.x, door.y)] = 'door'
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
      edgeCount: dungeon.edges.length,
      doorCountExpected: dungeon.edges.length * 2,
      version: TILEMAP_VERSION,
    },
  }
}

function isPassable(tile: TileType): boolean {
  return tile === 'floor' || tile === 'door'
}

function bfsPassable(tilemap: Tilemap, start: Point): { distance: Map<number, number>; visited: Set<number> } {
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

function sideDelta(side: DoorSide): Point {
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

function sideFrameNeighbors(door: DoorPoint): Point[] {
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

export function validateTilemap(tilemap: Tilemap): TilemapValidationResult {
  const issues: TilemapValidationIssue[] = []
  const roomById = new Map(tilemap.rooms.map((room) => [room.id, room]))
  const startRoom = roomById.get(tilemap.startRoomId)
  const bossRoom = roomById.get(tilemap.bossRoomId)
  if (!startRoom) {
    issues.push({ code: 'MISSING_START_ROOM', message: 'Start room is missing in tilemap.' })
  }
  if (!bossRoom) {
    issues.push({ code: 'MISSING_BOSS_ROOM', message: 'Boss room is missing in tilemap.' })
  }

  const roomInteriorArea = tilemap.rooms.reduce((sum, room) => sum + Math.max(0, room.w - 2) * Math.max(0, room.h - 2), 0)
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

  const edgeDoorCounter = new Map<string, number>()

  for (const door of tilemap.doors) {
    if (!isInside(tilemap.width, tilemap.height, door.x, door.y)) {
      issues.push({
        code: 'DOOR_OUT_OF_BOUNDS',
        message: `Door ${door.x},${door.y} is outside tilemap bounds.`,
      })
      continue
    }

    const room = roomById.get(door.roomA)
    if (!room) {
      issues.push({
        code: 'DOOR_ROOM_NOT_FOUND',
        message: `Door ${door.x},${door.y} references missing room ${door.roomA}.`,
      })
      continue
    }

    if (!isPointOnRoomBoundary({ x: door.x, y: door.y }, room)) {
      issues.push({
        code: 'DOOR_NOT_ON_ROOM_BOUNDARY',
        message: `Door ${door.x},${door.y} is not on room boundary.`,
      })
    }

    if (isInsideRoomInterior({ x: door.x, y: door.y }, room)) {
      issues.push({
        code: 'DOOR_INTERIOR_INVALID',
        message: `Door ${door.x},${door.y} is inside room interior.`,
      })
    }

    const doorTile = tilemap.tiles[tileIndex(tilemap.width, door.x, door.y)]
    if (doorTile !== 'door') {
      issues.push({
        code: 'DOOR_TILE_MISMATCH',
        message: `Door ${door.x},${door.y} is not marked as door tile.`,
      })
    }

    const delta = sideDelta(door.side)
    const expectedThroat = { x: door.x + delta.x, y: door.y + delta.y }
    const expectedInside = { x: door.x - delta.x, y: door.y - delta.y }

    if (door.throatX !== expectedThroat.x || door.throatY !== expectedThroat.y) {
      issues.push({
        code: 'DOOR_THROAT_INVALID',
        message: `Door ${door.x},${door.y} throat metadata is inconsistent.`,
      })
    }

    if (!isInside(tilemap.width, tilemap.height, door.throatX, door.throatY)) {
      issues.push({
        code: 'DOOR_THROAT_OOB',
        message: `Door ${door.x},${door.y} throat is outside bounds.`,
      })
    } else {
      const throatTile = tilemap.tiles[tileIndex(tilemap.width, door.throatX, door.throatY)]
      if (!isPassable(throatTile)) {
        issues.push({
          code: 'DOOR_CONNECTIVITY_INVALID',
          message: `Door ${door.x},${door.y} throat is not passable.`,
        })
      }
    }

    if (!isInside(tilemap.width, tilemap.height, expectedInside.x, expectedInside.y)) {
      issues.push({
        code: 'DOOR_CONNECTIVITY_INVALID',
        message: `Door ${door.x},${door.y} room-side neighbor is out of bounds.`,
      })
    } else {
      const insideTile = tilemap.tiles[tileIndex(tilemap.width, expectedInside.x, expectedInside.y)]
      if (!isPassable(insideTile)) {
        issues.push({
          code: 'DOOR_CONNECTIVITY_INVALID',
          message: `Door ${door.x},${door.y} does not connect to room interior.`,
        })
      }
    }

    for (const frame of sideFrameNeighbors(door)) {
      if (!isInside(tilemap.width, tilemap.height, frame.x, frame.y)) {
        issues.push({
          code: 'DOOR_SIDE_NOT_WALL',
          message: `Door ${door.x},${door.y} has out-of-bounds side frame at ${frame.x},${frame.y}.`,
        })
        continue
      }
      const frameTile = tilemap.tiles[tileIndex(tilemap.width, frame.x, frame.y)]
      if (frameTile !== 'wall') {
        issues.push({
          code: 'DOOR_SIDE_NOT_WALL',
          message: `Door ${door.x},${door.y} side frame at ${frame.x},${frame.y} is ${frameTile}.`,
        })
      }
    }

    edgeDoorCounter.set(door.edgeKey, (edgeDoorCounter.get(door.edgeKey) ?? 0) + 1)
  }

  for (const room of tilemap.rooms) {
    const specs: Array<{
      side: DoorSide
      collect: () => Array<{ boundary: Point; outside: Point }>
    }> = [
      {
        side: 'north',
        collect: () => {
          const points: Array<{ boundary: Point; outside: Point }> = []
          for (let x = room.x + 1; x < room.x + room.w - 1; x += 1) {
            points.push({ boundary: { x, y: room.y }, outside: { x, y: room.y - 1 } })
          }
          return points
        },
      },
      {
        side: 'south',
        collect: () => {
          const points: Array<{ boundary: Point; outside: Point }> = []
          for (let x = room.x + 1; x < room.x + room.w - 1; x += 1) {
            points.push({ boundary: { x, y: room.y + room.h - 1 }, outside: { x, y: room.y + room.h } })
          }
          return points
        },
      },
      {
        side: 'west',
        collect: () => {
          const points: Array<{ boundary: Point; outside: Point }> = []
          for (let y = room.y + 1; y < room.y + room.h - 1; y += 1) {
            points.push({ boundary: { x: room.x, y }, outside: { x: room.x - 1, y } })
          }
          return points
        },
      },
      {
        side: 'east',
        collect: () => {
          const points: Array<{ boundary: Point; outside: Point }> = []
          for (let y = room.y + 1; y < room.y + room.h - 1; y += 1) {
            points.push({ boundary: { x: room.x + room.w - 1, y }, outside: { x: room.x + room.w, y } })
          }
          return points
        },
      },
    ]

    for (const spec of specs) {
      const points = spec.collect()
      for (let i = 0; i < points.length; i += 1) {
        const { boundary, outside } = points[i]
        if (!isInside(tilemap.width, tilemap.height, boundary.x, boundary.y)) {
          continue
        }
        const boundaryTile = tilemap.tiles[tileIndex(tilemap.width, boundary.x, boundary.y)]
        if (boundaryTile === 'floor') {
          issues.push({
            code: 'ROOM_ENTRY_WIDTH_INVALID',
            message: `Room ${room.id} boundary at ${boundary.x},${boundary.y} is open floor.`,
          })
        }

        if (boundaryTile === 'door' && !isInside(tilemap.width, tilemap.height, outside.x, outside.y)) {
          issues.push({
            code: 'DOOR_CONNECTIVITY_INVALID',
            message: `Door on room ${room.id} boundary at ${boundary.x},${boundary.y} exits map bounds.`,
          })
        }

        const next = points[i + 1]
        if (!next) {
          continue
        }
        const nextTile = tilemap.tiles[tileIndex(tilemap.width, next.boundary.x, next.boundary.y)]
        if (boundaryTile === 'door' && nextTile === 'door') {
          issues.push({
            code: 'ROOM_ENTRY_WIDTH_INVALID',
            message: `Room ${room.id} has adjacent doors on ${spec.side} side near ${boundary.x},${boundary.y}.`,
          })
        }
      }
    }
  }

  if (doorCount !== tilemap.meta.doorCountExpected) {
    issues.push({
      code: 'DOOR_COUNT_MISMATCH',
      message: `Door count ${doorCount} does not match expected ${tilemap.meta.doorCountExpected}.`,
    })
  }

  edgeDoorCounter.forEach((count, key) => {
    if (count !== 2) {
      issues.push({
        code: 'EDGE_DOOR_PAIR_INVALID',
        message: `Edge ${key} has ${count} doors; expected 2.`,
      })
    }
  })

  return {
    valid: issues.length === 0,
    issues,
    stats: {
      roomCount: tilemap.rooms.length,
      doorCount,
      floorTiles,
      corridorTiles: Math.max(0, floorTiles - roomInteriorArea),
      connected,
      startBossDistance,
    },
  }
}
