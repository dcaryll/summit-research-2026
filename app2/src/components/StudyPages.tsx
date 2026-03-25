import { useState, useEffect, useMemo, useRef, type DragEvent, type ReactNode } from 'react'
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
  type: 'text' | 'multiple-choice' | 'rating' | 'matrix' | 'buckets' | 'multi-select' | 'slider' | 'value-credits' | 'overview' | 'ranking' | 'prototype'
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
  /** Shown above the question; use with `imageAlt` for accessibility. */
  imageSrc?: string
  imageAlt?: string
  /** Gray placeholder block when the final image is not ready yet. */
  placeholderImage?: boolean
  /** Topic-page style placeholder before the question (e.g. hybrid cloud prototype). */
  prototypePlaceholder?: boolean
  /** When set with `figmaEmbedUrl`, render the iframe above the question instead of below. */
  figmaEmbedAboveQuestion?: boolean
  /** On `multiple-choice`: show follow-up when main answer equals this. */
  followUpWhen?: string
  followUpAnswerKey?: string
  followUpQuestion?: string
  followUpOptions?: string[]
  /** With `followUpWhen` + `followUpAnswerKey`, show a text area instead of `followUpOptions`. */
  followUpFreeText?: boolean
  /** Replace each `{{TOPIC}}` in `question` with the participant's answer from this page id. */
  questionTopicFromPageId?: string
}

/** Option A on product evaluation trust question — triggers browser-sandbox follow-up. */
const TRUST_OWN_METAL_OPTION =
  'The ability to run it on my own metal (complete control)'

const CREDIT_FOLLOWUP_ASSETS_PLACEHOLDER = '{{ASSETS}}'
const CREDIT_FOLLOWUP_OMITTED_PLACEHOLDER = '{{OMITTED_ASSETS}}'
const QUESTION_TOPIC_PLACEHOLDER = '{{TOPIC}}'

/** Wrap a whole overview paragraph in **double asterisks** to render it as a bold headline. */
function formatOverviewParagraphBody(trimmed: string): ReactNode {
  const m = /^\*\*(.+)\*\*$/.exec(trimmed)
  if (m) return <strong className="study-overview-headline">{m[1]}</strong>
  return trimmed
}

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
  if (page.questionTopicFromPageId) {
    const refId = page.questionTopicFromPageId
    const topic = answers[refId]?.trim()
    q = q.split(QUESTION_TOPIC_PLACEHOLDER).join(topic || 'your chosen topic')
  }
  return q
}

function isValidRankingOrder(order: unknown, rowIds: string[]): order is string[] {
  if (!Array.isArray(order) || order.length !== rowIds.length) return false
  if (!order.every((x): x is string => typeof x === 'string')) return false
  const set = new Set(order)
  return rowIds.every((id) => set.has(id)) && set.size === rowIds.length
}

function isValidRankingAnswer(raw: string | undefined, rowIds: string[]): boolean {
  if (!rowIds.length) return false
  try {
    return isValidRankingOrder(JSON.parse(raw || '[]') as unknown, rowIds)
  } catch {
    return false
  }
}

type RankingRowModel = { id: string; label: string }

