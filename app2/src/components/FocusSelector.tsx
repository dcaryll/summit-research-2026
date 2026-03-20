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
}

interface FocusOption {
  id: string
  title: string
  description: string
  icon: ReactNode
}

const focusOptions: FocusOption[] = [
  {
    id: 'renew-subscription',
    title: 'Renewing a subscription',
    description: 'Help us improve the subscription renewal experience',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    )
  },
  {
    id: 'trying-products',
    title: 'Trying new Products',
    description: 'Share your experience exploring new Red Hat products',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      </svg>
    )
  },
  {
    id: 'dashboard',
    title: 'My Red Hat Dashboard',
    description: 'Tell us about your dashboard usage and preferences',
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
    id: 'guided-learning-genai',
    title: 'GenAI guided learning',
    description: 'Share your experience with the Guided Learning GenAI feature',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M8 7h8" />
        <path d="M8 11h6" />
      </svg>
    )
  },
  {
    id: 'user-preferences',
    title: 'User preferences',
    description: 'Tell us how you like to work and what we can improve',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    )
  },
  {
    id: 'buying-products',
    title: 'Buying products',
    description: 'Share your experience purchasing Red Hat products',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    )
  },
  {
    id: 'accessibility-usability',
    title: 'Accessibility and usability',
    description: 'Help us make Red Hat products more accessible and easier to use',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="9" r="2" />
        <path d="M12 11v6M9 17l3-3 3 3" />
      </svg>
    )
  },
  {
    id: 'developer-for-business',
    title: 'Developer for business',
    description: 'Share how you use Red Hat developer tools in your business context',
    icon: (
      <svg className="focus-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
        <path d="M12 2v20" />
      </svg>
    )
  }
]

const RANDOM_RESULT_DURATION_MS = 2500

// Role options: user picks a role and we auto-assign the mapped study
const roleOptions: { id: string; label: string; focusId: string }[] = [
  { id: 'developer', label: 'Developer', focusId: 'developer-for-business' },
  { id: 'it-ops', label: 'IT Ops / SRE', focusId: 'dashboard' },
  { id: 'security', label: 'Security professional', focusId: 'user-preferences' },
  { id: 'buyer', label: 'Buyer / Procurement', focusId: 'buying-products' },
  { id: 'learning', label: 'L&D professional', focusId: 'guided-learning-genai' },
  { id: 'subscriptions', label: 'Subscription manager', focusId: 'renew-subscription' },
  { id: 'evaluator', label: 'Technical evaluator', focusId: 'trying-products' },
  { id: 'accessibility', label: 'Accessibility specialist', focusId: 'accessibility-usability' }
]

function FocusSelector({ onFocusSelect, selectedFocus, onTakeStudy, onStartQualifying }: FocusSelectorProps) {
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
    </div>
  )
}

export default FocusSelector
