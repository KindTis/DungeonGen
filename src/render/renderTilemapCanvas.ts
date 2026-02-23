import type { TileSprites, WallVariantKey } from '../app/tileset'
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

function floorVariantIndex(x: number, y: number, seed: number, variantCount: number): number {
  const h = (x * 374761393 + y * 668265263 + seed * 982451653) >>> 0
  return variantCount <= 0 ? 0 : h % variantCount
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

function bitCount(mask: number): number {
  let value = mask
  let count = 0
  while (value > 0) {
    count += value & 1
    value >>= 1
  }
  return count
}

function wallVariant(mask: number): WallVariantKey {
  const count = bitCount(mask)
  if (count >= 3) {
    return 'cap'
  }
  const hasNorth = (mask & 1) !== 0
  const hasEast = (mask & 2) !== 0
  const hasSouth = (mask & 4) !== 0
  const hasWest = (mask & 8) !== 0
  const corner = (hasNorth && hasEast) || (hasEast && hasSouth) || (hasSouth && hasWest) || (hasWest && hasNorth)
  if (corner && count === 2) {
    return 'innerCorner'
  }
  if (count === 1) {
    return 'outerCorner'
  }
  return 'face'
}

type DoorOrientation = 'horizontal' | 'vertical' | 'block'

function doorOrientation(tilemap: Tilemap, x: number, y: number): DoorOrientation {
  const left = isInside(tilemap, x - 1, y) && isPassable(tilemap.tiles[tileIndex(tilemap.width, x - 1, y)])
  const right = isInside(tilemap, x + 1, y) && isPassable(tilemap.tiles[tileIndex(tilemap.width, x + 1, y)])
  const up = isInside(tilemap, x, y - 1) && isPassable(tilemap.tiles[tileIndex(tilemap.width, x, y - 1)])
  const down = isInside(tilemap, x, y + 1) && isPassable(tilemap.tiles[tileIndex(tilemap.width, x, y + 1)])

  if (left && right && !up && !down) {
    return 'horizontal'
  }
  if (up && down && !left && !right) {
    return 'vertical'
  }
  return 'block'
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

function drawPropFallback(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  const inset = Math.max(1, Math.floor(size * 0.22))
  context.fillStyle = '#705846'
  context.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2)
  context.strokeStyle = '#2a211c'
  context.lineWidth = 1
  context.strokeRect(x + inset + 0.5, y + inset + 0.5, size - inset * 2 - 1, size - inset * 2 - 1)
}

function drawDoorOverlay(
  context: CanvasRenderingContext2D,
  orientation: DoorOrientation,
  x: number,
  y: number,
  size: number,
): void {
  const glyphSize = Math.max(6, size)
  const inset = Math.max(1, Math.floor(glyphSize * 0.16))
  const frame = '#1b120d'
  const plank = '#d1965a'
  const highlight = '#ffe0ad'
  const shadow = '#6e482a'

  context.fillStyle = 'rgba(0, 0, 0, 0.42)'
  context.fillRect(x + 1, y + 1, glyphSize, glyphSize)

  context.fillStyle = frame
  context.fillRect(x, y, glyphSize, glyphSize)
  context.fillStyle = plank
  context.fillRect(x + inset, y + inset, glyphSize - inset * 2, glyphSize - inset * 2)
  context.strokeStyle = highlight
  context.lineWidth = 1
  context.strokeRect(x + inset, y + inset, glyphSize - inset * 2, glyphSize - inset * 2)
  context.strokeStyle = 'rgba(0, 0, 0, 0.9)'
  context.strokeRect(x + 0.5, y + 0.5, glyphSize - 1, glyphSize - 1)

  context.fillStyle = shadow
  if (orientation === 'horizontal') {
    const mid = x + Math.floor(glyphSize / 2)
    context.fillRect(mid - 1, y + inset, 2, glyphSize - inset * 2)
  } else if (orientation === 'vertical') {
    const mid = y + Math.floor(glyphSize / 2)
    context.fillRect(x + inset, mid - 1, glyphSize - inset * 2, 2)
  } else {
    context.fillRect(x + inset + 1, y + inset + 1, Math.max(1, glyphSize - inset * 2 - 2), 2)
    context.fillRect(x + inset + 1, y + glyphSize - inset - 3, Math.max(1, glyphSize - inset * 2 - 2), 2)
  }

  context.fillStyle = highlight
  const knob = Math.max(1, Math.floor(glyphSize * 0.14))
  context.fillRect(x + glyphSize - inset - knob - 1, y + Math.floor(glyphSize / 2), knob, knob)
}

function drawLightGlow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  intensity: number,
): void {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, `rgba(255, 213, 140, ${Math.min(0.9, intensity + 0.25)})`)
  gradient.addColorStop(0.5, `rgba(255, 175, 88, ${Math.min(0.55, intensity)})`)
  gradient.addColorStop(1, 'rgba(255, 140, 48, 0)')
  context.save()
  context.globalCompositeOperation = 'lighter'
  context.fillStyle = gradient
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function drawLightFallback(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  const r = Math.max(1.5, size * 0.22)
  context.save()
  context.beginPath()
  context.arc(x, y, r, 0, Math.PI * 2)
  context.fillStyle = '#ffb35d'
  context.fill()
  context.restore()
}

