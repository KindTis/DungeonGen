import { describe, expect, it } from 'vitest'
import type { Tilemap } from '../../src/core/tilemap'
import { renderTilemapToCanvas } from '../../src/render/renderTilemapCanvas'

class FakeGradient {
  addColorStop(offset: number, color: string): void {
    void offset
    void color
  }
}

function createFakeContext() {
  const counters = {
    radialGradient: 0,
    arc: 0,
    fillRect: 0,
  }
  const context = {
    imageSmoothingEnabled: false,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    clearRect: () => undefined,
    fillRect: () => {
      counters.fillRect += 1
    },
    strokeRect: () => undefined,
    beginPath: () => undefined,
    arc: () => {
      counters.arc += 1
    },
    fill: () => undefined,
    stroke: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    drawImage: () => undefined,
    createLinearGradient: () => new FakeGradient(),
    createRadialGradient: () => {
      counters.radialGradient += 1
      return new FakeGradient()
    },
  } as unknown as CanvasRenderingContext2D

  return { context, counters }
}

function createTilemap(): Tilemap {
  return {
    width: 8,
    height: 6,
    tileSize: 16,
    tiles: [
      'void',
      'void',
      'void',
      'void',
      'void',
      'void',
      'void',
      'void',
      'void',
      'wall',
      'wall',
      'wall',
      'wall',
      'wall',
      'wall',
      'void',
      'void',
      'wall',
      'floor',
      'floor',
      'door',
      'floor',
      'wall',
      'void',
      'void',
      'wall',
      'floor',
      'floor',
      'floor',
      'floor',
      'wall',
      'void',
      'void',
      'wall',
      'wall',
      'wall',
      'wall',
      'wall',
      'wall',
      'void',
      'void',
      'void',
      'void',
      'void',
      'void',
      'void',
      'void',
      'void',
    ],
    rooms: [{ id: 'room-0', type: 'start', x: 1, y: 1, w: 6, h: 4 }],
    doors: [{ x: 4, y: 2, roomA: 'room-0', roomB: 'room-1', side: 'east', throatX: 5, throatY: 2, edgeKey: 'a::b' }],
    props: [{ x: 3, y: 3, kind: 'crate', roomId: 'room-0' }],
    lights: [{ x: 5, y: 3, kind: 'torch', intensity: 0.35, radius: 3.2 }],
    startRoomId: 'room-0',
    bossRoomId: 'room-0',
    meta: {
      seed: 123,
      edgeCount: 1,
      doorCountExpected: 2,
      version: 'tilemap-mvp-4-visual',
    },
  }
}

describe('renderTilemapToCanvas', () => {
  it('renders without sprites when props and lights exist', () => {
    const { context, counters } = createFakeContext()
    const tilemap = createTilemap()
    expect(() => {
      renderTilemapToCanvas(context, tilemap, {
        width: 640,
        height: 480,
        background: 'transparent',
        margin: 16,
        sprites: null,
      })
    }).not.toThrow()
    expect(counters.fillRect).toBeGreaterThan(0)
  })

  it('draws glow using radial gradients for light sources', () => {
    const { context, counters } = createFakeContext()
    const tilemap = createTilemap()
    renderTilemapToCanvas(context, tilemap, {
      width: 640,
      height: 480,
      background: 'transparent',
      margin: 16,
      sprites: null,
    })
    expect(counters.radialGradient).toBeGreaterThanOrEqual(tilemap.lights.length)
    expect(counters.arc).toBeGreaterThan(0)
  })
})
