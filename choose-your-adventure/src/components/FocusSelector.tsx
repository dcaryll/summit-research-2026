import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import gearSource from '@rhds/icons/standard/gear.js'
import assessmentSource from '@rhds/icons/ui/assessment.js'
import developerSource from '@rhds/icons/standard/developer.js'
import controlPanelSource from '@rhds/icons/standard/control-panel.js'
import productTrialSource from '@rhds/icons/standard/product-trial.js'
import megaphoneSource from '@rhds/icons/standard/megaphone.js'
import magnifyingGlassSource from '@rhds/icons/standard/magnifying-glass.js'
import './FocusSelector.css'
import logoImage from '../images/Logo-Red_Hat-A-White-RGB.svg'
import studyDetailVisualPlaceholder from '../images/study-detail-visual-placeholder.svg'
import myRedHatStudyDetailHero from '../images/my-red-hat-study-detail-hero.png'

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
  /** Called when the study detail modal is dismissed without starting the study. */
  onClearFocusSelection?: () => void
  selectedFocus: string | null
  onTakeStudy: () => void
  onStartQualifying: () => void
  onExportCsv?: () => void | Promise<void>
}

interface FocusOption {
  id: string
  title: string
  description: string
  /** Richer copy for the detail modal (right column). */
  detailDescription: string
  /** Optional hero image; defaults to a shared placeholder SVG. */
  detailVisualSrc?: string
  /** Short alt for the hero image (decorative placeholder uses empty alt). */
  detailVisualAlt?: string
}

