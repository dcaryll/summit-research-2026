import { useMemo, useState, useEffect, ReactNode } from 'react'
import './FocusSelector.css'
import logoImage from '../images/Logo-Red_Hat-A-White-RGB.svg'

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

interface FocusSelectorProps {
  onFocusSelect: (focus: string) => void
  selectedFocus: string | null
  onTakeStudy: () => void
  onStartQualifying: () => void
  onExportCsv?: () => void | Promise<void>
}

interface FocusOption {
  id: string
  title: string
  description: string
  icon: ReactNode
}

const focusOptions: FocusOption[] = [
  {
    id: 'user-preferences',
    title: 'User preferences',
    description: 'Help us improve how Red Hat manages your information for a more personal experience across our sites.',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    )
  },
  {
    id: 'product-evaluation',
    title: 'Product evaluation',
    description: 'Help us make it easier for you to try out and evaluate our products.',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    )
  },
  {
    id: 'developer-program',
    title: 'Developer program',
    description: 'Tell us how you use Red Hat developer resources and what would make them more valuable.',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
        <path d="M12 2v20" />
      </svg>
    )
  },
  {
    id: 'my-red-hat',
    title: 'My Red Hat',
    description: 'Share how you use the portal, dashboard, and customer experience.',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    )
  },
  {
    id: 'my-trials',
    title: 'My trials',
    description: 'Help us improve how you discover, start, and use product trials.',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 3h6v5a5 5 0 0 0 2.5 4.33L19 18H5l2.5-5.67A5 5 0 0 0 10 8V3z" />
        <line x1="9" y1="3" x2="15" y2="3" />
      </svg>
    )
  },
  {
    id: 'product-marketing',
    title: 'Product marketing',
    description: 'Tell us how you find product information and what supports your buying decisions.',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 11v2a2 2 0 0 0 2 2h1l4 3v-8l-4 3H5a2 2 0 0 1-2-2z" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M17.66 6.34a8 8 0 0 1 0 11.32" />
      </svg>
    )
  },
  {
    id: 'content-discovery',
    title: 'Content discovery',
    description: 'Help us improve how you find docs, learning, and technical content.',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    )
  }
]

const RANDOM_RESULT_DURATION_MS = 2500

// Role options: user picks a role and we auto-assign the mapped study
const roleOptions: { id: string; label: string; focusId: string }[] = [
  { id: 'developer', label: 'Developer', focusId: 'developer-program' },
  { id: 'it-ops', label: 'IT Ops / SRE', focusId: 'my-red-hat' },
  { id: 'security', label: 'Security professional', focusId: 'user-preferences' },
  { id: 'buyer', label: 'Buyer / Procurement', focusId: 'product-marketing' },
  { id: 'content', label: 'Learning & content', focusId: 'content-discovery' },
  { id: 'evaluator', label: 'Technical evaluator', focusId: 'product-evaluation' },
  { id: 'trials', label: 'Trials & subscriptions', focusId: 'my-trials' }
]

function FocusSelector({ onFocusSelect, selectedFocus, onTakeStudy, onStartQualifying, onExportCsv }: FocusSelectorProps) {
  const orderedOptions = useMemo(() => shuffleArray(focusOptions), [])
  const [isShowingRandomResult, setIsShowingRandomResult] = useState(false)
  const [randomChosenFocus, setRandomChosenFocus] = useState<string | null>(null)
  const [showRoleSection, setShowRoleSection] = useState(false)

  useEffect(() => {
    if (!isShowingRandomResult) return
    const t = setTimeout(() => {
      setIsShowingRandomResult(false)
      setRandomChosenFocus(null)
      onTakeStudy()
    }, RANDOM_RESULT_DURATION_MS)
    return () => clearTimeout(t)
  }, [isShowingRandomResult, onTakeStudy])

  const handleRandomize = () => {
    const randomIndex = Math.floor(Math.random() * orderedOptions.length)
    const focusId = orderedOptions[randomIndex].id
    setRandomChosenFocus(focusId)
    onFocusSelect(focusId)
    setIsShowingRandomResult(true)
  }

  const handleChooseByRole = (focusId: string) => {
    onFocusSelect(focusId)
    setTimeout(() => {
      onTakeStudy()
    }, 100)
  }

  return (
    <div className="focus-selector-screen">
      <div className="logo-container">
        <img src={logoImage} alt="Red Hat Logo" className="logo-image" />
      </div>

      <div className="selector-content">
        <div className="selector-header-row">
          <div className="selector-headline-block">
            <h1 className="selector-title">Select your focus</h1>
            <p className="selector-subtitle">Choose a study track that interests you</p>
          </div>
          <div className="randomize-section">
            <h2 className="randomize-title">Not sure which to choose?</h2>
            <div className="randomize-buttons">
              <button
                className="randomize-button"
                onClick={handleRandomize}
              >
                <span className="randomize-button-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                    <circle cx="16" cy="16" r="1.5" fill="currentColor" />
                    <circle cx="8" cy="16" r="1.5" fill="currentColor" />
                    <circle cx="16" cy="8" r="1.5" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                  </svg>
                </span>
                Random study
              </button>
              <button
                className="randomize-button qualifying-button"
                onClick={onStartQualifying}
              >
                Help me choose
              </button>
              <button
                className="randomize-button"
                onClick={() => setShowRoleSection(true)}
              >
                Choose by role
              </button>
            </div>
          </div>
        </div>

        {showRoleSection && (
        <div className="choose-by-role-section">
          <h2 className="choose-by-role-title">Choose by role</h2>
          <p className="choose-by-role-subtitle">Pick your role and we’ll assign a matching study</p>
          <div className="role-buttons">
            {roleOptions.map((role) => (
              <button
                key={role.id}
                type="button"
                className="role-button"
                onClick={() => handleChooseByRole(role.focusId)}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>
        )}

        <div className={`focus-cards-grid ${isShowingRandomResult ? 'focus-cards-grid--animating' : ''}`}>
          {orderedOptions.map((option) => {
            const isChosen = isShowingRandomResult && option.id === randomChosenFocus
            const isDismissed = isShowingRandomResult && option.id !== randomChosenFocus
            const isSelected = selectedFocus === option.id
            return (
              <div
                key={option.id}
                role="button"
                tabIndex={0}
                className={`focus-card ${isSelected ? 'selected' : ''} ${isChosen ? 'focus-card--random-selected' : ''} ${isDismissed ? 'focus-card--random-dismiss' : ''}`}
                onClick={() => !isShowingRandomResult && onFocusSelect(option.id)}
                onKeyDown={(e) => {
                  if (!isShowingRandomResult && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onFocusSelect(option.id)
                  }
                }}
              >
                <span className="focus-card-icon-wrap">{option.icon}</span>
                <h2 className="focus-card-title">{option.title}</h2>
                <p className="focus-card-description">{option.description}</p>
                {isSelected && !isShowingRandomResult && (
                  <button
                    type="button"
                    className="take-study-button take-study-button--on-card"
                    onClick={(e) => {
                      e.stopPropagation()
                      onTakeStudy()
                    }}
                  >
                    Take the study
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
      {onExportCsv && (
        <div className="focus-selector-facilitator">
          <button type="button" className="focus-export-csv" onClick={() => void onExportCsv()}>
            Download all responses (CSV)
          </button>
        </div>
      )}
    </div>
  )
}

export default FocusSelector
