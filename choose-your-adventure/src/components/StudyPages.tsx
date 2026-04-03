import { useState, useEffect, useMemo, useRef, type DragEvent, type ReactNode } from 'react'
import './StudyPages.css'
import logoImage from '../images/Logo-Red_Hat-A-White-RGB.svg'
/** Swap for a PNG export of the live Ready to Buy dialog when you have it (keep the same import path or update the extension). */
import myTrialsReadyToBuyModalImage from '../images/my-trials-ready-to-buy-modal.svg'
import productMarketingContextImage from '../images/study-detail-visual-placeholder.svg'
import productMarketingQuestion6Visual from '../images/study-detail-visual-placeholder.svg'
import CompletionScreen from './CompletionScreen'
import LoadingScreen from './LoadingScreen'
import {
  confirmLeaveActiveStudy,
  registerBeforeUnloadIfInProgress
} from '../studyExitPrompt'

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
  /** After `overview` paragraphs: static image (e.g. production UI screenshot). */
  overviewAfterImageSrc?: string
  overviewAfterImageAlt?: string
  /** Shown in the prototype placeholder box (e.g. numbered resources matching on-screen labels). */
  prototypePlaceholderHint?: string
  /** When set with `figmaEmbedUrl`, render the iframe above the question instead of below. */
  figmaEmbedAboveQuestion?: boolean
  /** On `multiple-choice`: show follow-up when main answer equals this. */
  followUpWhen?: string
  followUpAnswerKey?: string
  followUpQuestion?: string
  followUpOptions?: string[]
  /** With `followUpWhen` + `followUpAnswerKey`, show a text area instead of `followUpOptions`. */
  followUpFreeText?: boolean
  /** With multiple-choice: always show this free-text field below options; both choice and text are required. */
  multiChoiceRequiredFreeTextKey?: string
  multiChoiceRequiredFreeTextLabel?: string
  /** Replace each `{{TOPIC}}` in `question` with the participant's answer from this page id. */
  questionTopicFromPageId?: string
  /** For multi-select: build options from another page's `options`, excluding `answers[excludePageId]` from that pick. */
  multiSelectOptionsFromPageId?: string
  /** Page id storing the single-choice answer to remove from the list. Defaults to `multiSelectOptionsFromPageId`. */
  multiSelectExcludeAnswerFromPageId?: string
  /** If false, 0..max selections allowed (default max = options length). If true (default), must pick exactly `maxSelections`. */
  multiSelectExactCount?: boolean
  /** With `multi-select` and non-exact count: minimum selections before **Next** is enabled (default 0). */
  multiSelectMinSelections?: number
  /** For `ranking`: first branch where `answers[rankingRowsBranchFromPageId]` includes a `matchAnyOf` substring. */
  rankingRowsBranchFromPageId?: string
  rankingRowBranches?: { matchAnyOf: string[]; rows: { id: string; label: string }[] }[]
  /** When no branch matches (e.g. unexpected prior answer). */
  rankingRowBranchesDefault?: { id: string; label: string }[]
  /** Optional free-text after ranking (e.g. specify what "Other" means). */
  rankingOtherAnswerKey?: string
  rankingOtherQuestion?: string
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

const OVERVIEW_BULLET_LINE = /^[-•]\s+(.+)$/

