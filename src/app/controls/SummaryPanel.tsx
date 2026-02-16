import styles from './Controls.module.css'

interface SummaryPanelProps {
  seed?: number
  summary: string
  stats: string[]
  issues: string[]
  statusMessage: string
}

export function SummaryPanel({ seed, summary, stats, issues, statusMessage }: SummaryPanelProps) {
  return (
    <section className={styles.group} aria-live="polite">
      <h2 className={styles.groupTitle}>Summary</h2>
      <p className={styles.summaryText}>{summary}</p>
      {typeof seed === 'number' && <p className={styles.summaryText}>Normalized seed: {seed}</p>}
      {stats.map((line) => (
        <p key={line} className={styles.summaryText}>
          {line}
        </p>
      ))}
      {issues.length > 0 && (
        <ul className={styles.issueList}>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      {statusMessage && <p className={styles.status}>{statusMessage}</p>}
    </section>
  )
}
