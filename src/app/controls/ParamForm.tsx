import { STYLE_PRESETS } from '../presets'
import type { UiState } from '../types'
import styles from './Controls.module.css'

interface ParamFormProps {
  values: UiState
  onChange: <K extends keyof UiState>(field: K, value: UiState[K]) => void
}

export function ParamForm({ values, onChange }: ParamFormProps) {
  return (
    <section className={styles.group}>
      <h2 className={styles.groupTitle}>Parameters</h2>

      <div className={styles.field}>
        <label htmlFor="seed-input">Seed</label>
        <input
          id="seed-input"
          className={styles.input}
          type="text"
          value={values.seedInput}
          onChange={(event) => onChange('seedInput', event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="style-select">Preset style</label>
        <select
          id="style-select"
          className={styles.select}
          value={values.style}
          onChange={(event) => {
            const style = event.target.value as UiState['style']
            const preset = STYLE_PRESETS[style]
            onChange('style', style)
            onChange('roomCount', preset.roomCount)
            onChange('branching', preset.branching)
            onChange('loopChance', preset.loopChance)
          }}
        >
          <option value="linear">Linear</option>
          <option value="branchy">Branchy</option>
          <option value="loopy">Loopy</option>
        </select>
      </div>

      <div className={styles.inline}>
        <div className={styles.field}>
          <label htmlFor="room-count">Rooms (10-80)</label>
          <input
            id="room-count"
            className={styles.input}
            type="number"
            min={10}
            max={80}
            value={values.roomCount}
            onChange={(event) => onChange('roomCount', Number(event.target.value))}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="branching">Branching (0.5-3.0)</label>
          <input
            id="branching"
            className={styles.input}
            type="number"
            min={0.5}
            max={3}
            step={0.1}
            value={values.branching}
            onChange={(event) => onChange('branching', Number(event.target.value))}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="loop-chance">Loop chance (0-1)</label>
        <input
          id="loop-chance"
          className={styles.input}
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={values.loopChance}
          onChange={(event) => onChange('loopChance', Number(event.target.value))}
        />
      </div>
    </section>
  )
}

