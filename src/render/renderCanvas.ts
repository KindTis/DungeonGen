import type { Dungeon, RoomNode } from '../core/model'

type BackgroundMode = 'white' | 'transparent'

export interface IconAssets {
  start?: CanvasImageSource | null
  boss?: CanvasImageSource | null
}

export interface RenderOptions {
  width: number
  height: number
  margin?: number
  background?: BackgroundMode
  showLabels?: boolean
  icons?: IconAssets
}

function nodeColor(node: RoomNode): string {
  if (node.type === 'start') {
    return '#2fbf71'
  }
  if (node.type === 'boss') {
    return '#dd3f56'
  }
  return '#5e84c8'
}

export function renderDungeonToCanvas(
  context: CanvasRenderingContext2D,
  dungeon: Dungeon,
  options: RenderOptions,
): void {
  const margin = options.margin ?? 24
  const width = options.width
  const height = options.height
  const background = options.background ?? 'transparent'

  context.clearRect(0, 0, width, height)

  if (background === 'white') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
  } else {
    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#0f2137')
    gradient.addColorStop(1, '#162f47')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
  }

  context.save()
  context.strokeStyle = 'rgba(214, 234, 255, 0.55)'
  context.lineWidth = 2
  for (const edge of dungeon.edges) {
    const a = dungeon.nodes.find((node) => node.id === edge.a)
    const b = dungeon.nodes.find((node) => node.id === edge.b)
    if (!a?.pos || !b?.pos) {
      continue
    }
    context.beginPath()
    context.moveTo(a.pos.x, a.pos.y)
    context.lineTo(b.pos.x, b.pos.y)
    context.stroke()
  }
  context.restore()

  for (const node of dungeon.nodes) {
    if (!node.pos) {
      continue
    }

    const radius = node.type === 'boss' ? 16 : 13
    context.save()
    context.shadowColor = 'rgba(10, 14, 22, 0.35)'
    context.shadowBlur = 12
    context.beginPath()
    context.arc(node.pos.x, node.pos.y, radius, 0, Math.PI * 2)
    context.fillStyle = nodeColor(node)
    context.fill()
    context.lineWidth = node.type === 'boss' || node.type === 'start' ? 3 : 2
    context.strokeStyle = '#f4fbff'
    context.stroke()
    context.restore()

    const icon = node.type === 'start' ? options.icons?.start : node.type === 'boss' ? options.icons?.boss : null
    if (icon) {
      const iconSize = node.type === 'boss' ? 16 : 14
      context.drawImage(icon, node.pos.x - iconSize / 2, node.pos.y - iconSize / 2, iconSize, iconSize)
    }

    if (options.showLabels) {
      context.fillStyle = '#f0f8ff'
      context.font = '12px "Space Grotesk", sans-serif'
      context.textAlign = 'center'
      context.fillText(node.type, node.pos.x, node.pos.y + radius + 14)
    }
  }

  context.strokeStyle = 'rgba(236, 245, 255, 0.2)'
  context.lineWidth = 1
  context.strokeRect(margin / 2, margin / 2, width - margin, height - margin)
}