/** Paragraphs that are only `- item` / `• item` lines render as a bulleted list. */
function renderOverviewBlock(para: string, i: number): ReactNode {
  const trimmed = para.trim()
  const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean)
  if (
    lines.length > 0 &&
    lines.every((line) => OVERVIEW_BULLET_LINE.test(line))
  ) {
    const items = lines.map((line) => {
      const m = OVERVIEW_BULLET_LINE.exec(line)
      return m ? m[1] : line
    })
    return (
      <ul key={i} className="study-overview-list">
        {items.map((item, j) => (
          <li key={j} className="study-overview-list-item">
            {formatOverviewParagraphBody(item)}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <p key={i} className="study-overview-paragraph">
      {formatOverviewParagraphBody(trimmed)}
    </p>
  )
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
  instruction,
  rows,
  answerRaw,
  onCommit
}: {
  instruction?: string
  rows: RankingRowModel[]
  answerRaw: string | undefined
  onCommit: (orderedIds: string[]) => void
}) {
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
      {instruction ? <p className="ranking-instruction">{instruction}</p> : null}
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

function getBranchedRankingRows(
  page: StudyPage,
  answers: Record<string, string>
): { id: string; label: string }[] | undefined {
  if (!page.rankingRowsBranchFromPageId || !page.rankingRowBranches?.length) {
    return page.rows
  }
  const prior = answers[page.rankingRowsBranchFromPageId]?.trim() ?? ''
  for (const b of page.rankingRowBranches) {
    if (b.matchAnyOf.some((m) => prior.includes(m))) return b.rows
  }
  return page.rankingRowBranchesDefault ?? page.rankingRowBranches[page.rankingRowBranches.length - 1]?.rows
}

function getDerivedMultiSelectOptions(
  page: StudyPage,
  allPages: StudyPage[],
  answers: Record<string, string>
): string[] | undefined {
  if (!page.multiSelectOptionsFromPageId) return page.options
  const src = allPages.find((p) => p.id === page.multiSelectOptionsFromPageId)
  const base = src?.options
  if (!base?.length) return page.options
  const exId = page.multiSelectExcludeAnswerFromPageId ?? page.multiSelectOptionsFromPageId
  const chosen = answers[exId]?.trim()
  if (!chosen) return [...base]
  return base.filter((o) => o !== chosen)
}

function computeCanProceed(
  page: StudyPage | undefined,
  ans: Record<string, string>,
  allPages: StudyPage[]
): boolean {
  if (!page) return false
  if (page.type === 'overview' || page.type === 'prototype') return true
  if (page.type === 'ranking') {
    const rows = getBranchedRankingRows(page, ans) ?? page.rows
    if (!rows?.length) return false
    const ids = rows.map((r) => r.id)
    return isValidRankingAnswer(ans[page.id], ids)
  }
  if ((page.type === 'matrix' || page.type === 'buckets') && page.rows) {
    return page.rows.every(
      row => ans[`${page.id}:${row.id}`] && ans[`${page.id}:${row.id}`].trim() !== ''
    )
  }
  if (page.type === 'multi-select') {
    const options = getDerivedMultiSelectOptions(page, allPages, ans) ?? page.options ?? []
    const exact = page.multiSelectExactCount !== false
    if (options.length === 0) return true
    let selected: string[]
    try {
      const raw = ans[page.id]
      if (raw === undefined || raw === '') {
        if (exact) return false
        selected = []
      } else {
        selected = JSON.parse(raw) as string[]
      }
      if (!Array.isArray(selected)) return false
      if (!selected.every((s) => typeof s === 'string' && (options as string[]).includes(s))) return false
      if (exact) {
        if (page.maxSelections == null) return false
        return selected.length === page.maxSelections
      }
      const minSel = page.multiSelectMinSelections ?? 0
      if (selected.length < minSel) return false
      const cap = page.maxSelections ?? options.length
      return selected.length <= cap
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
  if (page.type === 'multiple-choice') {
    const main = ans[page.id]
    if (!main?.trim()) return false
    if (page.multiChoiceRequiredFreeTextKey) {
      if (!ans[page.multiChoiceRequiredFreeTextKey]?.trim()) return false
    }
    if (page.followUpWhen !== undefined && page.followUpAnswerKey) {
      if (main === page.followUpWhen) {
        return !!ans[page.followUpAnswerKey]?.trim()
      }
    }
    return true
  }
  return !!(ans[page.id] && ans[page.id].trim() !== '')
}

const STUDY_DISPLAY_NAME: Record<string, string> = {
  'product-evaluation': 'Build your dream trial',
  'trying-products': 'Build your dream trial',
  'user-preferences': 'Personalize your Red Hat',
  'developer-program': 'Shape the Developer program',
  'developer-for-business': 'Shape the Developer program',
  'my-red-hat': 'Refine your intelligent dashboard',
  dashboard: 'Refine your intelligent dashboard',
  'my-trials': 'From testing to buying',
  'product-marketing': 'Improve our product navigation',
  'buying-products': 'Improve our product navigation',
  'content-discovery': 'How do you learn best?'
}

/** Pulled out so `type` + `options` cannot be dropped or merged incorrectly inside the big pages map. */
const MY_TRIALS_PAGE_READY_TO_BUY_EXPECT: StudyPage = {
  id: '2',
  type: 'multi-select',
  instruction:
    'Select all that apply — tap each outcome you would reasonably expect might happen next (you can choose more than one).',
  question:
    "Be honest: When you click a button labeled 'Ready to Buy,' what do you expect to happen next?",
  options: [
    'A) I expect to enter a credit card or PO number immediately.',
    "B) I expect to generate a price quote to get my boss's approval.",
    'C) I expect to notify my Red Hat Rep or Partner.'
  ],
  multiSelectExactCount: false,
  maxSelections: 3,
  multiSelectMinSelections: 1
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
        figmaEmbedUrl:
          'https://embed.figma.com/proto/LHgDJjj80waVYdJCskxasF/My-Red-Hat---Dashboard-customization?node-id=1011-90920&embed-host=summit-research&scaling=scale-down-width&content-scaling=fixed'
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
        id: 'pm-context',
        type: 'overview',
        overviewAfterImageSrc: productMarketingContextImage,
        overviewAfterImageAlt:
          'Reference diagram for secondary product navigation labels across OpenShift, RHEL, Ansible, and AI (placeholder).',
        question:
          "The Red Hat product experience is a massive ecosystem, but finding your way between products shouldn't feel like learning a new language every time.\n\nWe've noticed our secondary navigation for OpenShift, RHEL, Ansible, and AI use inconsistent menu labels for similar content types that we would like your feedback on.\n\nIn the next 3 minutes, you'll help us standardize our secondary product navigation by picking, sorting and ranking the terms that make the most sense to you. Your feedback will directly influence how we organize our secondary product navigation.\n\nReview the image below. When you are finished, select Next to continue."
      },
      {
        id: 'intro',
        type: 'overview',
        question:
          "In this study, when we say 'product within a portfolio,' we mean:\n\n- For Red Hat OpenShift, think 'Red Hat OpenShift Dedicated.'\n- For RHEL, think 'RHEL Server.'\n- For Red Hat Ansible Automation, think 'Red Hat Ansible Automation Platform on Microsoft Azure.'\n- For Red Hat AI, think 'Red Hat AI Inference Server.'"
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
      {
        id: '3',
        type: 'ranking',
        question:
          'Rank these menu items in order of importance, ranking 1 as the most important and ranking 9 as the least important:',
        rows: [
          { id: 'pm-doc', label: 'Documentation' },
          { id: 'pm-explore', label: 'Further exploration' },
          { id: 'pm-overview', label: 'Product overview information' },
          { id: 'pm-pricing', label: 'Pricing/Subscription options' },
          { id: 'pm-trials', label: 'Trials' },
          { id: 'pm-use-cases', label: 'Use cases' },
          { id: 'pm-portfolio', label: 'Product within portfolio options' },
          { id: 'pm-integrations', label: 'Product integrations' },
          { id: 'pm-partners', label: 'Information on partners' }
        ]
      },
      {
        id: '4',
        type: 'multiple-choice',
        question: 'If you could remove a menu item option, which would it be and why?',
        options: [
          'Documentation',
          'Explore',
          'Overview',
          'Pricing/Subscription options',
          'Trials',
          'Use cases',
          'Product within portfolio options',
          'Integrations',
          'Partners'
        ],
        multiChoiceRequiredFreeTextKey: '4-why',
        multiChoiceRequiredFreeTextLabel: 'Why would you remove it? Please explain.'
      },
      {
        id: '5',
        type: 'multiple-choice',
        question:
          "Do you expect the menu item labels to be consistent across each product's secondary navigation menu? Please explain the reasoning behind your answer.",
        options: ['Yes', 'No'],
        multiChoiceRequiredFreeTextKey: '5-consistency-why',
        multiChoiceRequiredFreeTextLabel: 'Your explanation:'
      },
      {
        id: '6',
        type: 'multiple-choice',
        imageSrc: productMarketingQuestion6Visual,
        imageAlt:
          "Red Hat AI secondary navigation example showing Products & documentation as one menu item (replace with final screenshot).",
        question:
          "In the Red Hat AI navigation menu example, it consolidates 'Products & documentation' into one menu item. Would you prefer this consolidation across all product secondary navigation menus? Please explain the reasoning behind your answer.",
        options: ['Yes', 'No'],
        multiChoiceRequiredFreeTextKey: '6-consolidation-why',
        multiChoiceRequiredFreeTextLabel: 'Your explanation:'
      },
      {
        id: '7',
        type: 'text',
        question:
          'If you could add a menu item option, which would it be and why? What content types would fall under this menu item label?'
      }
    ],
    'developer-program': [
      {
        id: 'intro',
        type: 'overview',
        question:
          "We are updating our developer and trial programs and would love your input to better understand your learning and evaluation needs. As a person interested in trying out a Red Hat product, review the landing page on the next screen and verbally share your thoughts as you visually explore the page. Let us know what you are thinking, questions you have, expectations, things that don't make sense, things that do. Any free flowing thoughts that come to mind as you explore the page."
      },
      {
        id: 'landing-prototype',
        type: 'prototype',
        question:
          'Explore the clickable Figma prototype below (the landing page from the introduction). When you are done exploring, select Next to continue.',
        figmaEmbedUrl: ''
      },
      { id: '1', question: 'Which parts of the Red Hat Developer program or tools do you use today?', type: 'multiple-choice', options: ['OpenShift', 'RHEL', 'Ansible', 'Quay', 'Buildah/Podman', 'Developer portal / sandbox', 'Other'] },
      { id: '2', question: 'How do Red Hat developer resources support your work?', type: 'text' },
      { id: '3', question: 'What would make the developer program more valuable for you?', type: 'text' }
    ],
    'my-trials': [
      {
        id: 'intro',
        type: 'overview',
        overviewAfterImageSrc: myTrialsReadyToBuyModalImage,
        overviewAfterImageAlt:
          'Screenshot of the current Ready to Buy dialog in the product, showing the buying options as they appear today.',
        question:
          "Right now, when you finish a product trial and click 'Ready to Buy,' you see the dialog below—this is the current experience in the live product.\n\nHowever, our data shows the majority of users close this window without clicking anything. Help us understand why."
      },
      {
        id: '1',
        type: 'multiple-choice',
        question:
          'You are nearing the end of a product trial and want to keep using the software. Which button are you more likely to click to figure out your options?',
        options: [
          'A) Ready to Buy (I know exactly what I want and have the budget).',
          "B) What's Next? / Explore Next Steps (I need to see my options, talk to my team, or check my contract first).",
          'C) Contact Sales (I just want to talk to a human to sort it out).'
        ]
      },
      MY_TRIALS_PAGE_READY_TO_BUY_EXPECT,
      {
        id: '3',
        type: 'multiple-choice',
        question:
          'Look at the multiple buying options on the screen. If you closed this menu without clicking anything, what is your most likely reason?',
        options: [
          "A) I don't know which option applies to my company's contract.",
          'B) I need to secure an internal budget/approval first.',
          'C) I wanted to see transparent pricing without talking to Sales.',
          "D) I'm afraid of messing up my existing account terms.",
          'E) I want to buy online through digital commerce options.'
        ]
      },
      {
        id: '4',
        type: 'ranking',
        question:
          'We are redesigning this menu to make it easier. Rank these 5 proposed updates from Most Useful (1) to Least Useful (5):',
        instruction:
          'Drag rows or use Up/Down to order. 1 = most useful, 5 = least useful among these five.',
        rows: [
          {
            id: 'mt-rank-rename-btn',
            label:
              'Rename the button to "View Buying Options" so it\'s clear I\'m not checking out today.'
          },
          {
            id: 'mt-rank-best-for',
            label:
              'Add short "Best for…" descriptions under each option to better guide next steps (e.g., Marketplace: Best for AWS budgets).'
          },
          {
            id: 'mt-rank-recommended-path',
            label:
              'A Recommended Path badge showing how my company usually buys Red Hat software.'
          },
          {
            id: 'mt-rank-notify-team',
            label:
              'A Notify My Account Team button to have my rep reach out with options.'
          },
          {
            id: 'mt-rank-share-summary',
            label:
              'A Share Trial Summary button to email my thoughts and next steps to my manager.'
          }
        ]
      }
    ],
    'content-discovery': [
      {
        id: 'intro',
        type: 'overview',
        question:
          "**Thanks for taking part.**\n\nWe want to understand how you prefer to learn about technology topics you care about—which formats you notice first, and what drives those choices.\n\nOver the next few screens you'll pick a topic, choose and rank different types of learning content, and share a bit of context in your own words. Your answers help us make topical learning more useful on our sites."
      },
      {
        id: '1',
        type: 'multiple-choice',
        placeholderImage: true,
        question:
          'These topics are examples of areas people come to learn about. Which one are you most interested in exploring right now?',
        options: ['AI', 'Virtualization', 'App platforms', 'Automation', 'Linux standardization']
      },
      {
        id: '2',
        type: 'multiple-choice',
        prototypePlaceholder: true,
        prototypePlaceholderHint:
          'On screen, resources are numbered: 1 Video · 2 Blog article · 3 E-book · 4 Event · 5 Technical use case · 6 Whitepaper',
        questionTopicFromPageId: '1',
        question:
          'Great! So you want to learn more about {{TOPIC}}. Which additional resource are you most likely to choose next to learn more? Select the corresponding number of the resource on the screen.',
        options: [
          '1. Video',
          '2. Blog article',
          '3. E-book',
          '4. Event',
          '5. Technical Use Case',
          '6. Whitepaper'
        ]
      },
      {
        id: '3',
        type: 'text',
        question: 'Follow-up question: Why did you pick this content offering?'
      },
      {
        id: '4',
        type: 'multi-select',
        placeholderImage: true,
        question:
          'Are you also interested in any of the other offerings? If so, select all the other ones you would be interested in. Select the corresponding number of the resource on the screen.',
        instruction: 'Optional — choose any other numbered resources that interest you, or select none and continue.',
        multiSelectOptionsFromPageId: '2',
        multiSelectExcludeAnswerFromPageId: '2',
        multiSelectExactCount: false
      },
      {
        id: '5',
        type: 'ranking',
        question:
          'Rank the following factors based on how much they influence your choice of learning content.',
        instruction:
          'Please rank them in order of importance with 1 being the most important and 4 being the least important.',
        rankingRowsBranchFromPageId: '2',
        rankingRowBranches: [
          {
            matchAnyOf: ['Blog article'],
            rows: [
              { id: 'cd-blog-read-time', label: 'Predicted read time' },
              { id: 'cd-blog-title', label: 'Title of article' },
              { id: 'cd-blog-author', label: 'Author of article' },
              { id: 'cd-blog-preview', label: 'Preview of content' }
            ]
          },
          {
            matchAnyOf: ['E-book', 'Technical Use Case', 'Whitepaper'],
            rows: [
              { id: 'cd-ebook-title', label: 'Title of resource' },
              { id: 'cd-ebook-summary', label: 'Summary of content' },
              { id: 'cd-ebook-depth', label: 'Perceived depth of content' },
              { id: 'cd-ebook-thumb', label: 'Thumbnail' }
            ]
          },
          {
            matchAnyOf: ['Video', 'Podcast', 'Event'],
            rows: [
              { id: 'cd-av-length', label: 'Length of video/audio' },
              { id: 'cd-av-title', label: 'Title' },
              { id: 'cd-av-summary', label: 'Summary of content' },
              { id: 'cd-av-thumb', label: 'Thumbnail' }
            ]
          }
        ],
        rankingRowBranchesDefault: [
          { id: 'cd-def-length', label: 'Length of video/audio' },
          { id: 'cd-def-title', label: 'Title' },
          { id: 'cd-def-summary', label: 'Summary of content' },
          { id: 'cd-def-thumb', label: 'Thumbnail' }
        ]
      },
      {
        id: '6',
        type: 'ranking',
        questionTopicFromPageId: '1',
        question:
          'For {{TOPIC}}, rank these content types by which you are most likely to choose first when learning about the topic.',
        instruction:
          '1 = most likely to choose first; 6 = least likely among these six.',
        rows: [
          { id: 'cd-ctype-short-video', label: 'A short video (less than 5 min)' },
          { id: 'cd-ctype-long-video', label: 'A longer, in-depth video (longer than 5 min)' },
          { id: 'cd-ctype-podcast', label: 'A podcast episode' },
          { id: 'cd-ctype-ebook', label: 'An e-book' },
          { id: 'cd-ctype-article', label: 'An article' },
          { id: 'cd-ctype-case-study', label: 'A customer case study' }
        ]
      },
      {
        id: '7',
        type: 'multiple-choice',
        question:
          "Are there any types of learning content that you didn't see today that you would like to see offered?",
        options: ['Yes', 'No'],
        followUpWhen: 'Yes',
        followUpAnswerKey: '7-yes-detail',
        followUpFreeText: true,
        followUpQuestion:
          'What other content offerings would you like to see? (We greatly appreciate specificity!)'
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

  const rankingBranchSourceAnswer =
    currentPage?.type === 'ranking' && currentPage.rankingRowsBranchFromPageId
      ? answers[currentPage.rankingRowsBranchFromPageId]
      : undefined

  // Default ranking order = definition order until the participant reorders
  useEffect(() => {
    if (currentPage?.type !== 'ranking') return
    const rows = getBranchedRankingRows(currentPage, answers) ?? currentPage.rows
    if (!rows?.length) return
    const pid = currentPage.id
    const ids = rows.map((r) => r.id)
    setAnswers((prev) => {
      if (isValidRankingAnswer(prev[pid], ids)) return prev
      return { ...prev, [pid]: JSON.stringify(ids) }
    })
  }, [currentPage?.id, currentPage?.type, rankingBranchSourceAnswer, studyPages])

  // Optional multi-select: default to empty selection so Next works with zero picks
  useEffect(() => {
    if (currentPage?.type !== 'multi-select' || currentPage.multiSelectExactCount !== false) return
    setAnswers((prev) => {
      if (prev[currentPage.id] !== undefined) return prev
      return { ...prev, [currentPage.id]: '[]' }
    })
  }, [currentPage?.id, currentPage?.type, currentPage?.multiSelectExactCount])

  const derivedMultiSelectOptions = useMemo(() => {
    const p = studyPages[currentPageIndex]
    if (p?.type !== 'multi-select') return undefined
    return getDerivedMultiSelectOptions(p, studyPages, answers) ?? []
  }, [currentPageIndex, studyPages, answers])

  const rankingRowsResolved = useMemo(() => {
    const p = studyPages[currentPageIndex]
    if (p?.type !== 'ranking') return undefined
    return getBranchedRankingRows(p, answers) ?? p.rows
  }, [currentPageIndex, studyPages, answers])

  const isLastPage = studyPages.length > 0 && currentPageIndex === studyPages.length - 1
  const isFirstPage = currentPageIndex === 0

  const pastSubmittedOrCompleting = showCompletion || isLoadingCompletion
  const studyHasUnsavedProgress =
    !pastSubmittedOrCompleting &&
    (currentPageIndex > 0 || Object.keys(answers).length > 0)

  useEffect(() => {
    return registerBeforeUnloadIfInProgress(studyHasUnsavedProgress)
  }, [studyHasUnsavedProgress])

  const confirmBackToStudySelection = () => {
    if (!studyHasUnsavedProgress || confirmLeaveActiveStudy()) {
      onBack()
    }
  }

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
      if (page.multiChoiceRequiredFreeTextKey) {
        overrides[page.multiChoiceRequiredFreeTextKey] = '[skipped]'
      }
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
    } else if (page.type === 'multi-select' && page.multiSelectExactCount === false) {
      const min = page.multiSelectMinSelections ?? 0
      if (min > 0 && page.options?.length) {
        overrides[page.id] = JSON.stringify(page.options.slice(0, Math.min(min, page.options.length)))
      } else {
        overrides[page.id] = '[]'
      }
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
    } else if (page.type === 'ranking') {
      const rows = getBranchedRankingRows(page, answers) ?? page.rows
      if (rows?.length) {
        overrides[page.id] = JSON.stringify(rows.map((r) => r.id))
        if (page.rankingOtherAnswerKey) {
          overrides[page.rankingOtherAnswerKey] = '[skipped]'
        }
      }
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

  const canProceed = () => computeCanProceed(currentPage, answers, studyPages)

  useEffect(() => {
    prevCanProceedRef.current = null
  }, [currentPageIndex])

  useEffect(() => {
    const page = studyPages[currentPageIndex]
    if (!page) return
    const ok = computeCanProceed(page, answers, studyPages)
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
          <button type="button" className="back-button" onClick={confirmBackToStudySelection}>
            Back to study selection
          </button>
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
          <button type="button" className="back-button" onClick={confirmBackToStudySelection}>
            Back to study selection
          </button>
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
        <button type="button" className="back-button" onClick={confirmBackToStudySelection}>
          Back to study selection
        </button>
      </div>

      <div className="study-content">
        <div className="page-indicator">
          <span className="study-track-name">Current study: {studyTitle}</span>
          <span className="page-indicator-count">
            Page {currentPageIndex + 1} of {studyPages.length}
          </span>
        </div>

        <div
          className="page-content"
          key={`study-page-${currentPageIndex}-${currentPage.id}`}
        >
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
              aria-label="Illustration placeholder for example learning topics (AI, virtualization, and similar)"
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
              aria-label={
                [
                  answers['1']?.trim() && `${answers['1'].trim()} topic page preview`,
                  currentPage.prototypePlaceholderHint,
                  !currentPage.prototypePlaceholderHint &&
                    (answers['1']?.trim()
                      ? 'selectable learning content'
                      : 'Topic page preview with selectable learning content')
                ]
                  .filter(Boolean)
                  .join('. ')
              }
            >
              <span className="study-page-prototype-placeholder-label">
                {answers['1']?.trim() && `${answers['1'].trim()} — `}
                {currentPage.prototypePlaceholderHint ??
                  'topic page preview (selectable learning content)'}
              </span>
            </div>
          ) : null}

          {currentPage.type === 'overview' ? (
            <>
              <div className="study-overview" role="region" aria-label="Study introduction">
                {currentPage.question
                  .split(/\n\n+/)
                  .map((para) => para.trim())
                  .filter(Boolean)
                  .map((para, i) => renderOverviewBlock(para, i))}
              </div>
              {currentPage.overviewAfterImageSrc && (
                <figure className="study-overview-after-image-wrap">
                  <img
                    src={currentPage.overviewAfterImageSrc}
                    alt={currentPage.overviewAfterImageAlt ?? ''}
                    className="study-overview-after-image"
                  />
                </figure>
              )}
            </>
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
                {currentPage.options.map((option, optIndex) => (
                  <button
                    key={`${currentPage.id}-opt-${optIndex}`}
                    type="button"
                    className={`option-button ${answers[currentPage.id] === option ? 'selected' : ''}`}
                    onClick={() => handleAnswerChange(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {currentPage.multiChoiceRequiredFreeTextKey &&
                currentPage.multiChoiceRequiredFreeTextLabel && (
                  <div className="multiple-choice-other-follow">
                    <p className="multiple-choice-other-follow-label">
                      {currentPage.multiChoiceRequiredFreeTextLabel}
                    </p>
                    <textarea
                      className="text-input"
                      value={answers[currentPage.multiChoiceRequiredFreeTextKey] || ''}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [currentPage.multiChoiceRequiredFreeTextKey!]: e.target.value
                        }))
                      }
                      placeholder="Type your explanation here..."
                      rows={4}
                      aria-label={currentPage.multiChoiceRequiredFreeTextLabel}
                    />
                  </div>
                )}
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

          {currentPage.type === 'multi-select' &&
            (() => {
              const opts: string[] =
                currentPage.multiSelectOptionsFromPageId != null
                  ? (derivedMultiSelectOptions ?? [])
                  : (currentPage.options ?? [])
              const exact = currentPage.multiSelectExactCount !== false
              const cap = currentPage.maxSelections ?? opts.length
              if (opts.length === 0) {
                return (
                  <p className="multi-select-instruction" role="status">
                    There are no other resources to select on this screen.
                  </p>
                )
              }
              return (
            <div className="multi-select-question">
              {currentPage.instruction && (
                <p className="multi-select-instruction">{currentPage.instruction}</p>
              )}
              <div className="multi-select-options">
                {opts.map((option) => {
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
                  const canSelect = selected || selectedCount < cap
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
              {exact && currentPage.maxSelections != null ? (
                <p className="multi-select-count">
                  {((): number => {
                    try { return (JSON.parse(answers[currentPage.id] || '[]') as string[]).length }
                    catch { return 0 }
                  })()}
                  /{currentPage.maxSelections} selected
                </p>
              ) : (
                <p className="multi-select-count">
                  {((): number => {
                    try { return (JSON.parse(answers[currentPage.id] || '[]') as string[]).length }
                    catch { return 0 }
                  })()}
                  {currentPage.multiSelectMinSelections != null && currentPage.multiSelectMinSelections > 0
                    ? ` selected — choose at least ${currentPage.multiSelectMinSelections} to continue`
                    : ' selected — optional'}
                </p>
              )}
            </div>
              )
            })()}

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

          {currentPage.type === 'ranking' &&
            rankingRowsResolved &&
            rankingRowsResolved.length >= 2 && (
            <>
              <RankingQuestionBlock
                instruction={currentPage.instruction}
                rows={rankingRowsResolved}
                answerRaw={answers[currentPage.id]}
                onCommit={(ids) => handleAnswerChange(JSON.stringify(ids))}
              />
              {currentPage.rankingOtherAnswerKey && currentPage.rankingOtherQuestion ? (
                <div className="study-ranking-other-followup">
                  <label className="study-ranking-other-label" htmlFor={`ranking-other-${currentPage.id}`}>
                    {currentPage.rankingOtherQuestion}
                  </label>
                  <textarea
                    id={`ranking-other-${currentPage.id}`}
                    className="text-input study-ranking-other-textarea"
                    rows={3}
                    placeholder="Type here if relevant…"
                    value={answers[currentPage.rankingOtherAnswerKey] ?? ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [currentPage.rankingOtherAnswerKey!]: e.target.value
                      }))
                    }
                  />
                </div>
              ) : null}
            </>
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
