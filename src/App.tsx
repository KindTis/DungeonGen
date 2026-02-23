import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import styles from './app/App.module.css'
import { DEFAULT_UI_STATE } from './app/constants'
import { ActionButtons } from './app/controls/ActionButtons'
import { ParamForm } from './app/controls/ParamForm'
import { SummaryPanel } from './app/controls/SummaryPanel'
import { loadTileSprites, type TileSprites } from './app/tileset'
import { clampZoom, scrollForZoomAnchor, zoomIn, zoomOut } from './app/viewport'
import type { UiState } from './app/types'
import { generateDungeon } from './core/generate'
import { layoutDungeon } from './core/layout'
import type { Dungeon, DungeonParams } from './core/model'
import { createRng, normalizeSeed } from './core/rng'
import { sanitizeDungeonParams, validateDungeon } from './core/validate'
import { buildTilemapFromDungeon, type Tilemap, validateTilemap } from './core/tilemap'
import { downloadPng, exportCanvasToPng } from './render/exportPng'
import { renderTilemapToCanvas } from './render/renderTilemapCanvas'

const CANVAS_WIDTH = 2048
const CANVAS_HEIGHT = 1536
const TILEMAP_WIDTH = 128
const TILEMAP_HEIGHT = 96
const TILE_SIZE = 16
const DEFAULT_CANVAS_DISPLAY_WIDTH = 1200
const MIN_CANVAS_DISPLAY_WIDTH = 320

interface DragState {
  pointerId: number
  startX: number
  startY: number
  startScrollLeft: number
  startScrollTop: number
}

function toDungeonParams(state: UiState): DungeonParams {
  return sanitizeDungeonParams({
    roomCount: state.roomCount,
    branching: state.branching,
    loopChance: state.loopChance,
    style: state.style,
  })
}

