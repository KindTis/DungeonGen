import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './app/App.module.css'
import { DEFAULT_UI_STATE } from './app/constants'
import { ActionButtons } from './app/controls/ActionButtons'
import { ParamForm } from './app/controls/ParamForm'
import { SummaryPanel } from './app/controls/SummaryPanel'
import { loadTileSprites, type TileSprites } from './app/tileset'
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
  const [tileSprites, setTileSprites] = useState<TileSprites | null>(null)

  useEffect(() => {
    loadTileSprites()
      .then(setTileSprites)
      .catch(() => {
        setStatusMessage('Tile sprites failed to preload. Fallback rendering enabled.')
      })
  }, [])

  const updateField = useCallback(
    <K extends keyof UiState>(field: K, value: UiState[K]) => {
      setUiState((current) => ({ ...current, [field]: value }))
    },
    [],
  )

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
  }, [uiState])

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
          disableDownload={!tilemap}
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
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={styles.canvas}
          aria-label="Top-down dungeon tilemap preview"
        />
      </section>
    </main>
  )
}

export default App
