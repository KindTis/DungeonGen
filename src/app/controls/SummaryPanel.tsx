import type { DungeonStats, ValidationIssue } from '../../core/model'
import styles from './Controls.module.css'

interface SummaryPanelProps {
  seed?: number
  summary: string
  stats?: DungeonStats
  issues: ValidationIssue[]
  statusMessage: string
}

export function SummaryPanel({ seed, summary, stats, issues, statusMessage }: SummaryPanelProps) {
  return (
    <section className={styles.group} aria-live="polite">
      <h2 className={styles.groupTitle}>Summary</h2>
      <p className={styles.summaryText}>{summary}</p>
      {typeof seed === 'number' && <p className={styles.summaryText}>Normalized seed: {seed}</p>}
      {stats && (
        <>
          <p className={styles.summaryText}>Connectivity: {stats.connected ? 'Connected' : 'Disconnected'}</p>
          <p className={styles.summaryText}>Start to boss distance: {stats.startBossDistance}</p>
          <p className={styles.summaryText}>Branch nodes: {stats.branchCount}</p>
        </>
      )}
      {issues.length > 0 && (
        <ul className={styles.issueList}>
          {issues.map((issue) => (
            <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      )}
      {statusMessage && <p className={styles.status}>{statusMessage}</p>}
    </section>
  )
}