function drawMarkerRing(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  kind: 'start' | 'boss',
): void {
  const radius = Math.max(6, size * 0.6)
  context.save()
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fillStyle = kind === 'start' ? 'rgba(72, 220, 166, 0.24)' : 'rgba(231, 88, 116, 0.26)'
  context.fill()
  context.lineWidth = Math.max(1, Math.floor(size * 0.1))
  context.strokeStyle = kind === 'start' ? 'rgba(104, 255, 197, 0.95)' : 'rgba(255, 149, 171, 0.95)'
  context.stroke()
  context.restore()
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
        const variant = floorVariantIndex(x, y, tilemap.meta.seed, sprites.floorVariants.length)
        const floorImage = sprites.floorVariants[variant]
        context.drawImage(floorImage, px, py, drawTileSize, drawTileSize)
      } else if (tile === 'wall') {
        const mask = wallMask(tilemap, x, y)
        const variantKey = wallVariant(mask)
        context.drawImage(sprites.wallVariants[variantKey], px, py, drawTileSize, drawTileSize)
        drawWallOverlay(context, wallMask(tilemap, x, y), px, py, drawTileSize)
      } else if (tile === 'door') {
        const orientation = doorOrientation(tilemap, x, y)
        const doorSprite =
          orientation === 'horizontal'
            ? sprites.doorHorizontal
            : orientation === 'vertical'
              ? sprites.doorVertical
              : sprites.doorFrame
        context.drawImage(doorSprite, px, py, drawTileSize, drawTileSize)
        drawDoorOverlay(context, orientation, px, py, drawTileSize)
      } else {
        context.fillStyle = '#0f131d'
        context.fillRect(px, py, drawTileSize, drawTileSize)
      }
    }
  }

  for (const prop of tilemap.props) {
    const px = originX + prop.x * drawTileSize
    const py = originY + prop.y * drawTileSize
    if (sprites) {
      const image = sprites.props[prop.kind]
      context.drawImage(image, px, py, drawTileSize, drawTileSize)
    } else {
      drawPropFallback(context, px, py, drawTileSize)
    }
  }

  for (const light of tilemap.lights) {
    const cx = originX + light.x * drawTileSize + Math.floor(drawTileSize / 2)
    const cy = originY + light.y * drawTileSize + Math.floor(drawTileSize / 2)
    const glowRadius = Math.max(drawTileSize * 1.4, drawTileSize * light.radius)
    drawLightGlow(context, cx, cy, glowRadius, light.intensity)
  }

  for (const light of tilemap.lights) {
    const px = originX + light.x * drawTileSize
    const py = originY + light.y * drawTileSize
    if (sprites) {
      const image = sprites.lights[light.kind]
      context.drawImage(image, px, py, drawTileSize, drawTileSize)
    } else {
      drawLightFallback(context, px + drawTileSize / 2, py + drawTileSize / 2, drawTileSize)
    }
  }

  const startRoom = tilemap.rooms.find((room) => room.id === tilemap.startRoomId)
  const bossRoom = tilemap.rooms.find((room) => room.id === tilemap.bossRoomId)
  const markers: Array<{ room: typeof startRoom; image?: TileSprites['start']; kind: 'start' | 'boss' }> = [
    { room: startRoom, image: sprites?.start, kind: 'start' },
    { room: bossRoom, image: sprites?.boss, kind: 'boss' },
  ]

  for (const marker of markers) {
    if (!marker.room || !marker.image) {
      continue
    }
    const centerX = marker.room.x + Math.floor(marker.room.w / 2)
    const centerY = marker.room.y + Math.floor(marker.room.h / 2)
    const px = originX + centerX * drawTileSize
    const py = originY + centerY * drawTileSize
    const markerSize = Math.max(12, Math.floor(drawTileSize * 1.8))
    drawMarkerRing(context, px, py, markerSize, marker.kind)
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
