import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, MIN_ZOOM, clampZoom, scrollForZoomAnchor, zoomIn, zoomOut } from '../../src/app/viewport'

describe('viewport utilities', () => {
  it('clamps zoom range', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(999)).toBe(MAX_ZOOM)
    expect(clampZoom(1.75)).toBe(1.75)
  })

  it('zooms in and out within bounds', () => {
    expect(zoomIn(1)).toBeGreaterThan(1)
    expect(zoomOut(1)).toBeLessThan(1)
    expect(zoomIn(MAX_ZOOM)).toBe(MAX_ZOOM)
    expect(zoomOut(MIN_ZOOM)).toBe(MIN_ZOOM)
  })

  it('keeps cursor-anchored world point stable after zoom', () => {
    const anchorX = 320
    const anchorY = 180
    const before = {
      oldScale: 1,
      newScale: 2,
      scrollLeft: 240,
      scrollTop: 120,
      anchorX,
      anchorY,
    }
    const next = scrollForZoomAnchor(before)

    const worldXBefore = (before.scrollLeft + anchorX) / before.oldScale
    const worldYBefore = (before.scrollTop + anchorY) / before.oldScale
    const worldXAfter = (next.scrollLeft + anchorX) / before.newScale
    const worldYAfter = (next.scrollTop + anchorY) / before.newScale

    expect(worldXAfter).toBe(worldXBefore)
    expect(worldYAfter).toBe(worldYBefore)
  })
})

