import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import gearSource from '@rhds/icons/standard/gear.js'
import backlogSource from '@rhds/icons/standard/backlog.js'
import developerSource from '@rhds/icons/standard/developer.js'
import controlPanelSource from '@rhds/icons/standard/control-panel.js'
import productTrialSource from '@rhds/icons/standard/product-trial.js'
import architectureSource from '@rhds/icons/standard/architecture.js'
import bookSource from '@rhds/icons/standard/book.js'
import './FocusSelector.css'
import { studyLogo } from '../studyBrand'
import studyDetailVisualPlaceholder from '../images/study-detail-visual-placeholder.svg'
import myRedHatStudyDetailHero from '../images/my-red-hat-study-detail-hero.png'
import myTrialsStudyDetailHero from '../images/testing-to-buying-overview.png'
import userPreferencesStudyDetailHero from '../images/user-preferences-study-detail-hero.png'
import productEvaluationStudyDetailHero from '../images/product-evaluation-study-detail-hero.png'
import developerProgramStudyDetailHero from '../images/developer-program-overview-hero.png'
import productMarketingStudyDetailHero from '../images/product-secondary-nav.webp'
import contentDiscoveryStudyDetailHero from '../images/learn-study-overview-image.png'

/**
 * Official RHDS SVG assets (same as https://ux.redhat.com/foundations/iconography/).
 * We import modules statically — `rh-icon` uses dynamic imports that Vite does not resolve reliably.
 */
const RHDS_STUDY_ICON_SOURCES: Record<string, Node> = {
  'user-preferences': gearSource,
  'product-evaluation': backlogSource,
  'developer-program': developerSource,
  'my-red-hat': controlPanelSource,
  'my-trials': productTrialSource,
  'product-marketing': architectureSource,
  'content-discovery': bookSource
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

function DiceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
      <circle cx="8" cy="16" r="1.5" fill="currentColor" />
      <circle cx="16" cy="8" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

interface FocusSelectorProps {
  onFocusSelect: (focus: string) => void
  /** Called when the study detail modal is dismissed without starting the study. */
  onClearFocusSelection?: () => void
  selectedFocus: string | null
  onTakeStudy: () => void
  onExportCsv?: () => void | Promise<void>
}

interface FocusOption {
  id: string
  title: string
  /** Short teaser under the title (time estimate is shown as a card tag, not here). */
  description: string
  /** Shown as a pill in the top-right of the study card. */
  durationLabel: string
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
    description: 'Tell us how you expect your profile and settings to create a unique experience for you.',
    durationLabel: '10–15 mins',
    detailDescription:
      'This study explores where you expect to manage account-related information, which settings should carry across sites, and how you feel about sharing your preferences to enable a more personalized experience. You will work through drag-and-drop placement, multi-select, and sliders at your own pace—plan for about 10–15 minutes. Your feedback helps us design clearer, more consistent preference experiences.',
    detailVisualSrc: userPreferencesStudyDetailHero,
    detailVisualAlt:
      'Personal information and profile details: greeting, first and last name, bio with public/private toggles, profile image with update/delete, and certifications area.'
  },
  {
    id: 'product-evaluation',
    title: 'Build your dream trial',
    description: 'Play the evaluation budget game and show us how you prefer to test software.',
    durationLabel: '5-8 mins',
    detailDescription:
      'We want to understand how you evaluate software in real life—what builds trust, how you weigh trials versus installs, and what you need before recommending a product. The session includes a credit-budget activity and several follow-ups. Plan for roughly 5-8 minutes; there are no wrong answers.',
    detailVisualSrc: productEvaluationStudyDetailHero,
    detailVisualAlt:
      'Red Hat Enterprise Linux trial page with AI assistance on, Get started, benefits list, and setup step asking what you want to achieve with RHEL (e.g. Developing applications selected).'
  },
  {
    id: 'developer-program',
    title: 'Shape the Developer program',
    description: 'Help us tailor our technical resources and tools to your daily workflow.',
    durationLabel: '8–12 mins',
    detailDescription:
      'Share which developer tools and programs you use today, how they fit into your workflow, and what would make Red Hat’s developer offerings more useful. Expect a short prototype exploration plus multiple-choice and open-ended questions. Most participants finish in about 8–12 minutes.',
    detailVisualSrc: developerProgramStudyDetailHero,
    detailVisualAlt:
      'Illustration of a small robot in a white astronaut helmet and red hoodie typing on a laptop, in a dark purple space-themed scene with geometric shapes and stars.'
  },
  {
    id: 'my-red-hat',
    title: 'Refine your intelligent dashboard',
    description: 'Explore AI-built views and portable tools to build the ultimate My Red Hat.',
    durationLabel: '10–15 mins',
    detailDescription:
      'This track focuses on the My Red Hat portal and related experiences—navigation, dashboards, and tasks you perform as a customer. It has three sections with interactive previews and several written follow-ups per section. Set aside about 10–15 minutes to complete the study comfortably.',
    detailVisualSrc: myRedHatStudyDetailHero,
    detailVisualAlt:
      'Screenshot of the My dashboard page in the Red Hat customer portal, showing trials, subscriptions, support cases, and related widgets.'
  },
  {
    id: 'my-trials',
    title: 'From testing to buying',
    description: 'Tell us your biggest roadblocks when upgrading from a product trial.',
    durationLabel: '10–15 mins',
    detailDescription:
      'We are learning how people move from trial to purchase—including what you expect from “buy” flows, what feels unclear, and how we can make post-trial paths easier. You will answer questions about trials, buying options, and rank proposed improvements. Allow roughly 10–15 minutes.',
    detailVisualSrc: myTrialsStudyDetailHero,
    detailVisualAlt:
      'Overview graphic for the trial-to-purchase study: trials, buying paths, and next-step options in the product experience.'
  },
  {
    id: 'product-marketing',
    title: 'Improve our product navigation',
    description: "Sort and rank menu terms so finding products doesn't feel like a guessing game.",
    durationLabel: '10–15 mins',
    detailDescription:
      'Help us understand how you scan product menus and information architecture when researching or buying. This study includes a large sorting task, rankings, and several explain-your-answer prompts. Expect about 10–15 minutes depending on how much you think aloud while you work.',
    detailVisualSrc: productMarketingStudyDetailHero,
    detailVisualAlt:
      'Red Hat product page excerpt highlighting the horizontal secondary navigation with menu items such as Explore, Overview, and related product links.'
  },
  {
    id: 'content-discovery',
    title: 'How do you learn best?',
    description: 'Videos, blogs, or podcasts? Tell us what content helps you master new tech.',
    durationLabel: '5–8 mins',
    detailDescription:
      'We want to learn how you prefer to discover learning content by topic—what you notice first, how you rank formats, and what would help you go deeper. You will pick a topic, make choices, complete two ranking exercises, and answer a short follow-up. Most people finish in about 5–8 minutes.',
    detailVisualSrc: contentDiscoveryStudyDetailHero,
    detailVisualAlt:
      'Illustration introducing topical learning—content formats such as podcasts, articles, and ebooks in a bold, stacked layout.'
  }
]

