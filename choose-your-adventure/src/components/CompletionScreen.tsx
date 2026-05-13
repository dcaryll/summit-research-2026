import { useEffect, useState } from 'react'
import './CompletionScreen.css'
import { studyLogo } from '../studyBrand'
import qrCodeImage from '../images/qr-code.svg'
import {
  aggregateStudyCompletions,
  formatDurationMs,
  getAllResponses,
  type StudyAggregateRow
} from '../studyPersistence'

interface CompletionScreenProps {
  onBack: () => void
  onExportCsv?: () => void | Promise<void>
  /** When true, show session counts and average duration per study (this browser’s stored completions). */
  moderatorMode?: boolean
}

function CompletionScreen({ onBack, onExportCsv, moderatorMode = false }: CompletionScreenProps) {
  const [aggregateRows, setAggregateRows] = useState<StudyAggregateRow[]>([])
  const [aggregateLoadState, setAggregateLoadState] = useState<'idle' | 'loading' | 'done'>(() =>
    moderatorMode ? 'loading' : 'idle'
  )
  const [statsError, setStatsError] = useState<string | null>(null)

  useEffect(() => {
    if (!moderatorMode) {
      setAggregateLoadState('idle')
      return
    }
    let cancelled = false
    setAggregateLoadState('loading')
    ;(async () => {
      try {
        const all = await getAllResponses()
        if (cancelled) return
        setAggregateRows(aggregateStudyCompletions(all))
        setStatsError(null)
      } catch {
        if (!cancelled) {
          setAggregateRows([])
          setStatsError('Could not load completion stats.')
        }
      } finally {
        if (!cancelled) setAggregateLoadState('done')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [moderatorMode])

  return (
    <div className="completion-screen">
      <div className="completion-header">
        <img src={studyLogo} alt="" className="completion-logo" />
        <button className="back-button" onClick={onBack}>
          Start over
        </button>
      </div>

      <div className="completion-content">
        <div className="completion-headline-section">
          <h1 className="completion-headline">Thank you!</h1>
          <p className="completion-subheadline">
            Your feedback helps us build better products and experiences.
          </p>
          {onExportCsv && (
            <button type="button" className="completion-export-csv" onClick={() => void onExportCsv()}>
              Download all responses (CSV)
            </button>
          )}
        </div>

        {moderatorMode && (
          <section className="completion-moderator-stats" aria-labelledby="completion-moderator-stats-heading">
            <h2 id="completion-moderator-stats-heading" className="completion-moderator-stats-heading">
              Studies completed (this station)
            </h2>
            <p className="completion-moderator-stats-note">
              Counts and averages are from responses saved in this browser. New completions include
              duration; older rows show &ldquo;—&rdquo; until more timed sessions are recorded.
            </p>
            {aggregateLoadState === 'loading' ? (
              <p className="completion-moderator-stats-loading">Loading stats…</p>
            ) : statsError ? (
              <p className="completion-moderator-stats-error" role="alert">
                {statsError}
              </p>
            ) : aggregateRows.length === 0 ? (
              <p className="completion-moderator-stats-empty">No completed studies stored yet.</p>
            ) : (
              <div className="completion-moderator-stats-table-wrap">
                <table className="completion-moderator-stats-table">
                  <thead>
                    <tr>
                      <th scope="col">Study</th>
                      <th scope="col">Id</th>
                      <th scope="col">Completions</th>
                      <th scope="col">Avg. time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregateRows.map((row) => (
                      <tr key={row.focusId}>
                        <td>{row.label}</td>
                        <td>
                          <code className="completion-moderator-stats-focus-id">{row.focusId}</code>
                        </td>
                        <td>{row.completions}</td>
                        <td>
                          {row.avgDurationMs != null ? formatDurationMs(row.avgDurationMs) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <div className="completion-steps">
          <div className="step-box">
            <h3 className="step-title">SWAG</h3>
            <p className="step-text">Don't forget to retrieve your swag from the front desk!</p>
          </div>
          <div className="step-box">
            <h3 className="step-title">Join our research community</h3>
            <div className="qr-code-container">
              <img src={qrCodeImage} alt="QR Code" className="qr-code-image" />
            </div>
          </div>
          <div className="step-box">
            <h3 className="step-title">Keep going</h3>
            <p className="step-text">Take another usability study</p>
            <button className="step-button" onClick={onBack}>
              Start over
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompletionScreen
