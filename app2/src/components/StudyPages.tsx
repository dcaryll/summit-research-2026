import { useState, useEffect, useMemo, useRef } from 'react'
import './StudyPages.css'
import logoImage from '../images/Logo-Red_Hat-A-White-RGB.svg'
import CompletionScreen from './CompletionScreen'
import LoadingScreen from './LoadingScreen'

interface StudyPagesProps {
  focusId: string
  onBack: () => void
  onComplete: (focusId: string, answers: Record<string, string>) => void
  onExportCsv?: () => void | Promise<void>
}

type CreditCard = { id: string; label: string; cost: number; description?: string }

type StudyPage = {
  id: string
  question: string
  type: 'text' | 'multiple-choice' | 'rating' | 'matrix' | 'buckets' | 'multi-select' | 'slider' | 'value-credits' | 'overview'
  options?: string[]
  rows?: { id: string; label: string }[]
  instruction?: string
  maxSelections?: number
  creditBudget?: number
  creditCards?: CreditCard[]
  /** When set, `question` must include {{ASSETS}}; filled from prior value-credits page. */
  followUpLargestCreditsFromPageId?: string
  /** When set, `question` must include {{OMITTED_ASSETS}}; highest-cost card(s) not selected on that page. */
  followUpOmittedHighestCreditsFromPageId?: string
  sliderMin?: number
  sliderMax?: number
  sliderMinLabel?: string
  sliderMaxLabel?: string
  sliderLabels?: string[]
  figmaEmbedUrl?: string
  /** On `multiple-choice`: show follow-up when main answer equals this. */
  followUpWhen?: string
  followUpAnswerKey?: string
  followUpQuestion?: string
  followUpOptions?: string[]
}

/** Option A on product evaluation trust question — triggers browser-sandbox follow-up. */
const TRUST_OWN_METAL_OPTION =
  'The ability to run it on my own metal (complete control)'

const CREDIT_FOLLOWUP_ASSETS_PLACEHOLDER = '{{ASSETS}}'
const CREDIT_FOLLOWUP_OMITTED_PLACEHOLDER = '{{OMITTED_ASSETS}}'

function joinCardLabels(cards: CreditCard[]): string {
  const names = cards.map((c) => c.label)
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/** Selected card(s) tied for highest credit cost — used in follow-up copy. */
function formatLargestCreditAssetPhrase(answerJson: string, cards: CreditCard[]): string | null {
  try {
    const ids = JSON.parse(answerJson || '[]') as string[]
    if (!ids.length) return null
    const byId = Object.fromEntries(cards.map((c) => [c.id, c]))
    const selected = ids.map((id) => byId[id]).filter(Boolean) as CreditCard[]
    if (!selected.length) return null
    const maxCost = Math.max(...selected.map((c) => c.cost))
    const top = selected.filter((c) => c.cost === maxCost)
    return joinCardLabels(top)
  } catch {
    return null
  }
}

/** Not selected card(s) tied for highest credit cost among omitted — used in follow-up copy. */
function formatOmittedHighestCreditPhrase(answerJson: string, cards: CreditCard[]): string | null {
  try {
    const selectedIds = new Set(JSON.parse(answerJson || '[]') as string[])
    const omitted = cards.filter((c) => !selectedIds.has(c.id))
    if (!omitted.length) return null
    const maxCost = Math.max(...omitted.map((c) => c.cost))
    const top = omitted.filter((c) => c.cost === maxCost)
    return joinCardLabels(top)
  } catch {
    return null
  }
}

function resolveStudyQuestion(page: StudyPage, allPages: StudyPage[], answers: Record<string, string>): string {
  let q = page.question
  if (page.followUpLargestCreditsFromPageId) {
    const refId = page.followUpLargestCreditsFromPageId
    const refPage = allPages.find((p) => p.id === refId)
    const cards = refPage?.creditCards
    const phrase =
      cards?.length != null && cards.length > 0
        ? formatLargestCreditAssetPhrase(answers[refId] || '[]', cards)
        : null
    q = q.replace(CREDIT_FOLLOWUP_ASSETS_PLACEHOLDER, phrase ?? 'your selections')
  }
  if (page.followUpOmittedHighestCreditsFromPageId) {
    const refId = page.followUpOmittedHighestCreditsFromPageId
    const refPage = allPages.find((p) => p.id === refId)
    const cards = refPage?.creditCards
    const phrase =
      cards?.length != null && cards.length > 0
        ? formatOmittedHighestCreditPhrase(answers[refId] || '[]', cards)
        : null
    q = q.replace(CREDIT_FOLLOWUP_OMITTED_PLACEHOLDER, phrase ?? 'some evaluation options')
  }
  return q
}

function computeCanProceed(page: StudyPage | undefined, ans: Record<string, string>): boolean {
  if (!page) return false
  if (page.type === 'overview') return true
  if ((page.type === 'matrix' || page.type === 'buckets') && page.rows) {
    return page.rows.every(
      row => ans[`${page.id}:${row.id}`] && ans[`${page.id}:${row.id}`].trim() !== ''
    )
  }
  if (page.type === 'multi-select' && page.maxSelections) {
    try {
      const selected = JSON.parse(ans[page.id] || '[]') as string[]
      return selected.length === page.maxSelections
    } catch {
      return false
    }
  }
  if (page.type === 'value-credits' && page.creditCards?.length && page.creditBudget != null) {
    try {
      const selected = JSON.parse(ans[page.id] || '[]') as string[]
      if (selected.length === 0) return false
      const byId = Object.fromEntries(page.creditCards.map((c) => [c.id, c]))
      const spent = selected.reduce((sum, id) => sum + (byId[id]?.cost ?? 0), 0)
      return spent > 0 && spent <= page.creditBudget
    } catch {
      return false
    }
  }
  if (page.type === 'slider') {
    const val = ans[page.id]
    return val !== undefined && val !== ''
  }
  if (page.type === 'multiple-choice' && page.followUpWhen !== undefined && page.followUpAnswerKey) {
    const main = ans[page.id]
    if (!main?.trim()) return false
    if (main === page.followUpWhen) {
      return !!ans[page.followUpAnswerKey]?.trim()
    }
    return true
  }
  return !!(ans[page.id] && ans[page.id].trim() !== '')
}

const STUDY_DISPLAY_NAME: Record<string, string> = {
  'product-evaluation': 'Product evaluation',
  'trying-products': 'Product evaluation',
  'user-preferences': 'User preferences',
  'developer-program': 'Developer program',
  'developer-for-business': 'Developer program',
  'my-red-hat': 'My Red Hat',
  dashboard: 'My Red Hat',
  'my-trials': 'My trials',
  'product-marketing': 'Product marketing',
  'buying-products': 'Product marketing',
  'content-discovery': 'Content discovery'
}

// Mock study pages/questions - this will be customized based on focusId
const getStudyPages = (focusId: string): StudyPage[] => {
  const pages: Record<string, StudyPage[]> = {
    'product-evaluation': [
      {
        id: '1',
        question: 'How many years have you been working with Red Hat solutions or similar enterprise Linux/Cloud environments?',
        type: 'multiple-choice',
        options: ['Less than 1 year', '1–2 years', '3–5 years', '6–10 years', 'More than 10 years']
      },
      {
        id: '3',
        type: 'multiple-choice',
        question:
          'If you had to choose ONE, which would make you trust a product more?',
        options: [
          TRUST_OWN_METAL_OPTION,
          'The ability to see it working in 5 minutes in a browser (zero-install speed)'
        ],
        followUpWhen: TRUST_OWN_METAL_OPTION,
        followUpAnswerKey: '3-follow-metal',
        followUpQuestion:
          'If an AI Assistant could perfectly simulate your \'own metal\' environment in a browser-based sandbox, would you still feel the need to download the binary?',
        followUpOptions: [
          'Yes, I would still need the binary',
          'No, a faithful browser sandbox would be enough',
          'Not sure'
        ]
      },
      {
        id: '2',
        question: 'When you are tasked with evaluating a new piece of software, which of these sounds more like you?',
        type: 'multiple-choice',
        options: [
          "The Modernizer: 'I want a browser-based sandbox or API-first environment. I want to see value in 5 minutes without installing anything.'",
          "The Veteran: 'I want the binary. I want to run it on my own metal or local VM so I can see how it actually performs in a real environment.'"
        ]
      },
      {
        id: '4',
        question: 'When evaluating new tech, do you prefer starting with a blank slate to build from scratch, or an AI-generated template that has 80% of the configuration already done?',
        type: 'multiple-choice',
        options: [
          'A blank slate — build from scratch',
          'An AI-generated template with most of the configuration done (~80%)'
        ]
      },
      {
        id: '5',
        question:
          "You have 10 Value Credits to spend. If you could design your 'perfect' evaluation experience, which of these cards are non-negotiable for you? You can't buy them all, so choose the ones that move the needle most for your 'Technical Win'.",
        type: 'value-credits',
        creditBudget: 10,
        instruction:
          'Select one or more cards. Each card costs credits; your total cannot exceed 10. Remove a card to free credits.',
        creditCards: [
          {
            id: 'full-product-download',
            label: 'Full Product Download',
            cost: 4,
            description: 'Local install, requires your own hardware.'
          },
          {
            id: 'guided-interactive-lab',
            label: 'Guided Interactive Lab',
            cost: 4,
            description: 'In-browser, pre-configured environment.'
          },
          {
            id: 'developer-sandbox',
            label: 'Developer Sandbox',
            cost: 3,
            description: 'Open-ended, API-access, cloud-hosted.'
          },
          {
            id: 'human-in-the-loop',
            label: 'Human-in-the-Loop',
            cost: 3,
            description: 'Access to a SE/Architect during trial.'
          },
          {
            id: 'ai-evaluation-assistant',
            label: 'AI Evaluation Assistant',
            cost: 3,
            description:
              'Specialized LLM trained on Red Hat product docs that can auto-generate configurations or answer "How do I..." questions in real-time after you\'ve downloaded a product or started a trial.'
          },
          {
            id: 'sample-data-code',
            label: 'Sample Data/Code',
            cost: 2,
            description: 'Github-ready snippets and prepopulated data.'
          },
          {
            id: 'self-service-demo',
            label: 'Self-Service Demo',
            cost: 2,
            description: 'Passive video or click-through overview.'
          },
          {
            id: 'tech-docs-api-ref',
            label: 'Tech Docs/API Ref',
            cost: 1,
            description: 'Pure text and technical specifications.'
          }
        ]
      },
      {
        id: '6',
        type: 'text',
        followUpLargestCreditsFromPageId: '5',
        question:
          `I see you spent a large portion of your budget on ${CREDIT_FOLLOWUP_ASSETS_PLACEHOLDER}. Why is that more valuable to you than having three or four smaller assets?`
      },
      {
        id: '7',
        type: 'multiple-choice',
        followUpOmittedHighestCreditsFromPageId: '5',
        question:
          `You left ${CREDIT_FOLLOWUP_OMITTED_PLACEHOLDER} out of your budget. If that was the only way Red Hat offered an evaluation, would you still try the product, or would you walk away?`,
        options: ['I would still try the product', 'I would walk away']
      },
      {
        id: '8',
        type: 'text',
        question:
          "Before we end, was there anything else about how you like to test software that we didn't cover?"
      }
    ],
    'my-red-hat': [
      { id: '1', question: 'How often do you use My Red Hat (dashboard / customer portal)?', type: 'multiple-choice', options: ['Daily', 'Weekly', 'Monthly', 'Rarely'] },
      {
        id: '2',
        question: 'Review the prototype below, then tell us: What features do you use most frequently?',
        type: 'text',
        figmaEmbedUrl: 'https://embed.figma.com/proto/RagMk0n5dRjRUiWypq1jw4?node-id=2561-29592&embed-host=summit-research&scaling=scale-down-width&content-scaling=fixed'
      },
      { id: '3', question: 'What improvements would you like to see?', type: 'text' }
    ],
    'user-preferences': [
      {
        id: '1',
        question: 'We are centralizing how you manage your account data. Where do you expect to go to view or edit the following?',
        type: 'buckets',
        options: ['Account', 'Profile', 'Preference or Settings', 'Other'],
        rows: [
          { id: 'job-role', label: 'Job/Role' },
          { id: 'technical-interests', label: 'Technical topic interests' },
          { id: 'display-preferences', label: 'Display preferences (ex: dark/light, magnification, motion)' },
          { id: 'latest-activity', label: 'Your latest activity (ex: recently viewed docs, product downloads, support cases opened/updated, certifications or learning path progress, followed topics or products, community interactions)' },
          { id: 'language', label: 'Language preference' },
          { id: 'experience-level', label: 'Experience level with Red Hat' },
          { id: 'top-tasks', label: 'Top tasks' },
          { id: 'event-interests', label: 'Event interests' },
          { id: 'bookmarks', label: 'Bookmarks' }
        ]
      },
      {
        id: '2',
        question: 'Should [Attribute] be customized for you across all Red Hat digital touchpoints, or should it be application specific?',
        type: 'buckets',
        options: ['Customized (across all touchpoints)', 'App-specific'],
        instruction: 'Drag each attribute into the bucket that reflects your preference',
        rows: [
          { id: 'language-preference', label: 'Language preference' },
          { id: 'technical-focus', label: 'Primary technical focus (e.g., Ansible)' },
          { id: 'dark-light-mode', label: 'Dark/light mode' },
          { id: 'email-frequency', label: 'Email communication frequency' },
          { id: 'topic-product-interest', label: 'Topic/product interest' },
          { id: 'current-role', label: 'Current role' },
          { id: 'learning-goals', label: 'Learning goals' },
          { id: 'event-notifications', label: 'Event notifications' },
          { id: 'industry-interest', label: 'Industry interest' },
          { id: 'ai-privacy-controls', label: 'AI data and privacy controls' }
        ]
      },
      {
        id: '3',
        question: 'If Red Hat could carry over your individual attributes to save you time and provide better experiences, which 5 items would be most valuable to you?',
        type: 'multi-select',
        maxSelections: 5,
        instruction: 'Select exactly 5 items',
        options: [
          'Job/Role',
          'Experience level with Red Hat',
          'My skill level with technical content (beginner, intermediate, advanced)',
          'My industry',
          'The products or topics I follow',
          'My development languages/frameworks',
          'My preferred deployment environments',
          'Learning goals or certification paths',
          'Display preferences (ex: dark/light, magnification, motion)',
          'My latest activity (ex: recently viewed docs, product downloads, support cases opened/updated, certification or learning path progress, followed topics or products, community interactions)',
          'Language preference',
          'Event interests',
          'My saved resources or bookmarks',
          'Notification and email preferences',
          'Accessibility or display preferences'
        ]
      },
      {
        id: '4',
        question: 'How willing are you to provide personal and preference information in exchange for more relevant, personalized content and recommendations?',
        type: 'slider',
        sliderMin: 1,
        sliderMax: 5,
        sliderLabels: ['Not willing', 'Slightly willing', 'Somewhat willing', 'Generally willing', 'Very willing']
      },
      {
        id: '5',
        question: "On a scale of 1-5, how do you feel when you're asked to re-select or fill in details you've shared before?",
        type: 'slider',
        sliderMin: 1,
        sliderMax: 5,
        sliderLabels: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied']
      }
    ],
    'product-marketing': [
      { id: '1', question: 'How do you typically learn about or purchase Red Hat products?', type: 'multiple-choice', options: ['Red Hat website and campaigns', 'Direct from Red Hat sales', 'Through a partner or reseller', 'My organization\'s procurement', 'Events and webinars', 'Other'] },
      { id: '2', question: 'What challenges do you face when evaluating product information or making a purchase decision?', type: 'text' },
      { id: '3', question: 'What would make product marketing and buying information more useful for you?', type: 'text' }
    ],
    'developer-program': [
      { id: '1', question: 'Which parts of the Red Hat Developer program or tools do you use today?', type: 'multiple-choice', options: ['OpenShift', 'RHEL', 'Ansible', 'Quay', 'Buildah/Podman', 'Developer portal / sandbox', 'Other'] },
      { id: '2', question: 'How do Red Hat developer resources support your work?', type: 'text' },
      { id: '3', question: 'What would make the developer program more valuable for you?', type: 'text' }
    ],
    'my-trials': [
      { id: '1', question: 'How do you usually start or access a trial of a Red Hat product?', type: 'multiple-choice', options: ['redhat.com', 'My Red Hat / customer portal', 'Through my sales contact', 'At an event', 'Partner or marketplace', 'Other'] },
      { id: '2', question: 'What has been your biggest challenge with product trials?', type: 'text' },
      { id: '3', question: 'What would make trials easier or more useful for you?', type: 'text' }
    ],
    'content-discovery': [
      {
        id: 'intro',
        type: 'overview',
        question:
          "Hi there, we're looking to learn more about how you like to learn about technology topics you're interested in and in what mediums you prefer to learn.\n\nIn the next 5 minutes, you'll help us improve our topical learning content offerings by ranking and choosing between different types of learning content. Your feedback will help us provide more relevant and useful learning content across our sites."
      },
      { id: '1', question: 'When you need to learn something about a Red Hat product, where do you look first?', type: 'multiple-choice', options: ['Documentation (docs.redhat.com)', 'Red Hat website', 'Search engine', 'learn.redhat.com', 'Developer resources', 'Community forums', 'Other'] },
      { id: '2', question: 'What makes technical content easy or hard for you to discover and use?', type: 'text' },
      { id: '3', question: 'What would improve content discovery for you?', type: 'text' }
    ]
  }
  const legacy: Record<string, string> = {
    'trying-products': 'product-evaluation',
    dashboard: 'my-red-hat',
    'buying-products': 'product-marketing',
    'developer-for-business': 'developer-program'
  }
  const fid = (focusId || '').trim()
  const resolved = legacy[fid] || fid
  return pages[resolved] || []
}

function StudyPages({ focusId, onBack, onComplete, onExportCsv }: StudyPagesProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showCompletion, setShowCompletion] = useState(false)
  const [isLoadingCompletion, setIsLoadingCompletion] = useState(false)
  const studyPages = useMemo(() => getStudyPages(focusId), [focusId])
  const pageNavigationRef = useRef<HTMLDivElement>(null)
  const prevCanProceedRef = useRef<boolean | null>(null)

  const currentPage = studyPages[currentPageIndex]
  const displayedQuestion = currentPage ? resolveStudyQuestion(currentPage, studyPages, answers) : ''

  useEffect(() => {
    if (studyPages.length > 0 && currentPageIndex >= studyPages.length) {
      setCurrentPageIndex(Math.max(0, studyPages.length - 1))
    }
  }, [studyPages.length, currentPageIndex])

  // Initialize slider with min value when landing on a slider page
  useEffect(() => {
    if (currentPage?.type === 'slider' && answers[currentPage.id] === undefined) {
      setAnswers(prev => ({ ...prev, [currentPage.id]: String(currentPage.sliderMin ?? 1) }))
    }
  }, [currentPage?.id, currentPage?.type])
  const isLastPage = studyPages.length > 0 && currentPageIndex === studyPages.length - 1
  const isFirstPage = currentPageIndex === 0

  const handleAnswerChange = (value: string, rowId?: string) => {
    if (!currentPage) return
    if (rowId) {
      if (value === '') {
        setAnswers(prev => {
          const next = { ...prev }
          delete next[`${currentPage.id}:${rowId}`]
          return next
        })
      } else {
        setAnswers(prev => ({ ...prev, [`${currentPage.id}:${rowId}`]: value }))
      }
    } else {
      setAnswers((prev) => {
        const next = { ...prev, [currentPage.id]: value }
        if (
          currentPage.type === 'multiple-choice' &&
          currentPage.followUpAnswerKey &&
          currentPage.followUpWhen !== undefined
        ) {
          if (value !== currentPage.followUpWhen) delete next[currentPage.followUpAnswerKey]
        }
        return next
      })
    }
  }

  const getPlaceholderAnswers = (page: StudyPage): Record<string, string> => {
    const overrides: Record<string, string> = {}
    if (page.type === 'overview') {
      return overrides
    }
    if (page.type === 'text') {
      overrides[page.id] = '[skipped]'
    } else if (page.type === 'multiple-choice' && page.options?.length) {
      overrides[page.id] = page.options[0]
      if (page.followUpAnswerKey && page.followUpOptions?.length) {
        overrides[page.followUpAnswerKey] = page.followUpOptions[0]
      }
    } else if (page.type === 'rating') {
      overrides[page.id] = '3'
    } else if ((page.type === 'matrix' || page.type === 'buckets') && page.rows && page.options?.length) {
      const opt = page.options[0]
      page.rows.forEach(row => { overrides[`${page.id}:${row.id}`] = opt })
    } else if (page.type === 'multi-select' && page.options && page.maxSelections) {
      overrides[page.id] = JSON.stringify(page.options.slice(0, page.maxSelections))
    } else if (page.type === 'value-credits' && page.creditCards?.length && page.creditBudget != null) {
      const ids: string[] = []
      let spent = 0
      for (const c of page.creditCards) {
        if (spent + c.cost <= page.creditBudget) {
          ids.push(c.id)
          spent += c.cost
        }
      }
      overrides[page.id] = JSON.stringify(ids.length ? ids : [page.creditCards[0].id])
    } else if (page.type === 'slider') {
      overrides[page.id] = String(page.sliderMin ?? 3)
    }
    return overrides
  }

  const handleNext = async (answerOverrides?: Record<string, string>) => {
    const mergedAnswers = answerOverrides ? { ...answers, ...answerOverrides } : answers
    if (currentPageIndex < studyPages.length - 1) {
      if (answerOverrides) setAnswers(prev => ({ ...prev, ...answerOverrides }))
      setCurrentPageIndex((i) => i + 1)
    } else {
      if (answerOverrides) setAnswers(prev => ({ ...prev, ...answerOverrides }))
      await onComplete(focusId, mergedAnswers)
      setIsLoadingCompletion(true)
      setTimeout(() => {
        setIsLoadingCompletion(false)
        setShowCompletion(true)
      }, 1500)
    }
  }

  const handlePrevious = () => {
    if (currentPageIndex > 0) setCurrentPageIndex((i) => i - 1)
  }

  const canProceed = () => computeCanProceed(currentPage, answers)

  useEffect(() => {
    prevCanProceedRef.current = null
  }, [currentPageIndex])

  useEffect(() => {
    const page = studyPages[currentPageIndex]
    if (!page) return
    const ok = computeCanProceed(page, answers)
    const prev = prevCanProceedRef.current
    if (prev === false && ok) {
      pageNavigationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    if (prev === null) {
      prevCanProceedRef.current = ok
      return
    }
    prevCanProceedRef.current = ok
  }, [answers, currentPageIndex, studyPages])

  if (isLoadingCompletion) {
    return <LoadingScreen message="Preparing" />
  }

  if (showCompletion) {
    return <CompletionScreen onBack={onBack} onExportCsv={onExportCsv} />
  }

  if (studyPages.length === 0) {
    return (
      <div className="study-pages-screen">
        <div className="study-header">
          <img src={logoImage} alt="Red Hat Logo" className="study-logo" />
          <button className="back-button" onClick={onBack}>Back to study selection</button>
        </div>
        <div className="study-content">
          <p>No study pages available for this focus area.</p>
        </div>
      </div>
    )
  }

  if (!currentPage) {
    return (
      <div className="study-pages-screen">
        <div className="study-header">
          <img src={logoImage} alt="Red Hat Logo" className="study-logo" />
          <button className="back-button" onClick={onBack}>Back to study selection</button>
        </div>
        <div className="study-content">
          <p>Loading study…</p>
        </div>
      </div>
    )
  }

  const studyTitle = STUDY_DISPLAY_NAME[focusId] ?? focusId.replace(/-/g, ' ')

  return (
    <div className="study-pages-screen">
      <div className="study-header">
        <img src={logoImage} alt="Red Hat Logo" className="study-logo" />
        <button className="back-button" onClick={onBack}>Back to study selection</button>
      </div>

      <div className="study-content">
        <div className="page-indicator">
          <span className="study-track-name">{studyTitle}</span>
          <span className="page-indicator-count">
            Page {currentPageIndex + 1} of {studyPages.length}
          </span>
        </div>

        <div className="page-content">
          {currentPage.type === 'overview' ? (
            <div className="study-overview" role="region" aria-label="Study introduction">
              {currentPage.question
                .split(/\n\n+/)
                .map((para) => para.trim())
                .filter(Boolean)
                .map((para, i) => (
                  <p key={i} className="study-overview-paragraph">
                    {para}
                  </p>
                ))}
            </div>
          ) : (
            <h2 className="page-question">{displayedQuestion}</h2>
          )}

          {currentPage.figmaEmbedUrl && (
            <div className="figma-embed-wrap">
              <iframe
                src={currentPage.figmaEmbedUrl}
                className="figma-embed"
                allowFullScreen
                title="Figma prototype"
              />
            </div>
          )}

          {currentPage.type === 'text' && (
            <textarea
              className="text-input"
              value={answers[currentPage.id] || ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Type your answer here..."
              rows={6}
            />
          )}

          {currentPage.type === 'multiple-choice' && currentPage.options && (
            <div className={currentPage.followUpWhen !== undefined ? 'evaluation-trust' : undefined}>
              <div className="options-list">
                {currentPage.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`option-button ${answers[currentPage.id] === option ? 'selected' : ''}`}
                    onClick={() => handleAnswerChange(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {currentPage.followUpWhen !== undefined &&
                answers[currentPage.id] === currentPage.followUpWhen &&
                currentPage.followUpQuestion &&
                currentPage.followUpOptions &&
                currentPage.followUpAnswerKey && (
                  <div className="evaluation-trust-follow">
                    <p className="evaluation-trust-follow-question">{currentPage.followUpQuestion}</p>
                    <div className="options-list">
                      {currentPage.followUpOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`option-button ${answers[currentPage.followUpAnswerKey!] === option ? 'selected' : ''}`}
                          onClick={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [currentPage.followUpAnswerKey!]: option
                            }))
                          }
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {currentPage.type === 'multi-select' && currentPage.options && (
            <div className="multi-select-question">
              {currentPage.instruction && (
                <p className="multi-select-instruction">{currentPage.instruction}</p>
              )}
              <div className="multi-select-options">
                {currentPage.options.map((option) => {
                  const selected = (() => {
                    try {
                      const arr = JSON.parse(answers[currentPage.id] || '[]') as string[]
                      return arr.includes(option)
                    } catch { return false }
                  })()
                  const selectedCount = (() => {
                    try {
                      return (JSON.parse(answers[currentPage.id] || '[]') as string[]).length
                    } catch { return 0 }
                  })()
                  const canSelect = selected || selectedCount < (currentPage.maxSelections ?? 999)
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`multi-select-option ${selected ? 'selected' : ''} ${!canSelect ? 'disabled' : ''}`}
                      onClick={() => {
                        if (!canSelect) return
                        try {
                          const arr = JSON.parse(answers[currentPage.id] || '[]') as string[]
                          const next = selected
                            ? arr.filter((x: string) => x !== option)
                            : [...arr, option]
                          handleAnswerChange(JSON.stringify(next))
                        } catch {
                          handleAnswerChange(JSON.stringify(selected ? [] : [option]))
                        }
                      }}
                    >
                      <span className="multi-select-check">{selected ? '✓' : ''}</span>
                      {option}
                      {currentPage.maxSelections && selected && (
                        <span className="multi-select-rank">
                          {(JSON.parse(answers[currentPage.id] || '[]') as string[]).indexOf(option) + 1}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {currentPage.maxSelections && (
                <p className="multi-select-count">
                  {((): number => {
                    try { return (JSON.parse(answers[currentPage.id] || '[]') as string[]).length }
                    catch { return 0 }
                  })()}
                  /{currentPage.maxSelections} selected
                </p>
              )}
            </div>
          )}

          {currentPage.type === 'value-credits' && currentPage.creditCards && currentPage.creditBudget != null && (
            <div className="value-credits-question">
              {currentPage.instruction && (
                <p className="value-credits-instruction">{currentPage.instruction}</p>
              )}
              <p className="value-credits-budget" aria-live="polite">
                <span className="value-credits-budget-spent">
                  {(() => {
                    try {
                      const sel = JSON.parse(answers[currentPage.id] || '[]') as string[]
                      const byId = Object.fromEntries(currentPage.creditCards.map((c) => [c.id, c]))
                      return sel.reduce((s, id) => s + (byId[id]?.cost ?? 0), 0)
                    } catch {
                      return 0
                    }
                  })()}
                </span>
                <span className="value-credits-budget-sep"> / </span>
                <span>{currentPage.creditBudget}</span>
                <span className="value-credits-budget-label"> credits spent</span>
              </p>
              <div className="value-credits-cards">
                {currentPage.creditCards.map((card) => {
                  const selected = (() => {
                    try {
                      const arr = JSON.parse(answers[currentPage.id] || '[]') as string[]
                      return arr.includes(card.id)
                    } catch {
                      return false
                    }
                  })()
                  const spent = (() => {
                    try {
                      const arr = JSON.parse(answers[currentPage.id] || '[]') as string[]
                      const byId = Object.fromEntries(currentPage.creditCards!.map((c) => [c.id, c]))
                      return arr.reduce((s, id) => s + (byId[id]?.cost ?? 0), 0)
                    } catch {
                      return 0
                    }
                  })()
                  const spentIfAdded = selected ? spent : spent + card.cost
                  const overBudget = !selected && spentIfAdded > currentPage.creditBudget!
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`value-credits-card ${selected ? 'selected' : ''} ${overBudget ? 'disabled' : ''}`}
                      disabled={overBudget}
                      onClick={() => {
                        if (overBudget) return
                        try {
                          const arr = JSON.parse(answers[currentPage.id] || '[]') as string[]
                          const next = selected ? arr.filter((x: string) => x !== card.id) : [...arr, card.id]
                          handleAnswerChange(JSON.stringify(next))
                        } catch {
                          handleAnswerChange(JSON.stringify(selected ? [] : [card.id]))
                        }
                      }}
                    >
                      <span className="value-credits-check">{selected ? '✓' : ''}</span>
                      <span className="value-credits-card-text">
                        <span className="value-credits-card-title">{card.label}</span>
                        {card.description ? (
                          <span className="value-credits-card-desc">{card.description}</span>
                        ) : null}
                      </span>
                      <span className="value-credits-cost">{card.cost} credits</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {currentPage.type === 'rating' && (
            <div className="rating-buttons">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  className={`rating-button ${answers[currentPage.id] === rating.toString() ? 'selected' : ''}`}
                  onClick={() => handleAnswerChange(rating.toString())}
                >
                  {rating}
                </button>
              ))}
            </div>
          )}

          {currentPage.type === 'slider' && (
            <div className="slider-question">
              <div className="slider-track-wrap">
                <input
                  type="range"
                  className="slider-input"
                  min={currentPage.sliderMin ?? 1}
                  max={currentPage.sliderMax ?? 5}
                  value={answers[currentPage.id] ?? String(currentPage.sliderMin ?? 1)}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                />
                {currentPage.sliderLabels ? (
                  <div className="slider-labels-full">
                    {currentPage.sliderLabels.map((label, i) => {
                      const num = (currentPage.sliderMin ?? 1) + i
                      const isActive = Number(answers[currentPage.id] ?? currentPage.sliderMin ?? 1) === num
                      return (
                        <button
                          key={num}
                          type="button"
                          className={`slider-label-point ${isActive ? 'active' : ''}`}
                          style={{ left: `${(i / (currentPage.sliderLabels!.length - 1)) * 100}%` }}
                          onClick={() => handleAnswerChange(String(num))}
                        >
                          <span className="slider-label-num">{num}</span>
                          <span className="slider-label-text">{label}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="slider-labels">
                    <span>{currentPage.sliderMinLabel ?? '1'}</span>
                    <span>{currentPage.sliderMaxLabel ?? '5'}</span>
                  </div>
                )}
              </div>
              <p className="slider-value">
                {currentPage.sliderLabels
                  ? `${answers[currentPage.id] ?? currentPage.sliderMin ?? 1} – ${currentPage.sliderLabels[Number(answers[currentPage.id] ?? currentPage.sliderMin ?? 1) - (currentPage.sliderMin ?? 1)] ?? ''}`
                  : (answers[currentPage.id] ?? currentPage.sliderMin ?? 1)}
              </p>
            </div>
          )}

          {currentPage.type === 'matrix' && currentPage.rows && currentPage.options && (
            <div className="matrix-question">
              <p className="matrix-instruction">{currentPage.instruction || `Select one for each: ${currentPage.options.join(', ')}`}</p>
              <div className="matrix-table">
                {currentPage.rows.map((row) => (
                  <div key={row.id} className="matrix-row">
                    <div className="matrix-row-label">{row.label}</div>
                    <div className="matrix-row-options">
                      {currentPage.options!.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`matrix-option ${answers[`${currentPage.id}:${row.id}`] === option ? 'selected' : ''}`}
                          onClick={() => handleAnswerChange(option, row.id)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentPage.type === 'buckets' && currentPage.rows && currentPage.options && (
            <div className="buckets-question">
              <p className="buckets-instruction">{currentPage.instruction || 'Drag each term into the bucket where you expect to find it'}</p>
              <div className="buckets-container">
                {currentPage.options.map((bucket) => {
                  const itemsInBucket = currentPage.rows!.filter(
                    row => answers[`${currentPage.id}:${row.id}`] === bucket
                  )
                  return (
                    <div
                      key={bucket}
                      className="bucket"
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.currentTarget.classList.add('bucket-drag-over')
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove('bucket-drag-over')
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.currentTarget.classList.remove('bucket-drag-over')
                        const rowId = e.dataTransfer.getData('text/plain')
                        if (rowId) handleAnswerChange(bucket, rowId)
                      }}
                    >
                      <div className="bucket-header">{bucket}</div>
                      <div className="bucket-items">
                        {itemsInBucket.map((row) => (
                          <div
                            key={row.id}
                            className="bucket-item"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', row.id)
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                          >
                            {row.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div
                className="bucket-unplaced"
                onDragOver={(e) => {
                  e.preventDefault()
                  e.currentTarget.classList.add('bucket-drag-over')
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('bucket-drag-over')
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('bucket-drag-over')
                  const rowId = e.dataTransfer.getData('text/plain')
                  if (rowId) handleAnswerChange('', rowId)
                }}
              >
                <div className="bucket-header">Items to place</div>
                <div className="bucket-items">
                  {currentPage.rows!
                    .filter(row => !answers[`${currentPage.id}:${row.id}`])
                    .map((row) => (
                      <div
                        key={row.id}
                        className="bucket-item"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', row.id)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                      >
                        {row.label}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="page-navigation" ref={pageNavigationRef}>
          {!isFirstPage && (
            <button className="nav-button previous" onClick={handlePrevious}>
              Previous
            </button>
          )}
          <div className="page-navigation-right">
            {import.meta.env.DEV && (
              <button
                type="button"
                className="nav-button skip"
                onClick={() => handleNext(getPlaceholderAnswers(currentPage))}
              >
                Skip
              </button>
            )}
            <button
              className="nav-button next"
              onClick={() => handleNext()}
              disabled={!canProceed()}
            >
              {isLastPage ? 'Submit' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StudyPages