const RANDOM_RESULT_DURATION_MS = 2500

function FocusSelector({
  onFocusSelect,
  onClearFocusSelection,
  selectedFocus,
  onTakeStudy,
  onExportCsv
}: FocusSelectorProps) {
  const orderedOptions = useMemo(() => shuffleArray(focusOptions), [])
  const [isShowingRandomResult, setIsShowingRandomResult] = useState(false)
  const [randomChosenFocus, setRandomChosenFocus] = useState<string | null>(null)
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

  return (
    <div className="focus-selector-screen">
      <header className="focus-selector-top-bar">
        <div className="logo-container">
          <img src={studyLogo} alt="" className="logo-image" />
        </div>
      </header>

      <div className="selector-content">
        <div className="selector-headline-block">
          <h1 className="selector-title">Select your focus</h1>
          <p className="selector-subtitle">Choose a study track that interests you</p>
        </div>

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
                <div className="focus-card-header">
                  <span className="focus-card-icon-wrap">
                    <StudyTrackIcon focusId={option.id} />
                  </span>
                  <span className="focus-card-duration-tag" aria-label={`Estimated time: ${option.durationLabel}`}>
                    {option.durationLabel}
                  </span>
                </div>
                <h2 className="focus-card-title">{option.title}</h2>
                <p className="focus-card-description">{option.description}</p>
              </div>
            )
          })}
          <div
            role="button"
            tabIndex={0}
            className={`focus-card focus-card--surprise ${isShowingRandomResult ? 'focus-card--random-dismiss' : ''}`}
            onClick={() => {
              if (isShowingRandomResult) return
              handleRandomize()
            }}
            onKeyDown={(e) => {
              if (isShowingRandomResult) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleRandomize()
              }
            }}
          >
            <div className="focus-card-surprise-inner">
              <span className="focus-card-surprise-dice-wrap" aria-hidden>
                <DiceIcon className="focus-card-surprise-dice" />
              </span>
              <h2 className="focus-card-title focus-card-surprise-title">Surprise me!</h2>
            </div>
          </div>
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