function RankingQuestionBlock({
  page,
  answerRaw,
  onCommit
}: {
  page: StudyPage
  answerRaw: string | undefined
  onCommit: (orderedIds: string[]) => void
}) {
  const rows = page.rows!
  const rowIds = rows.map((r) => r.id)
  const byId = Object.fromEntries(rows.map((r) => [r.id, r])) as Record<string, RankingRowModel>

  let order: string[] = [...rowIds]
  try {
    const parsed = JSON.parse(answerRaw || '[]') as unknown
    if (isValidRankingOrder(parsed, rowIds)) order = parsed
  } catch {
    /* keep default */
  }
  const orderedRows = order.map((id) => byId[id]).filter(Boolean) as RankingRowModel[]
  const displayRows = orderedRows.length === rowIds.length ? orderedRows : rows

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const commitOrder = (next: string[]) => {
    onCommit(next)
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= displayRows.length) return
    const ids = displayRows.map((r) => r.id)
    const next = [...ids]
    const [removed] = next.splice(from, 1)
    next.splice(to, 0, removed)
    commitOrder(next)
  }

  const reorderByDrag = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const ids = displayRows.map((r) => r.id)
    const next = [...ids]
    const [removed] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, removed)
    commitOrder(next)
  }

  const handleDragStart = (e: DragEvent, rowId: string) => {
    e.dataTransfer.setData('text/plain', rowId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(rowId)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = (e: DragEvent) => {
    const related = e.relatedTarget as Node | null
    if (related && e.currentTarget.contains(related)) return
    setDragOverIndex(null)
  }

  const handleDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault()
    const dragId = e.dataTransfer.getData('text/plain')
    setDragOverIndex(null)
    setDraggingId(null)
    if (!dragId) return
    const ids = displayRows.map((r) => r.id)
    const fromIndex = ids.indexOf(dragId)
    if (fromIndex === -1) return
    reorderByDrag(fromIndex, dropIndex)
  }

  return (
    <div className="ranking-question">
      {page.instruction ? <p className="ranking-instruction">{page.instruction}</p> : null}
      <ul className="ranking-list">
        {displayRows.map((row, i) => (
          <li
            key={row.id}
            className={`ranking-row ${draggingId === row.id ? 'ranking-row--dragging' : ''} ${dragOverIndex === i && draggingId && draggingId !== row.id ? 'ranking-row--drop-target' : ''}`}
            onDragOver={(e) => handleDragOver(e, i)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, i)}
          >
            <span
              className="ranking-drag-handle"
              draggable
              onDragStart={(e) => handleDragStart(e, row.id)}
              onDragEnd={handleDragEnd}
              aria-label={`Drag to reorder: ${row.label}`}
              title="Drag to reorder"
            >
              <span className="ranking-drag-grip" aria-hidden>
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </span>
            </span>
            <span className="ranking-rank-badge" aria-hidden>
              {i + 1}
            </span>
            <span className="ranking-row-label">{row.label}</span>
            <div className="ranking-row-actions">
              <button
                type="button"
                className="ranking-move-button"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
                aria-label={`Move ${row.label} up in priority`}
              >
                Up
              </button>
              <button
                type="button"
                className="ranking-move-button"
                disabled={i === displayRows.length - 1}
                onClick={() => move(i, i + 1)}
                aria-label={`Move ${row.label} down in priority`}
              >
                Down
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function computeCanProceed(page: StudyPage | undefined, ans: Record<string, string>): boolean {
  if (!page) return false
  if (page.type === 'overview' || page.type === 'prototype') return true
  if (page.type === 'ranking' && page.rows?.length) {
    const ids = page.rows.map((r) => r.id)
    return isValidRankingAnswer(ans[page.id], ids)
  }
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
      {
        id: 'portable-intro',
        type: 'overview',
        question:
          "**Section 1: The portable My Red Hat**\n\nStop the tab-switching madness.\n\nHelp us decide what tools should follow you across every Red Hat site so you never lose your place."
      },
      {
        id: 'portable-prototype',
        type: 'prototype',
        question:
          'Explore the clickable prototype below. When you are ready, continue to the follow-up questions.',
        figmaEmbedUrl: ''
      },
      {
        id: 'portable-followup',
        type: 'text',
        question:
          'As you move between looking at documentation and managing your systems in the Console, is there one piece of data you find yourself constantly copying/pasting or switching tabs to check? What is it?'
      },
      {
        id: 'portable-sidekick',
        type: 'text',
        question:
          "If we gave you a 'persistent sidekick'—a small panel that stays on your screen everywhere you go on Red Hat sites—which 3 items (like active support cases, security CVEs, or specific product versions) would you pin to it?"
      },
      {
        id: 'portable-notifications',
        type: 'text',
        question:
          "If this 'sidekick' showed you a notification, would you want it to be a passive alert you check on your own time, or a proactive nudge that interrupts you for something critical? What type of notification content would be valuable (ex: security CVEs)?"
      },
      {
        id: 'gen-ai-intro',
        type: 'overview',
        question:
          "**Section 2: Generative and intelligent customization**\n\nTake the wheel or let AI drive?\n\nHelp us design a dashboard that builds itself around your actual workday."
      },
      {
        id: 'gen-ai-prototype',
        type: 'prototype',
        question:
          'Explore the clickable prototype below. When you are ready, continue to the follow-up questions.',
        figmaEmbedUrl: ''
      },
      {
        id: 'gen-ai-followup',
        type: 'text',
        question:
          "If you could 'prompt' this blank space to show you exactly what you need right now, what would you say? (e.g., 'Show me everything related to my OpenShift upgrade' or 'Build me a security health view'.)"
      },
      {
        id: 'gen-ai-layout',
        type: 'text',
        question:
          'When your needs change—like during an active system breach—do you want to manually drag-and-drop new components into place, or would you prefer the dashboard to automatically shift its layout to prioritize security data?'
      },
      {
        id: 'gen-ai-trust',
        type: 'text',
        question:
          "If an AI built a custom view for you, how would we earn your trust that the information is accurate? Would you need to see a 'Why was this shown?' explanation, or is the speed of the data more important?"
      },
      {
        id: 'proof-intro',
        type: 'overview',
        question:
          "**Section 3: Proof of subscription value lookback**\n\nMake your next renewal a breeze.\n\nHelp us design the ultimate 'Proof of Value' report that shows your boss exactly how much your team has achieved with Red Hat this year."
      },
      {
        id: 'proof-prototype',
        type: 'prototype',
        question:
          'Explore the clickable prototype below. When you are ready, continue to the follow-up questions.',
        figmaEmbedUrl: ''
      },
      {
        id: 'proof-followup',
        type: 'text',
        question:
          "If you could 'prompt' this blank space to show you exactly what you need right now, what would you say? (e.g., 'Show me everything related to my OpenShift upgrade' or 'Build me a security health view'.)"
      },
      {
        id: 'proof-layout',
        type: 'text',
        question:
          'When your needs change—like during an active system breach—do you want to manually drag-and-drop new components into place, or would you prefer the dashboard to automatically shift its layout to prioritize security data?'
      },
      {
        id: 'proof-trust',
        type: 'text',
        question:
          "If an AI built a custom view for you, how would we earn your trust that the information is accurate? Would you need to see a 'Why was this shown?' explanation, or is the speed of the data more important?"
      }
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
      {
        id: 'intro',
        type: 'overview',
        question:
          "In this study, when we say 'product within a portfolio,' we mean:\n\nFor Red Hat OpenShift, think 'Red Hat OpenShift Dedicated.'\n\nFor RHEL, think 'RHEL Server.'\n\nFor Red Hat Ansible Automation, think 'Red Hat Ansible Automation Platform on Microsoft Azure.'\n\nFor Red Hat AI, think 'Red Hat AI Inference Server.'"
      },
      {
        id: '1',
        type: 'multiple-choice',
        question:
          'With that context in mind, if you are looking for a specific product within a product portfolio, which menu label would you prefer them to be housed under?',
        options: ['Product editions', 'Product variants', 'Deployment options', 'Sub-products', 'Other'],
        followUpWhen: 'Other',
        followUpAnswerKey: '1-other',
        followUpFreeText: true,
        followUpQuestion: 'Please specify:'
      },
      {
        id: '2',
        type: 'buckets',
        question: 'Drag these items into the menu label where you would expect to find them:',
        instruction: '',
        options: ['Learn', 'Explore', 'Overview', 'Get started'],
        rows: [
          { id: 'product-news', label: 'Product news' },
          { id: 'relevant-articles-topics-blogs', label: 'Relevant articles, topics and blogs' },
          { id: 'product-use-cases', label: 'Product use cases' },
          { id: 'product-learning-hubs', label: 'Product learning hubs' },
          { id: 'product-training-certification', label: 'Product training & certification' },
          { id: 'product-interactive-walkthroughs', label: 'Product interactive walkthroughs' },
          { id: 'product-quickstarts', label: 'Product quickstarts' },
          { id: 'product-interactive-labs', label: 'Product interactive labs' },
          { id: 'customer-success-stories', label: 'Customer success stories' },
          { id: 'product-learning-paths', label: 'Product learning paths' },
          { id: 'persona-based-content', label: 'Persona-based content' },
          { id: 'product-trials', label: 'Product trials' },
          { id: 'product-sandbox-environments', label: 'Product sandbox environments' },
          { id: 'product-pricing', label: 'Product pricing' },
          { id: 'how-to-buy-pricing', label: 'How to buy/pricing' },
          { id: 'product-features', label: 'Product features' },
          { id: 'product-insights-reviews-testimonials', label: 'Product insights, reviews and testimonials' }
        ]
      },
      { id: '3', question: 'What challenges do you face when evaluating product information or making a purchase decision?', type: 'text' },
      { id: '4', question: 'What would make product marketing and buying information more useful for you?', type: 'text' }
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
      {
        id: '1',
        type: 'multiple-choice',
        placeholderImage: true,
        question:
          "Take a second to look at the 5 topics on this page. Choose the topic you're most interested in learning about.",
        options: ['AI', 'Virtualization', 'App Platforms', 'Automation', 'Linux Standardization']
      },
      {
        id: '2',
        type: 'multiple-choice',
        prototypePlaceholder: true,
        instruction: 'Select your choice on the screen.',
        question:
          'If you wanted to learn more about this topic, which additional piece of content are you most likely to choose?',
        options: [
          'Hands-on lab or sandbox',
          'Short video overview',
          'In-depth documentation',
          'Structured learning path or course',
          'Live webinar or workshop',
          'Code samples or reference architecture'
        ]
      },
      {
        id: '3',
        type: 'multiple-choice',
        question: 'Why did you pick this content offering?',
        options: ['Option 1', 'Option 2', 'Option 3', 'Other'],
        followUpWhen: 'Other',
        followUpAnswerKey: '3-other',
        followUpFreeText: true,
        followUpQuestion: 'Please specify:'
      },
      {
        id: '4',
        type: 'ranking',
        question:
          'Rank these factors based on how much they influence your initial choice of learning content.',
        instruction:
          'Please rank them in order of importance with 1 being the most important and 4 being less important.',
        rows: [
          { id: 'medium', label: "Medium (whether it's listening, reading, visual)" },
          { id: 'length', label: 'Length of content' },
          { id: 'title', label: 'Title' },
          { id: 'source', label: 'Source' }
        ]
      },
      {
        id: '5',
        type: 'ranking',
        questionTopicFromPageId: '1',
        question:
          "Please rank the following pieces of content based on which one you're most likely to choose when learning about {{TOPIC}}?",
        instruction:
          'Rank with 1 being the format you are most likely to choose first, and 3 the least.',
        rows: [
          { id: 'podcast', label: 'Example of Podcast episode' },
          { id: 'video', label: 'Example of Video' },
          { id: 'blog', label: 'Example of Blog article' }
        ]
      },
      {
        id: '5-follow',
        type: 'text',
        question: 'Why did you pick this content offering?'
      },
      {
        id: '6',
        type: 'text',
        question:
          "Are there any types of learning content that you didn't see today that you think is missing?"
      }
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

  // Default ranking order = definition order until the participant reorders
  useEffect(() => {
    if (currentPage?.type === 'ranking' && currentPage.rows?.length) {
      const pid = currentPage.id
      const ids = currentPage.rows.map((r) => r.id)
      setAnswers((prev) => {
        if (isValidRankingAnswer(prev[pid], ids)) return prev
        return { ...prev, [pid]: JSON.stringify(ids) }
      })
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
    if (page.type === 'overview' || page.type === 'prototype') {
      return overrides
    }
    if (page.type === 'text') {
      overrides[page.id] = '[skipped]'
    } else if (page.type === 'multiple-choice' && page.options?.length) {
      overrides[page.id] = page.options[0]
      if (page.followUpAnswerKey && page.followUpOptions?.length) {
        overrides[page.followUpAnswerKey] = page.followUpOptions[0]
      } else if (
        page.followUpAnswerKey &&
        page.followUpFreeText &&
        page.followUpWhen &&
        page.options[0] === page.followUpWhen
      ) {
        overrides[page.followUpAnswerKey] = '[skipped]'
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
    } else if (page.type === 'ranking' && page.rows?.length) {
      overrides[page.id] = JSON.stringify(page.rows.map((r) => r.id))
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
          {currentPage.imageSrc ? (
            <img
              src={currentPage.imageSrc}
              alt={currentPage.imageAlt ?? ''}
              className="study-page-hero-image"
            />
          ) : currentPage.placeholderImage ? (
            <div
              className="study-page-image-placeholder"
              role="img"
              aria-label="Illustration of the five learning topics (placeholder)"
            >
              <span className="study-page-image-placeholder-label">Image placeholder</span>
            </div>
          ) : currentPage.figmaEmbedAboveQuestion && currentPage.figmaEmbedUrl ? (
            <div className="figma-embed-wrap figma-embed-wrap--above">
              <iframe
                src={currentPage.figmaEmbedUrl}
                className="figma-embed"
                allowFullScreen
                title="Topic page prototype"
              />
            </div>
          ) : currentPage.prototypePlaceholder ? (
            <div
              className="study-page-prototype-placeholder"
              role="region"
              aria-label="Hybrid cloud topic page prototype with selectable learning content offerings"
            >
              <span className="study-page-prototype-placeholder-label">
                Hybrid cloud topic page prototype with selectable learning content offerings
              </span>
            </div>
          ) : null}

          {currentPage.type === 'overview' ? (
            <div className="study-overview" role="region" aria-label="Study introduction">
              {currentPage.question
                .split(/\n\n+/)
                .map((para) => para.trim())
                .filter(Boolean)
                .map((para, i) => (
                  <p key={i} className="study-overview-paragraph">
                    {formatOverviewParagraphBody(para)}
                  </p>
                ))}
            </div>
          ) : (
            <h2 className="page-question">{displayedQuestion}</h2>
          )}

          {currentPage.type === 'prototype' ? (
            currentPage.figmaEmbedUrl ? (
              <div className="figma-embed-wrap">
                <iframe
                  src={currentPage.figmaEmbedUrl}
                  className="figma-embed"
                  allowFullScreen
                  title="Clickable prototype"
                />
              </div>
            ) : (
              <div
                className="study-page-prototype-placeholder"
                role="region"
                aria-label="Prototype embed not configured yet"
              >
                <span className="study-page-prototype-placeholder-label">
                  Figma prototype — add the embed URL for this page when the embed is ready.
                </span>
              </div>
            )
          ) : (
            currentPage.figmaEmbedUrl &&
            !currentPage.figmaEmbedAboveQuestion && (
              <div className="figma-embed-wrap">
                <iframe
                  src={currentPage.figmaEmbedUrl}
                  className="figma-embed"
                  allowFullScreen
                  title="Figma prototype"
                />
              </div>
            )
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
              {currentPage.instruction && (
                <p className="multiple-choice-instruction">{currentPage.instruction}</p>
              )}
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
                currentPage.followUpAnswerKey &&
                currentPage.followUpFreeText && (
                  <div className="multiple-choice-other-follow">
                    {currentPage.followUpQuestion ? (
                      <p className="multiple-choice-other-follow-label">{currentPage.followUpQuestion}</p>
                    ) : null}
                    <textarea
                      className="text-input"
                      value={answers[currentPage.followUpAnswerKey] || ''}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [currentPage.followUpAnswerKey!]: e.target.value
                        }))
                      }
                      placeholder="Type your answer here..."
                      rows={4}
                      aria-label={currentPage.followUpQuestion || 'Other — please specify'}
                    />
                  </div>
                )}
              {currentPage.followUpWhen !== undefined &&
                answers[currentPage.id] === currentPage.followUpWhen &&
                currentPage.followUpQuestion &&
                currentPage.followUpOptions &&
                currentPage.followUpAnswerKey &&
                !currentPage.followUpFreeText && (
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

          {currentPage.type === 'ranking' && currentPage.rows && currentPage.rows.length >= 2 && (
            <RankingQuestionBlock
              page={currentPage}
              answerRaw={answers[currentPage.id]}
              onCommit={(ids) => handleAnswerChange(JSON.stringify(ids))}
            />
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

        <div
          className={`page-navigation${currentPage.type === 'overview' ? ' page-navigation--overview' : ''}`}
          ref={pageNavigationRef}
        >
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