function App() {
  const [uiState, setUiState] = useState<UiState>(DEFAULT_UI_STATE)
  const [dungeon, setDungeon] = useState<Dungeon | null>(null)
  const [tilemap, setTilemap] = useState<Tilemap | null>(null)
  const [issueMessages, setIssueMessages] = useState<string[]>([])
  const [statsLines, setStatsLines] = useState<string[]>([])
  const [statusMessage, setStatusMessage] = useState<string>('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapViewportRef = useRef<HTMLDivElement>(null)
  const [tileSprites, setTileSprites] = useState<TileSprites | null>(null)
  const [zoomScale, setZoomScale] = useState(1)
  const zoomScaleRef = useRef(1)
  const dragRef = useRef<DragState | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(DEFAULT_CANVAS_DISPLAY_WIDTH)

  const baseCanvasWidth = useMemo(() => {
    const fitWidth = Math.max(MIN_CANVAS_DISPLAY_WIDTH, viewportWidth - 4)
    return Math.min(DEFAULT_CANVAS_DISPLAY_WIDTH, fitWidth)
  }, [viewportWidth])

  const baseCanvasHeight = useMemo(() => {
    return Math.round((baseCanvasWidth * CANVAS_HEIGHT) / CANVAS_WIDTH)
  }, [baseCanvasWidth])

  const displayCanvasWidth = useMemo(() => Math.round(baseCanvasWidth * zoomScale), [baseCanvasWidth, zoomScale])
  const displayCanvasHeight = useMemo(() => Math.round(baseCanvasHeight * zoomScale), [baseCanvasHeight, zoomScale])

  useEffect(() => {
    loadTileSprites()
      .then(setTileSprites)
      .catch(() => {
        setStatusMessage('Tile sprites failed to preload. Fallback rendering enabled.')
      })
  }, [])

  useEffect(() => {
    zoomScaleRef.current = zoomScale
  }, [zoomScale])

  useEffect(() => {
    const viewport = mapViewportRef.current
    if (!viewport) {
      return
    }
    const updateWidth = () => {
      setViewportWidth(viewport.clientWidth)
    }
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(viewport)
    return () => {
      observer.disconnect()
    }
  }, [])

  const updateField = useCallback(
    <K extends keyof UiState>(field: K, value: UiState[K]) => {
      setUiState((current) => ({ ...current, [field]: value }))
    },
    [],
  )

  const centerViewport = useCallback(
    (scale: number) => {
      const viewport = mapViewportRef.current
      if (!viewport) {
        return
      }
      const contentWidth = Math.round(baseCanvasWidth * scale)
      const contentHeight = Math.round(baseCanvasHeight * scale)
      viewport.scrollLeft = Math.max(0, (contentWidth - viewport.clientWidth) / 2)
      viewport.scrollTop = Math.max(0, (contentHeight - viewport.clientHeight) / 2)
    },
    [baseCanvasHeight, baseCanvasWidth],
  )

  const handleResetView = useCallback(() => {
    setZoomScale(1)
    zoomScaleRef.current = 1
    requestAnimationFrame(() => {
      centerViewport(1)
    })
  }, [centerViewport])

  const applyZoomAt = useCallback((targetScale: number, anchorX: number, anchorY: number) => {
    const viewport = mapViewportRef.current
    if (!viewport) {
      return
    }
    const oldScale = zoomScaleRef.current
    const newScale = clampZoom(targetScale)
    if (Math.abs(newScale - oldScale) < 0.0001) {
      return
    }
    const nextScroll = scrollForZoomAnchor({
      oldScale,
      newScale,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      anchorX,
      anchorY,
    })
    setZoomScale(newScale)
    zoomScaleRef.current = newScale
    requestAnimationFrame(() => {
      const nextViewport = mapViewportRef.current
      if (!nextViewport) {
        return
      }
      nextViewport.scrollLeft = Math.max(0, nextScroll.scrollLeft)
      nextViewport.scrollTop = Math.max(0, nextScroll.scrollTop)
    })
  }, [])

  const handleZoomIn = useCallback(() => {
    const viewport = mapViewportRef.current
    if (!viewport || !tilemap) {
      return
    }
    applyZoomAt(zoomIn(zoomScaleRef.current), viewport.clientWidth / 2, viewport.clientHeight / 2)
  }, [applyZoomAt, tilemap])

  const handleZoomOut = useCallback(() => {
    const viewport = mapViewportRef.current
    if (!viewport || !tilemap) {
      return
    }
    applyZoomAt(zoomOut(zoomScaleRef.current), viewport.clientWidth / 2, viewport.clientHeight / 2)
  }, [applyZoomAt, tilemap])

  const handleViewportWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!tilemap) {
        return
      }
      const viewport = mapViewportRef.current
      if (!viewport) {
        return
      }
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const anchorX = event.clientX - rect.left
      const anchorY = event.clientY - rect.top
      if (event.deltaY < 0) {
        applyZoomAt(zoomIn(zoomScaleRef.current), anchorX, anchorY)
      } else {
        applyZoomAt(zoomOut(zoomScaleRef.current), anchorX, anchorY)
      }
    },
    [applyZoomAt, tilemap],
  )

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }
    dragRef.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  const handleViewportPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!tilemap || event.button !== 0) {
        return
      }
      const viewport = mapViewportRef.current
      if (!viewport) {
        return
      }
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: viewport.scrollLeft,
        startScrollTop: viewport.scrollTop,
      }
      setIsDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [tilemap],
  )

  const handleViewportPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const viewport = mapViewportRef.current
    if (!drag || !viewport || drag.pointerId !== event.pointerId) {
      return
    }
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    viewport.scrollLeft = drag.startScrollLeft - dx
    viewport.scrollTop = drag.startScrollTop - dy
  }, [])

  const handleGenerate = useCallback(() => {
    const seed = normalizeSeed(uiState.seedInput)
    const params = toDungeonParams(uiState)
    const rng = createRng(seed)
    const generated = generateDungeon(params, rng)
    const layouted = layoutDungeon(generated, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      padding: 64,
      iterations: 220,
      seed: seed ^ 0x9e3779b9,
    })
    const graphValidation = validateDungeon(layouted, params)
    const built = buildTilemapFromDungeon(layouted, {
      width: TILEMAP_WIDTH,
      height: TILEMAP_HEIGHT,
      tileSize: TILE_SIZE,
      rngSeed: seed ^ 0xa53f9d21,
    })
    const tileValidation = validateTilemap(built)

    setDungeon(layouted)
    setTilemap(built)
    setIssueMessages([
      ...graphValidation.issues.map((issue) => `[Graph] ${issue.message}`),
      ...tileValidation.issues.map((issue) => `[Tilemap] ${issue.message}`),
    ])
    setStatsLines([
      `Rooms: ${tileValidation.stats.roomCount}`,
      `Doors: ${tileValidation.stats.doorCount}`,
      `Corridor tiles: ${tileValidation.stats.corridorTiles}`,
      `Floor tiles: ${tileValidation.stats.floorTiles}`,
      `Connectivity: ${tileValidation.stats.connected ? 'Connected' : 'Disconnected'}`,
      `Start -> Boss distance: ${tileValidation.stats.startBossDistance}`,
    ])
    setStatusMessage(
      graphValidation.valid && tileValidation.valid
        ? 'Tilemap dungeon generated.'
        : 'Generated with validation issues. See summary.',
    )
    handleResetView()
  }, [handleResetView, uiState])

  useEffect(() => {
    if (!tilemap) {
      return
    }
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    renderTilemapToCanvas(context, tilemap, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      background: 'transparent',
      margin: 24,
      sprites: tileSprites,
    })
  }, [tilemap, tileSprites])

  const handleRandomSeed = useCallback(() => {
    const nextSeed = Math.floor(Math.random() * 1_000_000_000).toString()
    setUiState((current) => ({ ...current, seedInput: nextSeed }))
  }, [])

  const handleDownloadPng = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || !dungeon) {
      return
    }
    const blob = await exportCanvasToPng(canvas, {
      scale: uiState.exportScale,
      background: uiState.exportBackground,
      margin: 24,
    })
    const fileName = `dungeon_seed${dungeon.meta.seed}_rooms${dungeon.meta.params.roomCount}.png`
    downloadPng(blob, fileName)
    setStatusMessage('PNG exported.')
  }, [dungeon, uiState.exportBackground, uiState.exportScale])
  const roomSummary = useMemo(() => {
    if (!dungeon || !tilemap) {
      return 'No dungeon rendered yet.'
    }
    return `Seed ${dungeon.meta.seed} | Grid ${tilemap.width}x${tilemap.height} | Rooms ${tilemap.rooms.length}`
  }, [dungeon, tilemap])

  return (
    <main className={styles.page}>
      <section className={styles.leftPane}>
        <header className={styles.header}>
          <h1>Dungeon Composer</h1>
          <p>Seeded top-down dungeon tilemap generator with deterministic output.</p>
        </header>
        <ParamForm values={uiState} onChange={updateField} />
        <ActionButtons
          values={uiState}
          onChange={updateField}
          onGenerate={handleGenerate}
          onRandomSeed={handleRandomSeed}
          onDownload={handleDownloadPng}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          disableDownload={!tilemap}
          disableZoom={!tilemap}
        />
        <SummaryPanel
          seed={dungeon?.meta.seed}
          summary={roomSummary}
          stats={statsLines}
          issues={issueMessages}
          statusMessage={statusMessage}
        />
      </section>

      <section className={styles.rightPane}>
        <div
          ref={mapViewportRef}
          className={`${styles.mapViewport} ${tilemap ? styles.grabCursor : ''} ${isDragging ? styles.grabbingCursor : ''}`}
          onWheel={handleViewportWheel}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-label="Top-down dungeon tilemap preview"
        >
          <div
            className={styles.mapContent}
            style={{
              width: `${displayCanvasWidth}px`,
              height: `${displayCanvasHeight}px`,
            }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className={styles.canvas}
            />
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