const focusOptions: FocusOption[] = [
  {
    id: 'user-preferences',
    title: 'Personalize your Red Hat',
    description: 'Tell us how your profile and settings should work across all our sites. (5 mins)',
    detailDescription:
      'This study explores where you expect to manage account-related preferences across Red Hat experiences, what should carry across sites, and how you feel about sharing settings. You will work through short scenarios and questions at your own pace—typically about 10–20 minutes. Your feedback helps us design clearer, more consistent preference experiences.'
  },
  {
    id: 'product-evaluation',
    title: 'Build your dream trial',
    description: 'Play the evaluation budget game and show us how you prefer to test software. (5 mins)',
    detailDescription:
      'We want to understand how you evaluate software in real life—what builds trust, how you weigh trials versus installs, and what you need before recommending a product. The session includes a few interactive moments and follow-up questions. Plan for roughly 10–20 minutes; there are no wrong answers.'
  },
  {
    id: 'developer-program',
    title: 'Shape the Developer program',
    description: 'Help us tailor our technical resources and tools to your daily workflow. (5 mins)',
    detailDescription:
      'Share which developer tools and programs you use today, how they fit into your workflow, and what would make Red Hat’s developer offerings more useful. Expect multiple-choice and open-ended questions. Most participants finish in about 10–15 minutes.'
  },
  {
    id: 'my-red-hat',
    title: 'Refine your intelligent dashboard',
    description: 'Explore AI-built views and portable tools to build the ultimate My Red Hat. (5 mins)',
    detailDescription:
      'This track focuses on the My Red Hat portal and related experiences—navigation, dashboards, and tasks you perform as a customer. You may see lightweight interactive previews and follow-up questions. Set aside about 15–20 minutes to complete the study comfortably.',
    detailVisualSrc: myRedHatStudyDetailHero,
    detailVisualAlt:
      'Screenshot of the My dashboard page in the Red Hat customer portal, showing trials, subscriptions, support cases, and related widgets.'
  },
  {
    id: 'my-trials',
    title: 'From testing to buying',
    description: 'Tell us your biggest roadblocks when upgrading from a product trial. (5 mins)',
    detailDescription:
      'We are learning how people move from trial to purchase—including what you expect from “buy” flows, what feels unclear, and how we can make post-trial paths easier. You will answer questions about trials, buying options, and proposed improvements. Allow roughly 15–25 minutes.'
  },
  {
    id: 'product-marketing',
    title: 'Improve our product navigation',
    description: 'Sort and rank menu terms so finding products doesn\'t feel like a guessing game. (5 mins)',
    detailDescription:
      'Help us understand how you scan product menus and information architecture when researching or buying. This study includes sorting, ranking, and preference tasks grounded in realistic examples. Expect about 15–25 minutes depending on how much you explore.'
  },
  {
    id: 'content-discovery',
    title: 'How do you learn best?',
    description: 'Videos, blogs, or podcasts? Tell us what content helps you master new tech. (5 mins)',
    detailDescription:
      'We want to learn how you prefer to discover learning content by topic—what you notice first, how you rank formats, and what would help you go deeper. You will pick a topic, make a few choices, and rank options. Most people finish in about 15–20 minutes.'
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

function FocusSelector({
  onFocusSelect,
  onClearFocusSelection,
  selectedFocus,
  onTakeStudy,
  onStartQualifying,
  onExportCsv
}: FocusSelectorProps) {
  const orderedOptions = useMemo(() => shuffleArray(focusOptions), [])
  const [isShowingRandomResult, setIsShowingRandomResult] = useState(false)
  const [randomChosenFocus, setRandomChosenFocus] = useState<string | null>(null)
  const [showRoleSection, setShowRoleSection] = useState(false)
  const [openDetailId, setOpenDetailId] = useState<string | null>(null)

  const detailOption = openDetailId ? focusOptions.find((o) => o.id === openDetailId) : undefined

  const closeStudyDetail = useCallback(() => {
    setOpenDetailId(null)
    onClearFocusSelection?.()
  }, [onClearFocusSelection])

  useEffect(() => {
    if (!openDetailId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeStudyDetail()
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [openDetailId, closeStudyDetail])

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
      <header className="focus-selector-top-bar">
        <div className="logo-container">
          <img src={logoImage} alt="Red Hat Logo" className="logo-image" />
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
      </header>

      <div className="selector-content">
        <div className="selector-headline-block">
          <h1 className="selector-title">Select your focus</h1>
          <p className="selector-subtitle">Choose a study track that interests you</p>
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
                onClick={() => {
                  if (isShowingRandomResult) return
                  onFocusSelect(option.id)
                  setOpenDetailId(option.id)
                }}
                onKeyDown={(e) => {
                  if (isShowingRandomResult) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onFocusSelect(option.id)
                    setOpenDetailId(option.id)
                  }
                }}
              >
                <span className="focus-card-icon-wrap">
                  <StudyTrackIcon focusId={option.id} />
                </span>
                <h2 className="focus-card-title">{option.title}</h2>
                <p className="focus-card-description">{option.description}</p>
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

      {detailOption && (
        <div
          className="study-detail-backdrop"
          role="presentation"
          onClick={closeStudyDetail}
        >
          <div
            className="study-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="study-detail-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="study-detail-close"
              onClick={closeStudyDetail}
              aria-label="Close study details"
            >
              ×
            </button>
            <div className="study-detail-body">
              <div
                className={
                  detailOption.id === 'my-red-hat'
                    ? 'study-detail-visual study-detail-visual--tall-screenshot'
                    : 'study-detail-visual'
                }
              >
                <img
                  src={detailOption.detailVisualSrc ?? studyDetailVisualPlaceholder}
                  alt={detailOption.detailVisualAlt ?? ''}
                  className="study-detail-visual-img"
                />
              </div>
              <div className="study-detail-copy">
                <h2 id="study-detail-modal-title" className="study-detail-modal-title">
                  {detailOption.title}
                </h2>
                <p className="study-detail-long-description">{detailOption.detailDescription}</p>
                <button
                  type="button"
                  className="study-detail-cta take-study-button"
                  onClick={() => {
                    onTakeStudy()
                  }}
                >
                  Take this study
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FocusSelector
