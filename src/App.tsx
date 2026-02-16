import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './app/App.module.css'
import { DEFAULT_UI_STATE } from './app/constants'
import { loadIconAssets } from './app/icons'
import { ActionButtons } from './app/controls/ActionButtons'
import { ParamForm } from './app/controls/ParamForm'
import { SummaryPanel } from './app/controls/SummaryPanel'
import type { UiState } from './app/types'
import { generateDungeon } from './core/generate'
import { layoutDungeon } from './core/layout'
import type { Dungeon, DungeonParams, ValidationResult } from './core/model'
import { createRng, normalizeSeed } from './core/rng'
import { sanitizeDungeonParams, validateDungeon } from './core/validate'
import { downloadPng, exportCanvasToPng } from './render/exportPng'
import { renderDungeonToCanvas } from './render/renderCanvas'

const CANVAS_WIDTH = 1200
const CANVAS_HEIGHT = 800

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
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [icons, setIcons] = useState<Record<'start' | 'boss', HTMLImageElement | null>>({
    start: null,
    boss: null,
  })

  useEffect(() => {
    loadIconAssets()
      .then(setIcons)
      .catch(() => {
        setStatusMessage('Icon preload failed. Fallback shapes will be used.')
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
    const result = validateDungeon(layouted, params)

    setDungeon(layouted)
    setValidation(result)
    setStatusMessage(result.valid ? 'Dungeon generated.' : 'Dungeon generated with validation issues.')
  }, [uiState])

  useEffect(() => {
    if (!dungeon) {
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
    renderDungeonToCanvas(context, dungeon, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      background: 'transparent',
      margin: 24,
      showLabels: true,
      icons,
    })
  }, [dungeon, icons])

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

  const stats = validation?.stats
  const issues = validation?.issues ?? []
  const roomSummary = useMemo(() => {
    if (!dungeon) {
      return 'No dungeon rendered yet.'
    }
    return `Seed ${dungeon.meta.seed} | Rooms ${dungeon.nodes.length} | Edges ${dungeon.edges.length}`
  }, [dungeon])

  return (
    <main className={styles.page}>
      <section className={styles.leftPane}>
        <header className={styles.header}>
          <h1>Dungeon Composer</h1>
          <p>Seeded dungeon graph generator with deterministic output.</p>
        </header>
        <ParamForm values={uiState} onChange={updateField} />
        <ActionButtons
          values={uiState}
          onChange={updateField}
          onGenerate={handleGenerate}
          onRandomSeed={handleRandomSeed}
          onDownload={handleDownloadPng}
          disableDownload={!dungeon}
        />
        <SummaryPanel
          seed={dungeon?.meta.seed}
          summary={roomSummary}
          stats={stats}
          issues={issues}
          statusMessage={statusMessage}
        />
      </section>

      <section className={styles.rightPane}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={styles.canvas}
          aria-label="Dungeon graph preview"
        />
      </section>
    </main>
  )
}

export default App
