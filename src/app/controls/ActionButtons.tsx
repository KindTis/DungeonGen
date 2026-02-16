import type { UiState } from '../types'
import styles from './Controls.module.css'

interface ActionButtonsProps {
  values: UiState
  onChange: <K extends keyof UiState>(field: K, value: UiState[K]) => void
  onGenerate: () => void
  onRandomSeed: () => void
  onDownload: () => void
  disableDownload: boolean
}

export function ActionButtons({
  values,
  onChange,
  onGenerate,
  onRandomSeed,
  onDownload,
  disableDownload,
}: ActionButtonsProps) {
  return (
    <section className={styles.group}>
      <h2 className={styles.groupTitle}>Actions</h2>

      <div className={styles.buttonRow}>
        <button type="button" className={styles.button} onClick={onGenerate}>
          Generate
        </button>
        <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={onRandomSeed}>
          Random Seed
        </button>
      </div>

      <div className={styles.inline} style={{ marginTop: '10px' }}>
        <div className={styles.field}>
          <label htmlFor="scale-select">PNG scale</label>
          <select
            id="scale-select"
            className={styles.select}
            value={values.exportScale}
            onChange={(event) => onChange('exportScale', Number(event.target.value) as UiState['exportScale'])}
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="background-select">PNG background</label>
          <select
            id="background-select"
            className={styles.select}
            value={values.exportBackground}
            onChange={(event) =>
              onChange('exportBackground', event.target.value as UiState['exportBackground'])
            }
          >
            <option value="white">White</option>
            <option value="transparent">Transparent</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        className={styles.button}
        style={{ width: '100%', marginTop: '10px' }}
        onClick={onDownload}
        disabled={disableDownload}
      >
        Download PNG
      </button>
    </section>
  )
}

