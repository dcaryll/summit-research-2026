import { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react'
import gearSource from '@rhds/icons/standard/gear.js'
import assessmentSource from '@rhds/icons/ui/assessment.js'
import developerSource from '@rhds/icons/standard/developer.js'
import controlPanelSource from '@rhds/icons/standard/control-panel.js'
import productTrialSource from '@rhds/icons/standard/product-trial.js'
import megaphoneSource from '@rhds/icons/standard/megaphone.js'
import magnifyingGlassSource from '@rhds/icons/standard/magnifying-glass.js'
import './FocusSelector.css'
import logoImage from '../images/Logo-Red_Hat-A-White-RGB.svg'

/**
 * Official RHDS SVG assets (same as https://ux.redhat.com/foundations/iconography/).
 * We import modules statically — `rh-icon` uses dynamic imports that Vite does not resolve reliably.
 */
const RHDS_STUDY_ICON_SOURCES: Record<string, Node> = {
  'user-preferences': gearSource,
  'product-evaluation': assessmentSource,
  'developer-program': developerSource,
  'my-red-hat': controlPanelSource,
  'my-trials': productTrialSource,
  'product-marketing': megaphoneSource,
  'content-discovery': magnifyingGlassSource
}

function cloneRhdsStudySvg(source: Node): SVGSVGElement {
  const copy = source.cloneNode(true)
  if (copy instanceof DocumentFragment) {
    const inner = copy.firstElementChild
    if (inner instanceof SVGSVGElement) {
      return inner.cloneNode(true) as SVGSVGElement
    }
  }
  if (copy instanceof SVGSVGElement) {
    return copy.cloneNode(true) as SVGSVGElement
  }
  throw new Error('Unexpected @rhds/icons module shape')
}

function StudyTrackIcon({ focusId }: { focusId: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const host = ref.current
    const src = RHDS_STUDY_ICON_SOURCES[focusId]
    if (!host || !src) return
    const svg = cloneRhdsStudySvg(src)
    svg.setAttribute('aria-hidden', 'true')
    host.replaceChildren(svg)
  }, [focusId])
  return <span ref={ref} className="focus-card-rh-icon" />
}

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
}

const focusOptions: FocusOption[] = [
  {
    id: 'user-preferences',
    title: 'User preferences',
    description: 'Help us improve how Red Hat manages your information for a more personal experience across our sites.'
  },
  {
    id: 'product-evaluation',
    title: 'Product evaluation',
    description: 'Help us make it easier for you to try out and evaluate our products.'
  },
  {
    id: 'developer-program',
    title: 'Developer program',
    description: 'Tell us how you use Red Hat developer resources and what would make them more valuable.'
  },
  {
    id: 'my-red-hat',
    title: 'My Red Hat',
    description: 'Share how you use the portal, dashboard, and customer experience.'
  },
  {
    id: 'my-trials',
    title: 'Trying & buying new products',
    description: 'Tell us how you and your team prefer to purchase after using a product trial.'
  },
  {
    id: 'product-marketing',
    title: 'Product marketing',
    description: 'Tell us how you find product information and what supports your buying decisions.'
  },
  {
    id: 'content-discovery',
    title: 'Content discovery',
    description: 'Help us improve how you find docs, learning, and technical content.'
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
                <span className="focus-card-icon-wrap">
                  <StudyTrackIcon focusId={option.id} />
                </span>
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
