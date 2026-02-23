export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 4
export const ZOOM_STEP = 1.15

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function clampZoom(scale: number): number {
  return clamp(scale, MIN_ZOOM, MAX_ZOOM)
}

export function zoomIn(scale: number): number {
  return clampZoom(scale * ZOOM_STEP)
}

export function zoomOut(scale: number): number {
  return clampZoom(scale / ZOOM_STEP)
}

export interface ZoomAnchorInput {
  oldScale: number
  newScale: number
  scrollLeft: number
  scrollTop: number
  anchorX: number
  anchorY: number
}

export interface ZoomAnchorResult {
  scrollLeft: number
  scrollTop: number
}

export function scrollForZoomAnchor(input: ZoomAnchorInput): ZoomAnchorResult {
  const { oldScale, newScale, scrollLeft, scrollTop, anchorX, anchorY } = input
  if (oldScale <= 0 || newScale <= 0) {
    return { scrollLeft, scrollTop }
  }
  const worldX = (scrollLeft + anchorX) / oldScale
  const worldY = (scrollTop + anchorY) / oldScale
  return {
    scrollLeft: worldX * newScale - anchorX,
    scrollTop: worldY * newScale - anchorY,
  }
}

