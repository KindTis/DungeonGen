import type { TileSprites } from '../app/tileset'
import type { TileType, Tilemap } from '../core/tilemap'

type BackgroundMode = 'white' | 'transparent'

export interface RenderTilemapOptions {
  width: number
  height: number
  margin?: number
  background?: BackgroundMode
  sprites?: TileSprites | null
}

interface Point {
  x: number
  y: number
}

function tileIndex(width: number, x: number, y: number): number {
  return y * width + x
}

function isInside(tilemap: Tilemap, x: number, y: number): boolean {
  return x >= 0 && x < tilemap.width && y >= 0 && y < tilemap.height
}

function isPassable(tile: TileType): boolean {
  return tile === 'floor' || tile === 'door'
}

function floorVariant(x: number, y: number, seed: number): 0 | 1 {
  const h = (x * 374761393 + y * 668265263 + seed * 982451653) >>> 0
  return (h & 1) as 0 | 1
}

function wallMask(tilemap: Tilemap, x: number, y: number): number {
  const dirs: Array<Point & { bit: number }> = [
    { x: 0, y: -1, bit: 1 },
    { x: 1, y: 0, bit: 2 },
    { x: 0, y: 1, bit: 4 },
    { x: -1, y: 0, bit: 8 },
  ]
  let mask = 0
  for (const dir of dirs) {
    const nx = x + dir.x
    const ny = y + dir.y
    if (!isInside(tilemap, nx, ny)) {
      continue
    }
    if (isPassable(tilemap.tiles[tileIndex(tilemap.width, nx, ny)])) {
      mask |= dir.bit
    }
  }
  return mask
}

function fillBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: BackgroundMode,
): void {
  context.clearRect(0, 0, width, height)
  if (background === 'white') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    return
  }
  const gradient = context.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#151720')
  gradient.addColorStop(1, '#11151f')
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
}

function drawFallbackTile(
  context: CanvasRenderingContext2D,
  tile: TileType,
  x: number,
  y: number,
  size: number,
): void {
  const color =
    tile === 'floor'
      ? '#5f5a54'
      : tile === 'wall'
        ? '#2f343e'
        : tile === 'door'
          ? '#8a6847'
          : 'rgba(9,11,16,0.7)'
  context.fillStyle = color
  context.fillRect(x, y, size, size)
}

function drawWallOverlay(
  context: CanvasRenderingContext2D,
  mask: number,
  x: number,
  y: number,
  size: number,
): void {
  const edge = Math.max(1, Math.round(size * 0.15))
  context.fillStyle = 'rgba(198, 210, 229, 0.22)'
  if (mask & 1) {
    context.fillRect(x, y, size, edge)
  }
  if (mask & 2) {
    context.fillRect(x + size - edge, y, edge, size)
  }
  if (mask & 4) {
    context.fillRect(x, y + size - edge, size, edge)
  }
  if (mask & 8) {
    context.fillRect(x, y, edge, size)
  }
}

export function renderTilemapToCanvas(
  context: CanvasRenderingContext2D,
  tilemap: Tilemap,
  options: RenderTilemapOptions,
): void {
  const width = options.width
  const height = options.height
  const margin = options.margin ?? 24
  const background = options.background ?? 'transparent'
  const sprites = options.sprites ?? null

  fillBackground(context, width, height, background)

  const mapPixelWidth = tilemap.width * tilemap.tileSize
  const mapPixelHeight = tilemap.height * tilemap.tileSize
  const scale = Math.min((width - margin * 2) / mapPixelWidth, (height - margin * 2) / mapPixelHeight)
  const drawTileSize = Math.max(1, Math.floor(tilemap.tileSize * scale))
  const drawWidth = tilemap.width * drawTileSize
  const drawHeight = tilemap.height * drawTileSize
  const originX = Math.floor((width - drawWidth) / 2)
  const originY = Math.floor((height - drawHeight) / 2)

  context.imageSmoothingEnabled = false

  for (let y = 0; y < tilemap.height; y += 1) {
    for (let x = 0; x < tilemap.width; x += 1) {
      const tile = tilemap.tiles[tileIndex(tilemap.width, x, y)]
      const px = originX + x * drawTileSize
      const py = originY + y * drawTileSize

      if (!sprites) {
        drawFallbackTile(context, tile, px, py, drawTileSize)
        continue
      }

      if (tile === 'floor') {
        const variant = floorVariant(x, y, tilemap.meta.seed)
        const floorImage = variant === 0 ? sprites.floorA : sprites.floorB
        context.drawImage(floorImage, px, py, drawTileSize, drawTileSize)
      } else if (tile === 'wall') {
        context.drawImage(sprites.wall, px, py, drawTileSize, drawTileSize)
        drawWallOverlay(context, wallMask(tilemap, x, y), px, py, drawTileSize)
      } else if (tile === 'door') {
        context.drawImage(sprites.door, px, py, drawTileSize, drawTileSize)
      } else {
        context.fillStyle = '#0f131d'
        context.fillRect(px, py, drawTileSize, drawTileSize)
      }
    }
  }

  const startRoom = tilemap.rooms.find((room) => room.id === tilemap.startRoomId)
  const bossRoom = tilemap.rooms.find((room) => room.id === tilemap.bossRoomId)
  const markers = [
    { room: startRoom, image: sprites?.start },
    { room: bossRoom, image: sprites?.boss },
  ]

  for (const marker of markers) {
    if (!marker.room || !marker.image) {
      continue
    }
    const centerX = marker.room.x + Math.floor(marker.room.w / 2)
    const centerY = marker.room.y + Math.floor(marker.room.h / 2)
    const px = originX + centerX * drawTileSize
    const py = originY + centerY * drawTileSize
    const markerSize = Math.max(10, Math.floor(drawTileSize * 1.2))
    context.drawImage(
      marker.image,
      Math.floor(px - markerSize / 2),
      Math.floor(py - markerSize / 2),
      markerSize,
      markerSize,
    )
  }

  context.strokeStyle = 'rgba(230, 238, 255, 0.18)'
  context.lineWidth = 1
  context.strokeRect(originX - 1, originY - 1, drawWidth + 2, drawHeight + 2)
}

