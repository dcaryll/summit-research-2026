import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type DragEvent,
  type ReactNode
} from 'react'
import './StudyPages.css'
import { studyLogo } from '../studyBrand'
import myTrialsReadyToBuyDialogSingle from '../images/my-trials-ready-to-buy-dialog-single-option.png'
import myTrialsReadyToBuyDialogThreeOptions from '../images/my-trials-ready-to-buy-dialog-three-options.png'
import productMarketingSecondaryNavImage from '../images/product-secondary-nav.webp'
import productMarketingSecondaryNavCommonItems from '../images/product-secondary-nav-common-items.webp'
import contentDiscoveryQ1TopicCards from '../images/content-discovery-q1-topic-cards.png'
import contentDiscoveryQ2Ai from '../images/content-discovery-q2-ai.png'
import contentDiscoveryQ2AppPlatforms from '../images/content-discovery-q2-app-platforms.png'
import contentDiscoveryQ2Automation from '../images/content-discovery-q2-automation.png'
import contentDiscoveryQ2LinuxStandardization from '../images/content-discovery-q2-linux-standardization.png'
import contentDiscoveryQ2Virtualization from '../images/content-discovery-q2-virtualization.png'
import developerStudyTiersImage from '../images/developer-study-tiers.png'
import developerStudyRegistrationIndividuals from '../images/developer-study-registration-individuals.png'
import developerStudyRegistrationBusinesses from '../images/developer-study-registration-businesses.png'
import CompletionScreen from './CompletionScreen'
import LoadingScreen from './LoadingScreen'
import {
  confirmLeaveActiveStudy,
  registerBeforeUnloadIfInProgress
} from '../studyExitPrompt'
import { studyDisplayName } from '../studyDisplayNames'

/** Developer program block 2: registration screenshot from answer on `b1-q1` (keys match option labels). */
const DEVELOPER_PROGRAM_SIGNUP_FLOW_HERO_BY_PROGRAM: Record<string, string> = {
  'Developer for individuals': developerStudyRegistrationIndividuals,
  'Developer for businesses': developerStudyRegistrationBusinesses,
  /** Legacy / alternate casing from older copy */
  'Developer for Individuals': developerStudyRegistrationIndividuals,
  'Developer for Businesses': developerStudyRegistrationBusinesses
}

const DEVELOPER_PROGRAM_SIGNUP_FLOW_HERO_ALT: Record<string, string> = {
  'Developer for individuals':
    'Registration form for Developer for Individuals: privacy notice, account fields, and required inputs.',
  'Developer for businesses':
    'Registration form for Developer for Businesses: steps and information required on screen.',
  'Developer for Individuals':
    'Registration form for Developer for Individuals: privacy notice, account fields, and required inputs.',
  'Developer for Businesses':
    'Registration form for Developer for Businesses: steps and information required on screen.'
}

/** Content discovery Q2/Q4: topic-page screenshot keyed by exact answer from question 1. */
const CONTENT_DISCOVERY_Q2_HERO_BY_TOPIC: Record<string, string> = {
  AI: contentDiscoveryQ2Ai,
  Virtualization: contentDiscoveryQ2Virtualization,
  /** Matches Q1 option label; legacy alias for older sessions / copy */
  'Application development': contentDiscoveryQ2AppPlatforms,
  'App platforms': contentDiscoveryQ2AppPlatforms,
  Automation: contentDiscoveryQ2Automation,
  'Linux standardization': contentDiscoveryQ2LinuxStandardization
}

const CONTENT_DISCOVERY_Q2_HERO_ALT_BY_TOPIC: Record<string, string> = {
  AI: 'Artificial intelligence topic page: Resources section with five numbered learning content cards (podcast, blog, e-book, event, use case).',
  Virtualization:
    'Virtualization topic page: Resources section with five numbered learning content cards (podcast, blog, e-book, event, use case).',
  'Application development':
    'Application development topic page: Resources section with five numbered learning content cards (podcast, blog, e-book, event, use case).',
  'App platforms':
    'Application development topic page: Resources section with five numbered learning content cards (podcast, blog, e-book, event, use case).',
  Automation:
    'Automation topic page: Resources section with five numbered learning content cards (podcast, blog, e-book, event, use case).',
  'Linux standardization':
    'Linux standardization topic page: Resources section with five numbered learning content cards (podcast, blog, e-book, event, use case).'
}

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
  /** `value-credits` only: short label above the card list (e.g. that cards are tappable). */
  valueCreditsListHeading?: string
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
  /** When set, reuse `figmaEmbedUrl` from the page with this id in the same study (keeps the prototype visible on follow-up steps). */
  figmaEmbedSourcePageId?: string
  /** On `prototype`: required open-text answer stored under this key. */
  prototypeOpenTextKey?: string
  /** Label above the prototype open-text field; use with `prototypeOpenTextKey`. */
  prototypeOpenTextLabel?: string
  /** Shown above the question; use with `imageAlt` for accessibility. */
  imageSrc?: string
  imageAlt?: string
  /**
   * Reuse imagery from the page with this id in the same study: `imageSrc` / `imageAlt`, or if
   * absent, `overviewAfterImageSrc` / `overviewAfterImageAlt`, or the first overview gallery image.
   */
  imageSourcePageId?: string
  /** Prior single-choice page id; hero image URL is `questionHeroImagesByPriorOption[answers[fromPageId]]`. */
  questionHeroImageFromPageId?: string
  questionHeroImagesByPriorOption?: Record<string, string>
  questionHeroImageAltsByPriorOption?: Record<string, string>
  /**
   * When a question hero is shown (direct, sourced, or branched): use a stacked layout with the
   * hero image first, then the question and optional `questionSubtext` (not the default image-above-question flow). Ignored for `overview` pages.
   */
  questionAboveHeroImage?: boolean
  /** Extra line under the question when `questionAboveHeroImage` is true (e.g. scroll instructions). */
  questionSubtext?: string
  /**
   * On `slider` (Likert) with `questionAboveHeroImage`: render the scale after the question/subtext
   * (still below the hero image in reading order).
   */
  sliderAboveHeroImage?: boolean
  /** Include this page in the flow only when `answers[priorPageId]` exactly equals `equals`. */
  visibleWhen?: { priorPageId: string; equals: string }
  /** Gray placeholder block when the final image is not ready yet. */
  placeholderImage?: boolean
  /** Topic-page style placeholder before the question (e.g. hybrid cloud prototype). */
  prototypePlaceholder?: boolean
  /** After `overview` paragraphs: static image (e.g. production UI screenshot). */
  overviewAfterImageSrc?: string
  overviewAfterImageAlt?: string
  /** When true, overview hero uses full width of the study content column (default caps at ~28rem). */
  overviewAfterImageFullWidth?: boolean
  /** After `overview` paragraphs: multiple images in a row; each opens the same lightbox as `overviewAfterImageSrc`. When non-empty, takes precedence over `overviewAfterImageSrc` for that page. */
  overviewAfterImageGallery?: { src: string; alt: string }[]
  /** Shown in the prototype placeholder box (e.g. numbered resources matching on-screen labels). */
  prototypePlaceholderHint?: string
  /** When set with `figmaEmbedUrl`, render the iframe above the question instead of below. */
  figmaEmbedAboveQuestion?: boolean
  /** On `multiple-choice` with a Figma embed: render the option list above the iframe. */
  multipleChoiceOptionsAboveEmbed?: boolean
  /** On `multiple-choice`: show follow-up when main answer equals this. */
  followUpWhen?: string
  followUpAnswerKey?: string
  followUpQuestion?: string
  followUpOptions?: string[]
  /** With `followUpWhen` + `followUpAnswerKey`, show a text area instead of `followUpOptions`. */
  followUpFreeText?: boolean
  /** With multiple-choice: always show this free-text field below options; both choice and text are required. */
  multiChoiceRequiredFreeTextKey?: string
  /** Label above the free-text field; use `{{SELECTED_OPTION}}` to insert the participant’s chosen option. */
  multiChoiceRequiredFreeTextLabel?: string
  /** Replace each `{{TOPIC}}` in `question` with the participant's answer from this page id. */
  questionTopicFromPageId?: string
  /**
   * Replace `{{CHOSEN}}` and `{{NOT_CHOSEN}}` in `question` using the participant's answer on that page
   * (expected: a prior `multiple-choice` with two options).
   */
  questionBinaryChoiceFromPageId?: string
  /** For multi-select: build options from another page's `options`, excluding `answers[excludePageId]` from that pick. */
  multiSelectOptionsFromPageId?: string
  /** Page id storing the single-choice answer to remove from the list. Defaults to `multiSelectOptionsFromPageId`. */
  multiSelectExcludeAnswerFromPageId?: string
  /** If false, 0..max selections allowed (default max = options length). If true (default), must pick exactly `maxSelections`. */
  multiSelectExactCount?: boolean
  /** With `multi-select` and non-exact count: minimum selections before **Next** is enabled (default 0). */
  multiSelectMinSelections?: number
  /** `multi-select` only: short label above the option list (e.g. that rows are tappable). */
  multiSelectListHeading?: string
  /** `multi-select` only: must match one entry in `options`; when selected, `multiSelectOtherFreeTextKey` is required. */
  multiSelectOtherOptionLabel?: string
  /** `multi-select` only: required write-in when `multiSelectOtherOptionLabel` is among the selections. */
  multiSelectOtherFreeTextKey?: string
  /** `multi-select` only: label above the Other write-in field. */
  multiSelectOtherFreeTextLabel?: string
  /** For `ranking`: first branch where `answers[rankingRowsBranchFromPageId]` includes a `matchAnyOf` substring. */
  rankingRowsBranchFromPageId?: string
  rankingRowBranches?: { matchAnyOf: string[]; rows: { id: string; label: string }[] }[]
  /** When no branch matches (e.g. unexpected prior answer). */
  rankingRowBranchesDefault?: { id: string; label: string }[]
  /** Optional free-text after ranking (e.g. specify what "Other" means). */
  rankingOtherAnswerKey?: string
  rankingOtherQuestion?: string
  /** `buckets` only: narrow left “Items to place” column; buckets on the right (2-wide row if two options, 2×2 if four). */
  bucketsSplitSidebar?: boolean
  /**
   * Pill above the question: Discussion (open feedback), Activity (on-screen tasks), Reflection (wrap-up).
   * When omitted, the tag is derived from page type and position (last study page → Reflection).
   */
  questionTag?: 'discussion' | 'activity' | 'reflection'
}

type QuestionTagKind = 'discussion' | 'activity' | 'reflection'

function pageCollectsOpenFeedback(page: StudyPage, answers: Record<string, string>): boolean {
  if (page.type === 'text') return true
  if (page.type === 'prototype' && page.prototypeOpenTextKey) return true
  if (page.type === 'multiple-choice') {
    if (page.multiChoiceRequiredFreeTextKey) return true
    if (
      page.followUpFreeText &&
      page.followUpWhen !== undefined &&
      answers[page.id] === page.followUpWhen
    ) {
      return true
    }
  }
  if (
    page.type === 'multi-select' &&
    page.multiSelectOtherFreeTextKey &&
    page.multiSelectOtherOptionLabel
  ) {
    try {
      const sel = JSON.parse(answers[page.id] || '[]') as string[]
      return Array.isArray(sel) && sel.includes(page.multiSelectOtherOptionLabel)
    } catch {
      return false
    }
  }
  if (page.type === 'ranking' && page.rankingOtherAnswerKey) return true
  return false
}

/** Overview pages omit the tag; otherwise every question page gets one category. */
function resolveQuestionTag(
  page: StudyPage,
  isLastStudyPage: boolean,
  answers: Record<string, string>
): QuestionTagKind | null {
  if (page.type === 'overview') return null
  if (page.questionTag) return page.questionTag
  if (isLastStudyPage) return 'reflection'
  if (pageCollectsOpenFeedback(page, answers)) return 'discussion'
  return 'activity'
}

function questionTagDisplayLabel(tag: QuestionTagKind): string {
  if (tag === 'discussion') return 'Discussion'
  if (tag === 'activity') return 'Prompt'
  return 'Reflection'
}

function resolveFigmaEmbedUrl(page: StudyPage, allPages: StudyPage[]): string | undefined {
  const sourceId = page.figmaEmbedSourcePageId
  if (sourceId) {
    return allPages.find((p) => p.id === sourceId)?.figmaEmbedUrl
  }
  return page.figmaEmbedUrl
}

function resolveImageHero(page: StudyPage, allPages: StudyPage[]): { src: string; alt: string } | null {
  const sid = page.imageSourcePageId
  if (sid) {
    const srcPage = allPages.find((p) => p.id === sid)
    if (srcPage) {
      if (srcPage.imageSrc) {
        return { src: srcPage.imageSrc, alt: srcPage.imageAlt ?? '' }
      }
      if (srcPage.overviewAfterImageSrc) {
        return { src: srcPage.overviewAfterImageSrc, alt: srcPage.overviewAfterImageAlt ?? '' }
      }
      const g = srcPage.overviewAfterImageGallery
      if (g?.length) {
        return { src: g[0].src, alt: g[0].alt ?? '' }
      }
    }
  }
  if (page.imageSrc != null && page.imageSrc !== '') {
    return { src: page.imageSrc, alt: page.imageAlt ?? '' }
  }
  return null
}

function resolveQuestionHeroImage(
  page: StudyPage,
  ans: Record<string, string>
): { src: string; alt: string } | null {
  const fromId = page.questionHeroImageFromPageId
  const map = page.questionHeroImagesByPriorOption
  if (!fromId || !map) return null
  const prior = ans[fromId]?.trim()
  if (!prior) return null
  const src = map[prior]
  if (!src) return null
  const alt =
    page.questionHeroImageAltsByPriorOption?.[prior] ??
    `${prior} topic page with numbered resource cards.`
  return { src, alt }
}

/** Option A on product evaluation trust question — triggers browser-sandbox follow-up. */
const TRUST_OWN_METAL_OPTION =
  'The ability to run it on my own metal (complete control)'

const CREDIT_FOLLOWUP_ASSETS_PLACEHOLDER = '{{ASSETS}}'
const CREDIT_FOLLOWUP_OMITTED_PLACEHOLDER = '{{OMITTED_ASSETS}}'
const QUESTION_TOPIC_PLACEHOLDER = '{{TOPIC}}'
const QUESTION_CHOSEN_PLACEHOLDER = '{{CHOSEN}}'
const QUESTION_NOT_CHOSEN_PLACEHOLDER = '{{NOT_CHOSEN}}'
const SELECTED_OPTION_PLACEHOLDER = '{{SELECTED_OPTION}}'

/** Open text is captured by a notetaker during moderated sessions (participant speaks aloud). */
const MODERATOR_OPEN_TEXT_PLACEHOLDER =
  'Notes'

/** ~30% fewer rows than original 6 / 4 / 3 defaults for moderator dock textareas. */
const MODERATOR_DOCK_TEXTAREA_ROWS = {
  large: Math.max(2, Math.round(6 * 0.7)),
  medium: Math.max(2, Math.round(4 * 0.7)),
  small: Math.max(2, Math.round(3 * 0.7))
} as const

function ModeratorNotesFieldLabel() {
  return <p className="moderator-notes-field-label">Moderator notes</p>
}

function textInputNoteFilledClass(value: string): string {
  return value.trim() ? ' text-input--note-filled' : ''
}

function moderatorDockTextareaClass(value: string): string {
  return `text-input text-input--moderator-dock${textInputNoteFilledClass(value)}`
}

function resolveMultiChoiceFreeTextLabel(label: string, mainAnswer: string | undefined): string {
  return label.split(SELECTED_OPTION_PLACEHOLDER).join(mainAnswer?.trim() || '…')
}

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

type BucketsBodyProps = {
  page: StudyPage
  answers: Record<string, string>
  splitSidebar: boolean
  onAssign: (bucket: string, rowId: string) => void
  onUnplace: (rowId: string) => void
}

function BucketDraggableItem({ row }: { row: { id: string; label: string } }) {
  return (
    <div
      className="bucket-item"
      draggable
      title="Drag into a bucket"
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', row.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <span className="bucket-item-drag-icon" aria-hidden="true">
        <span className="bucket-item-drag-grip">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </span>
      </span>
      <span className="bucket-item-text">{row.label}</span>
    </div>
  )
}

function BucketsBody({ page, answers, splitSidebar, onAssign, onUnplace }: BucketsBodyProps) {
  if (!page.rows?.length || !page.options?.length) return null

  const bucketNodes = page.options.map((bucket) => {
    const itemsInBucket = page.rows!.filter((row) => answers[`${page.id}:${row.id}`] === bucket)
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
          if (rowId) onAssign(bucket, rowId)
        }}
      >
        <div className="bucket-header">{bucket}</div>
        <div className="bucket-items">
          {itemsInBucket.map((row) => (
            <BucketDraggableItem key={row.id} row={row} />
          ))}
        </div>
      </div>
    )
  })

  const unplaced = (
    <div
      className={`bucket-unplaced${splitSidebar ? ' bucket-unplaced--sidebar' : ''}`}
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
        if (rowId) onUnplace(rowId)
      }}
    >
      <div className="bucket-header">Items to place</div>
      <div className="bucket-items">
        {page
          .rows!.filter((row) => !answers[`${page.id}:${row.id}`])
          .map((row) => (
            <BucketDraggableItem key={row.id} row={row} />
          ))}
      </div>
    </div>
  )

  if (splitSidebar) {
    const splitGridClass =
      page.options.length === 4
        ? 'buckets-container--split-2x2'
        : page.options.length === 2
          ? 'buckets-container--split-pair'
          : 'buckets-container--split-fallback'
    return (
      <div className="buckets-split">
        <div className="buckets-split-sidebar">{unplaced}</div>
        <div className="buckets-split-main">
          <div className={`buckets-container ${splitGridClass}`}>{bucketNodes}</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="buckets-container">{bucketNodes}</div>
      {unplaced}
    </>
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
  if (page.questionBinaryChoiceFromPageId) {
    const refId = page.questionBinaryChoiceFromPageId
    const refPage = allPages.find((p) => p.id === refId)
    const opts = refPage?.options
    const choice = answers[refId]?.trim()
    const chosen = choice || 'your chosen option'
    let notChosen = 'the other option'
    if (opts?.length && choice && opts.includes(choice)) {
      const others = opts.filter((o) => o !== choice)
      if (others.length === 1) notChosen = others[0]!
      else if (others.length > 1) notChosen = others.join(' or ')
    }
    q = q.split(QUESTION_CHOSEN_PLACEHOLDER).join(chosen)
    q = q.split(QUESTION_NOT_CHOSEN_PLACEHOLDER).join(notChosen)
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

/** Midpoint of the slider range — used for skip / dev tooling only (Likert UI has no default selection). */
function getSliderNeutralValue(page: Pick<StudyPage, 'sliderMin' | 'sliderMax'>): number {
  const lo = page.sliderMin ?? 1
  const hi = page.sliderMax ?? 5
  return Math.round((lo + hi) / 2)
}

/** Rows for Likert radio UI: numeric `value` stored in answers, human `label` shown beside each radio. */
function getSliderLikertOptions(
  page: Pick<StudyPage, 'sliderMin' | 'sliderMax' | 'sliderLabels' | 'sliderMinLabel' | 'sliderMaxLabel'>
): { value: string; label: string }[] {
  const lo = page.sliderMin ?? 1
  const hi = page.sliderMax ?? 5
  const labels = page.sliderLabels
  const count = hi - lo + 1
  const out: { value: string; label: string }[] = []
  for (let i = 0; i < count; i++) {
    const n = lo + i
    const fromList = labels?.[i]
    let label: string
    if (fromList != null && fromList !== '') {
      label = fromList
    } else if (n === lo && page.sliderMinLabel?.trim()) {
      label = page.sliderMinLabel.trim()
    } else if (n === hi && page.sliderMaxLabel?.trim()) {
      label = page.sliderMaxLabel.trim()
    } else {
      label = String(n)
    }
    out.push({ value: String(n), label })
  }
  return out
}

function computeCanProceed(
  page: StudyPage | undefined,
  ans: Record<string, string>,
  allPages: StudyPage[]
): boolean {
  if (!page) return false
  if (page.type === 'overview') return true
  if (page.type === 'prototype') {
    if (page.prototypeOpenTextKey) {
      return !!ans[page.prototypeOpenTextKey]?.trim()
    }
    return true
  }
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
        if (selected.length !== page.maxSelections) return false
        if (
          page.multiSelectOtherOptionLabel &&
          page.multiSelectOtherFreeTextKey &&
          selected.includes(page.multiSelectOtherOptionLabel) &&
          !ans[page.multiSelectOtherFreeTextKey]?.trim()
        ) {
          return false
        }
        return true
      }
      const minSel = page.multiSelectMinSelections ?? 0
      if (selected.length < minSel) return false
      const cap = page.maxSelections ?? options.length
      if (selected.length > cap) return false
      if (
        page.multiSelectOtherOptionLabel &&
        page.multiSelectOtherFreeTextKey &&
        selected.includes(page.multiSelectOtherOptionLabel) &&
        !ans[page.multiSelectOtherFreeTextKey]?.trim()
      ) {
        return false
      }
      return true
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

/** Pulled out so `type` + `options` cannot be dropped or merged incorrectly inside the big pages map. */
const MY_TRIALS_PAGE_READY_TO_BUY_EXPECT: StudyPage = {
  id: '2',
  type: 'multi-select',
  instruction:
    'Select all that apply — tap each outcome you would reasonably expect might happen next (you can choose more than one).',
  question:
    "When you click a button labeled 'Ready to buy,' what do you expect to happen next?",
  options: [
    'I expect to enter a credit card or PO number immediately.',
    "I expect to generate a price quote to get my boss's approval.",
    'I expect to notify my Red Hat Rep or Partner.'
  ],
  multiSelectExactCount: false,
  maxSelections: 3,
  multiSelectMinSelections: 1
}

function pagePassesVisibilityFilter(page: StudyPage, answers: Record<string, string>): boolean {
  const v = page.visibleWhen
  if (!v) return true
  return (answers[v.priorPageId]?.trim() ?? '') === v.equals
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
        id: '2',
        question: 'When you are tasked with evaluating a new piece of software, which of these sounds more like you?',
        type: 'multiple-choice',
        options: [
          "I want a browser-based sandbox or API-first environment. I want to see value in 5 minutes without installing anything.",
          "I want the binary. I want to run it on my own metal or local VM so I can see how it actually performs in a real environment."
        ]
      },
      {
        id: '4',
        question: 'When evaluating new tech, how do you prefer to get started?',
        type: 'multiple-choice',
        options: [
          'A blank slate — build from scratch',
          'An AI-generated template with most of the configuration done (~80%)'
        ]
      },
      {
        id: '5',
        question:
          "You have 10 value credits to spend. If you could design your perfect evaluation experience, which of these cards are non-negotiable for you? You can't buy them all, so choose the ones that move the needle most when evaluating the product.",
        type: 'value-credits',
        creditBudget: 10,
        valueCreditsListHeading: 'Selectable cards',
        instruction:
          'Tap or click a card to add it to your choices (tap again to remove it and free those credits).\n\nEach card costs credits; your total cannot exceed your budget. When a card is grayed out, adding it would put you over budget — remove another card first.',
        creditCards: [
          {
            id: 'full-product-download',
            label: 'Full product download',
            cost: 4,
            description: 'Local install, requires your own hardware.'
          },
          {
            id: 'guided-interactive-lab',
            label: 'Guided interactive lab',
            cost: 4,
            description: 'In-browser, pre-configured environment.'
          },
          {
            id: 'developer-sandbox',
            label: 'Developer sandbox',
            cost: 3,
            description: 'Open-ended, API-access, cloud-hosted.'
          },
          {
            id: 'human-in-the-loop',
            label: 'Human support',
            cost: 3,
            description: 'Access to a SE/Architect during trial.'
          },
          {
            id: 'ai-evaluation-assistant',
            label: 'AI evaluation assistant',
            cost: 3,
            description:
              'Specialized LLM trained on Red Hat product docs that can auto-generate configurations or answer "How do I..." questions in real-time after you\'ve downloaded a product or started a trial.'
          },
          {
            id: 'self-service-demo',
            label: 'Self-service demo',
            cost: 2,
            description: 'Passive video or click-through overview.'
          },
          {
            id: 'tech-docs-api-ref',
            label: 'Tech docs/API references',
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
        id: '3',
        type: 'multiple-choice',
        question:
          'If you’re evaluating an enterprise product for purchase, which infrastructure would you prefer?',
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
        id: '8',
        type: 'text',
        question:
          "Before we end, was there anything else about how you like to test software that we didn't cover?"
      }
    ],
    'my-red-hat': [
      {
        id: 'study-overview',
        type: 'overview',
        question:
          "**Refine your intelligent dashboard**\n\nThis study has three parts. You will walk through each in order. Every part includes a short introduction and often an interactive preview, plus written follow-up questions (several in Parts 1 and 2, four after the preview in Part 3).\n\n- Part 1 — The portable My Red Hat (tools that follow you across Red Hat sites)\n- Part 2 — Generative and intelligent customization (AI-assisted dashboard layout)\n- Part 3 — Proof of subscription value lookback (renewal-ready proof of value)\n\nSelect Next when you are ready to begin Part 1."
      },
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
        type: 'multiple-choice',
        question:
          "If this 'sidekick' showed you a notification, would you want it to be:",
        options: [
          '(a) a passive alert you check on your own time',
          '(b) a proactive nudge that interrupts you for something critical',
          '(c) Other'
        ],
        multiChoiceRequiredFreeTextKey: 'portable-notifications-explain',
        multiChoiceRequiredFreeTextLabel:
          'You indicated you prefer {{SELECTED_OPTION}}. Please explain.'
      },
      {
        id: 'portable-notification-content',
        type: 'text',
        questionTag: 'reflection',
        question: 'What type of notification content would be valuable (ex: security CVEs)?'
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
        questionTag: 'reflection',
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
        id: 'proof-renewal-metrics',
        type: 'text',
        question:
          'If you had to prove the value of your Red Hat spend to your boss today to justify a renewal, what top 3 metrics (e.g., security patches applied, support cases resolved) would be critical?'
      },
      {
        id: 'proof-pov-surface',
        type: 'text',
        question:
          "Would you expect to find this 'Proof of Value' data directly on your My Red Hat dashboard for daily tracking, or do you see it as a formal report?"
      },
      {
        id: 'proof-report-cadence',
        type: 'multiple-choice',
        question: 'What is the ideal cadence you would need this type of report?',
        options: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually', 'Other'],
        multiChoiceRequiredFreeTextKey: 'proof-report-cadence-explain',
        multiChoiceRequiredFreeTextLabel:
          'You indicated you prefer {{SELECTED_OPTION}}. Please explain.'
      },
      {
        id: 'proof-year-in-review-value',
        type: 'text',
        question:
          "Does seeing a 'Year in Review' summary help you operate better day-to-day, or is its primary value just for budget/renewal conversations?"
      }
    ],
    'user-preferences': [
      {
        id: '1',
        question: 'We are simplifying how you manage your account data. Where do you expect to go to review and update the following?',
        type: 'buckets',
        bucketsSplitSidebar: true,
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
        question: 'Should the following be customized for you across all Red Hat digital touchpoints, or should it be application specific?',
        type: 'buckets',
        bucketsSplitSidebar: true,
        options: ['Across Red Hat sites', 'App-specific'],
        instruction: 'Moderator: Drag each attribute into the bucket that reflects the participant\'s preference',
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
        question: 'Help us make your experience better. Which 5 things should Red Hat remember about you?',
        type: 'multi-select',
        maxSelections: 5,
        multiSelectListHeading: 'Selectable attributes',
        instruction:
          'Moderator: Select exactly 5 items. If one of the participant\'s choices is Other, describe it to the note taker.',
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
          'Accessibility or display preferences',
          'Other'
        ],
        multiSelectOtherOptionLabel: 'Other',
        multiSelectOtherFreeTextKey: '3-other-specify',
        multiSelectOtherFreeTextLabel: 'Please describe what else Red Hat should remember about you.'
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
        question: "How do you feel when you're asked to re-select or fill in details you've shared before?",
        type: 'slider',
        sliderMin: 1,
        sliderMax: 5,
        sliderLabels: ['Very dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very satisfied']
      },
      {
        id: '6',
        type: 'text',
        question:
          "Is there anything else you want to share about how you'd like us to personalize your experience?"
      }
    ],
    'product-marketing': [
      {
        id: 'pm-context',
        type: 'overview',
        overviewAfterImageFullWidth: true,
        overviewAfterImageSrc: productMarketingSecondaryNavImage,
        overviewAfterImageAlt:
          'Red Hat product page excerpt highlighting the horizontal secondary navigation with menu items such as Explore, Overview, and related product links.',
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
        bucketsSplitSidebar: true,
        question: 'Which menu label would you expect each of these content types to appear under?',
        instruction: 'Drag these items into the menu label where you would expect to find them.',
        options: ['Overview', 'Explore', 'Learn', 'Get started'],
        rows: [
          { id: 'relevant-articles-topics-blogs', label: 'Relevant articles, topics and blogs' },
          { id: 'product-use-cases', label: 'Product use cases' },
          { id: 'product-learning-hubs', label: 'Product learning hubs' },
          { id: 'product-quickstarts', label: 'Product quickstarts' },
          { id: 'customer-success-stories', label: 'Customer success stories' },
          { id: 'product-learning-paths', label: 'Product learning paths' },
          { id: 'product-trials', label: 'Product trials' },
          { id: 'product-pricing', label: 'Product pricing' },
          { id: 'how-to-buy-pricing', label: 'How to buy/pricing' },
          { id: 'product-features', label: 'Product features' },
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
        imageSrc: productMarketingSecondaryNavCommonItems,
        imageAlt:
          'Secondary navigation examples showing shared menu item labels such as Explore, Overview, and Documentation across Red Hat product pages.',
        question:
          "Do you expect the menu item labels to be consistent across each product's secondary navigation menu? Please explain the reasoning behind your answer.",
        options: ['Yes', 'No'],
        multiChoiceRequiredFreeTextKey: '5-consistency-why',
        multiChoiceRequiredFreeTextLabel: 'Your explanation:'
      },
      {
        id: '6',
        type: 'multiple-choice',
        imageSrc: productMarketingSecondaryNavImage,
        imageAlt:
          'Red Hat product page excerpt highlighting the horizontal secondary navigation with menu items such as Explore, Overview, and related product links.',
        question:
          "In the Red Hat AI navigation menu example, it consolidates 'Products & documentation' into one menu item. Would you prefer this consolidation across all product secondary navigation menus? Please explain the reasoning behind your answer.",
        options: ['Yes', 'No'],
        multiChoiceRequiredFreeTextKey: '6-consolidation-why',
        multiChoiceRequiredFreeTextLabel: 'Your explanation:'
      },
      {
        id: '7',
        type: 'text',
        imageSourcePageId: 'pm-context',
        question:
          'If you could add a menu item option, which would it be and why? What content types would fall under this menu item label?'
      }
    ],
    'developer-program': [
      {
        id: 'intro',
        type: 'overview',
        question:
          "Imagine you are exploring the Red Hat Developer site and are interested in trying out a Red Hat product. You will be shown a few static images representing program details. Please review the images and answer the questions that follow."
      },
      {
        id: 'b1-q1',
        type: 'multiple-choice',
        question: 'If you wanted to sign up for one of the two programs, which would you choose?',
        imageSrc: developerStudyTiersImage,
        imageAlt:
          'Developer program tiers overview: Developer for Individuals and Developer for Businesses compared with what you get in each.',
        options: ['Developer for individuals', 'Developer for businesses']
      },
      {
        id: 'b1-q2',
        type: 'text',
        imageSourcePageId: 'b1-q1',
        question:
          'Why did you make this choice, and why did you not choose the other option?'
      },
      {
        id: 'b1-q3',
        type: 'text',
        imageSourcePageId: 'b1-q1',
        question:
          'What additional information is missing from the overview of these tiers that would help you make a more informed choice?'
      },
      {
        id: 'b2-q1',
        type: 'slider',
        questionAboveHeroImage: true,
        sliderAboveHeroImage: true,
        questionSubtext:
          'Scroll to see the full sign-up screen, or tap the image to open a larger view.',
        questionHeroImageFromPageId: 'b1-q1',
        questionHeroImagesByPriorOption: DEVELOPER_PROGRAM_SIGNUP_FLOW_HERO_BY_PROGRAM,
        questionHeroImageAltsByPriorOption: DEVELOPER_PROGRAM_SIGNUP_FLOW_HERO_ALT,
        question:
          'How do you feel about the steps and information required to sign up?',
        sliderMin: 1,
        sliderMax: 5,
        sliderLabels: [
          'Extremely overwhelming',
          'Overwhelming',
          'Neutral',
          'Easy',
          'Extremely easy'
        ]
      },
      {
        id: 'b2-q2',
        type: 'text',
        questionHeroImageFromPageId: 'b1-q1',
        questionHeroImagesByPriorOption: DEVELOPER_PROGRAM_SIGNUP_FLOW_HERO_BY_PROGRAM,
        questionHeroImageAltsByPriorOption: DEVELOPER_PROGRAM_SIGNUP_FLOW_HERO_ALT,
        question:
          'If you could remove two fields from this registration form to improve your experience, which would they be and why?'
      },
      {
        id: 'b2-q3',
        type: 'multiple-choice',
        questionHeroImageFromPageId: 'b1-q1',
        questionHeroImagesByPriorOption: DEVELOPER_PROGRAM_SIGNUP_FLOW_HERO_BY_PROGRAM,
        questionHeroImageAltsByPriorOption: DEVELOPER_PROGRAM_SIGNUP_FLOW_HERO_ALT,
        question:
          'Given the information requested on this form, would you complete the registration or leave the page?',
        options: ['I would complete the registration', 'I would leave the page']
      },
      {
        id: 'b2-q4',
        type: 'text',
        visibleWhen: { priorPageId: 'b2-q3', equals: 'I would leave the page' },
        questionHeroImageFromPageId: 'b1-q1',
        questionHeroImagesByPriorOption: DEVELOPER_PROGRAM_SIGNUP_FLOW_HERO_BY_PROGRAM,
        questionHeroImageAltsByPriorOption: DEVELOPER_PROGRAM_SIGNUP_FLOW_HERO_ALT,
        question: 'What is the key issue keeping you from completing the registration?'
      },
      {
        id: 'b3-q1',
        type: 'text',
        imageSourcePageId: 'b1-q1',
        question:
          "Once you've successfully gained access to the Developer program, what specific tool, download, or resource would you be most eager to access?"
      },
      {
        id: 'b3-q2',
        type: 'text',
        imageSourcePageId: 'b1-q1',
        question:
          "Thinking about the features promised during registration, are there any access points or benefits you expect to be immediately available that aren't shown?"
      },
      {
        id: 'b4-q1',
        type: 'multiple-choice',
        imageSourcePageId: 'b1-q1',
        question:
          'Overall, do you feel you were given a clear understanding of what the Developer program is and its offerings?',
        options: ['Yes', 'No']
      },
      {
        id: 'b4-q2',
        type: 'text',
        imageSourcePageId: 'b1-q1',
        question:
          'Thinking back through this overall experience, would you sign up for this program in real life? What specifically helped you make that decision?'
      },
      {
        id: 'b4-q3',
        type: 'text',
        imageSourcePageId: 'b1-q1',
        question:
          'If you could give Red Hat one piece of advice to improve this overall experience, what would it be?'
      }
    ],
    'my-trials': [
      {
        id: 'intro',
        type: 'overview',
        overviewAfterImageGallery: [
          {
            src: myTrialsReadyToBuyDialogSingle,
            alt:
              'Ready to Buy modal in the live product: single centered card for Red Hat Sales with a Contact sales button.'
          },
          {
            src: myTrialsReadyToBuyDialogThreeOptions,
            alt:
              'Ready to Buy modal in the live product: three columns—Red Hat Sales, Marketplace, and Connect with partners—with Contact sales, Buy online, and Find a partner links.'
          }
        ],
        question:
          "Right now, when you finish a product trial and click 'Ready to Buy,' you see the dialog below—this is the current experience in the live product.\n\nHowever, our data shows the majority of users close this window without clicking anything. Help us understand why."
      },
      {
        id: '1',
        type: 'multiple-choice',
        question:
          'You are nearing the end of a product trial and want to keep using the software. Which button are you more likely to click to figure out your options?',
        options: [
          'Ready to buy',
          "What's next? / Explore next steps",
          'Contact sales'
        ]
      },
      MY_TRIALS_PAGE_READY_TO_BUY_EXPECT,
      {
        id: '3',
        type: 'multiple-choice',
        imageSrc: myTrialsReadyToBuyDialogThreeOptions,
        imageAlt:
          'Ready to Buy modal in the live product: three columns—Red Hat Sales, Marketplace, and Connect with partners—with Contact sales, Buy online, and Find a partner links.',
        question:
          'Look at the multiple buying options on the screen. If you closed this menu without clicking anything, what is your most likely reason?',
        options: [
          "I don't know which option applies to my company's contract.",
          'I need to secure an internal budget/approval first.',
          'I wanted to see transparent pricing without talking to Sales.',
          "I'm afraid of messing up my existing account terms.",
          'I want to buy online through digital commerce options.'
        ]
      },
      {
        id: '4',
        type: 'ranking',
        imageSourcePageId: '3',
        question:
          'We are redesigning this menu to make it easier. Rank these 5 proposed updates from Most Useful (1) to Least Useful (5):',
        instruction:
          'Drag rows or use Up/Down to order. 1 = most useful, 5 = least useful among these five.',
        rows: [
          {
            id: 'mt-rank-rename-btn',
            label:
              'Rename the button to "View buying options" so it\'s clear I\'m not checking out today.'
          },
          {
            id: 'mt-rank-best-for',
            label:
              'Add short "Best for…" descriptions under each option to better guide next steps (e.g., Marketplace: Best for AWS budgets).'
          },
          {
            id: 'mt-rank-recommended-path',
            label:
              'A "Recommended path" badge showing how my company usually buys Red Hat software.'
          },
          {
            id: 'mt-rank-notify-team',
            label:
              'A "Notify my account team" button to have my rep reach out with options.'
          },
          {
            id: 'mt-rank-share-summary',
            label:
              'A "Share trial summary" button to email my thoughts and next steps to my manager.'
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
        imageSrc: contentDiscoveryQ1TopicCards,
        imageAlt:
          'Topic cards for Virtualization, AI, Linux standardization, Application development, and Automation, each with a summary and call to action.',
        question:
          'These topics are examples of areas people come to learn about. Which one are you most interested in exploring right now?',
        options: ['AI', 'Virtualization', 'Application development', 'Automation', 'Linux standardization']
      },
      {
        id: '2',
        type: 'multiple-choice',
        instruction:
          'On screen, resources are numbered: (1) Podcast · (2) Blog article · (3) E-book · (4) Event · (5) Technical use case',
        questionHeroImageFromPageId: '1',
        questionHeroImagesByPriorOption: CONTENT_DISCOVERY_Q2_HERO_BY_TOPIC,
        questionHeroImageAltsByPriorOption: CONTENT_DISCOVERY_Q2_HERO_ALT_BY_TOPIC,
        questionTopicFromPageId: '1',
        question:
          'Great! So you want to learn more about {{TOPIC}}. Which additional resource are you most likely to choose next to learn more? Select the corresponding number of the resource on the screen.',
        options: [
          '1. Podcast',
          '2. Blog article',
          '3. E-book',
          '4. Event',
          '5. Technical use case'
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
        instruction:
          'Optional — choose any other numbered resources that interest you, or select none and continue.\n\nOn screen, resources are numbered: 1 Podcast · 2 Blog article · 3 E-book · 4 Event · 5 Technical use case',
        questionHeroImageFromPageId: '1',
        questionHeroImagesByPriorOption: CONTENT_DISCOVERY_Q2_HERO_BY_TOPIC,
        questionHeroImageAltsByPriorOption: CONTENT_DISCOVERY_Q2_HERO_ALT_BY_TOPIC,
        question:
          'Are you also interested in any of the other offerings? If so, select all the other ones you would be interested in. Select the corresponding number of the resource on the screen.',
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

function StudyImageLightbox({
  image,
  onClose
}: {
  image: { src: string; alt: string }
  onClose: () => void
}) {
  const label =
    image.alt?.trim() ? `Enlarged image: ${image.alt}` : 'Enlarged reference image'
  return (
    <div
      className="study-image-lightbox-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="study-image-lightbox-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="study-image-lightbox-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <img src={image.src} alt={image.alt} className="study-image-lightbox-img" />
      </div>
    </div>
  )
}

function StudyPages({ focusId, onBack, onComplete, onExportCsv }: StudyPagesProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showCompletion, setShowCompletion] = useState(false)
  const [isLoadingCompletion, setIsLoadingCompletion] = useState(false)
  const [expandedStudyImage, setExpandedStudyImage] = useState<{ src: string; alt: string } | null>(null)
  const allStudyPages = useMemo(() => getStudyPages(focusId), [focusId])
  const studyPages = useMemo(
    () => allStudyPages.filter((p) => pagePassesVisibilityFilter(p, answers)),
    [allStudyPages, answers]
  )
  const pageNavigationRef = useRef<HTMLDivElement>(null)
  const pageContentRef = useRef<HTMLDivElement>(null)
  const prevCanProceedRef = useRef<boolean | null>(null)

  const currentPage = studyPages[currentPageIndex]
  const displayedQuestion = currentPage ? resolveStudyQuestion(currentPage, allStudyPages, answers) : ''

  useEffect(() => {
    if (studyPages.length > 0 && currentPageIndex >= studyPages.length) {
      setCurrentPageIndex(Math.max(0, studyPages.length - 1))
    }
  }, [studyPages.length, currentPageIndex])

  useEffect(() => {
    setExpandedStudyImage(null)
  }, [currentPageIndex])

  useEffect(() => {
    if (!expandedStudyImage) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedStudyImage(null)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [expandedStudyImage])

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
    return getDerivedMultiSelectOptions(p, allStudyPages, answers) ?? []
  }, [currentPageIndex, allStudyPages, answers])

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
        if (
          currentPage.type === 'multi-select' &&
          currentPage.multiSelectOtherOptionLabel &&
          currentPage.multiSelectOtherFreeTextKey
        ) {
          try {
            const sel = JSON.parse(value || '[]') as unknown
            if (Array.isArray(sel) && !sel.includes(currentPage.multiSelectOtherOptionLabel)) {
              delete next[currentPage.multiSelectOtherFreeTextKey]
            }
          } catch {
            /* leave other write-in unchanged if selection JSON is invalid */
          }
        }
        if (currentPage.id === 'b2-q3' && value !== 'I would leave the page') {
          delete next['b2-q4']
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
    if (page.type === 'prototype') {
      if (page.prototypeOpenTextKey) {
        overrides[page.prototypeOpenTextKey] = '[skipped]'
      }
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
      const picked = page.options.slice(0, page.maxSelections)
      overrides[page.id] = JSON.stringify(picked)
      if (
        page.multiSelectOtherOptionLabel &&
        page.multiSelectOtherFreeTextKey &&
        picked.includes(page.multiSelectOtherOptionLabel)
      ) {
        overrides[page.multiSelectOtherFreeTextKey] = '[skipped]'
      }
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
      overrides[page.id] = String(getSliderNeutralValue(page))
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

  const canProceed = () => computeCanProceed(currentPage, answers, allStudyPages)

  useEffect(() => {
    prevCanProceedRef.current = null
  }, [currentPageIndex])

  useEffect(() => {
    const page = studyPages[currentPageIndex]
    if (!page) return
    const ok = computeCanProceed(page, answers, allStudyPages)
    const prev = prevCanProceedRef.current
    if (prev === false && ok) {
      pageNavigationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    if (prev === null) {
      prevCanProceedRef.current = ok
      return
    }
    prevCanProceedRef.current = ok
  }, [answers, currentPageIndex, studyPages, allStudyPages])

  const pageForModeratorFocus = studyPages[currentPageIndex]
  const moderatorFocusPageId = pageForModeratorFocus?.id ?? ''
  const moderatorFocusMcFollowUpActive = Boolean(
    pageForModeratorFocus?.type === 'multiple-choice' &&
      pageForModeratorFocus.followUpFreeText &&
      pageForModeratorFocus.followUpWhen !== undefined &&
      answers[pageForModeratorFocus.id] === pageForModeratorFocus.followUpWhen
  )
  const moderatorFocusMsOtherActive = Boolean(
    pageForModeratorFocus?.type === 'multi-select' &&
      pageForModeratorFocus.multiSelectOtherOptionLabel &&
      pageForModeratorFocus.multiSelectOtherFreeTextKey &&
      (() => {
        try {
          const sel = JSON.parse(answers[pageForModeratorFocus.id] || '[]') as string[]
          return (
            Array.isArray(sel) &&
            sel.includes(pageForModeratorFocus.multiSelectOtherOptionLabel!)
          )
        } catch {
          return false
        }
      })()
  )

  useLayoutEffect(() => {
    const root = pageContentRef.current
    if (!root) return
    const list = root.querySelectorAll<HTMLTextAreaElement>(
      'textarea[data-moderator-notes-focus="true"]'
    )
    if (list.length === 0) return
    list[list.length - 1]!.focus({ preventScroll: true })
  }, [
    currentPageIndex,
    moderatorFocusPageId,
    pageForModeratorFocus?.type,
    moderatorFocusMcFollowUpActive,
    moderatorFocusMsOtherActive
  ])

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
          <img src={studyLogo} alt="" className="study-logo" />
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
          <img src={studyLogo} alt="" className="study-logo" />
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

  const studyTitle = studyDisplayName(focusId)

  const questionHero: { src: string; alt: string } | null =
    resolveImageHero(currentPage, allStudyPages) ?? resolveQuestionHeroImage(currentPage, answers)

  const deferHeroBelowQuestion = Boolean(
    currentPage.questionAboveHeroImage && questionHero && currentPage.type !== 'overview'
  )

  const resolvedFigmaUrl = resolveFigmaEmbedUrl(currentPage, allStudyPages)

  const showLikertAboveDeferredHero =
    deferHeroBelowQuestion &&
    currentPage.type === 'slider' && Boolean(currentPage.sliderAboveHeroImage)

  const likertScaleEl =
    currentPage.type === 'slider' ? (
      <div
        className="options-list survey-radio-group"
        role="radiogroup"
        aria-label={displayedQuestion.trim() || 'Rating scale'}
      >
        {getSliderLikertOptions(currentPage).map(({ value, label }) => {
          const selected = answers[currentPage.id] === value
          return (
            <label
              key={value}
              className={`survey-radio-row${selected ? ' survey-radio-row--selected' : ''}`}
            >
              <input
                type="radio"
                className="survey-radio-input"
                name={currentPage.id}
                value={value}
                checked={selected}
                onChange={() => handleAnswerChange(value)}
              />
              <span className="survey-radio-label">{label}</span>
            </label>
          )
        })}
      </div>
    ) : null

  const resolvedQuestionTag = resolveQuestionTag(currentPage, isLastPage, answers)

  const showRankingModeratorDock =
    currentPage.type === 'ranking' &&
    Boolean(rankingRowsResolved && rankingRowsResolved.length >= 2) &&
    Boolean(currentPage.rankingOtherAnswerKey && currentPage.rankingOtherQuestion)

  const showModeratorNotesDock =
    (currentPage.type === 'prototype' &&
      Boolean(currentPage.prototypeOpenTextKey && currentPage.prototypeOpenTextLabel)) ||
    currentPage.type === 'text' ||
    (currentPage.type === 'multiple-choice' &&
      Boolean(
        currentPage.options &&
          currentPage.multiChoiceRequiredFreeTextKey &&
          currentPage.multiChoiceRequiredFreeTextLabel
      )) ||
    (currentPage.type === 'multiple-choice' &&
      currentPage.followUpWhen !== undefined &&
      answers[currentPage.id] === currentPage.followUpWhen &&
      Boolean(currentPage.followUpAnswerKey && currentPage.followUpFreeText)) ||
    (currentPage.type === 'multi-select' &&
      moderatorFocusMsOtherActive &&
      Boolean(currentPage.multiSelectOtherFreeTextLabel)) ||
    showRankingModeratorDock

  return (
    <div className="study-pages-screen">
      <div className="study-header">
        <img src={studyLogo} alt="" className="study-logo" />
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
          ref={pageContentRef}
          className="study-page-main"
          key={`study-page-${currentPageIndex}-${currentPage.id}`}
        >
        <div className="page-content">
          {questionHero && !deferHeroBelowQuestion ? (
            <div className="study-expandable-image-block study-expandable-image-block--hero">
              <button
                type="button"
                className="study-expandable-image-btn study-expandable-image-btn--hero"
                onClick={() => setExpandedStudyImage({ src: questionHero.src, alt: questionHero.alt })}
                aria-haspopup="dialog"
                aria-label={
                  questionHero.alt.trim() ? `View larger: ${questionHero.alt}` : 'View larger image'
                }
              >
                <img src={questionHero.src} alt="" className="study-page-hero-image" />
              </button>
              <p className="study-expandable-image-hint">Click image to enlarge</p>
            </div>
          ) : currentPage.placeholderImage ? (
            <div
              className="study-page-image-placeholder"
              role="img"
              aria-label="Illustration placeholder for example learning topics (AI, virtualization, and similar)"
            >
              <span className="study-page-image-placeholder-label">Image placeholder</span>
            </div>
          ) : currentPage.figmaEmbedAboveQuestion && resolvedFigmaUrl ? (
            <div className="figma-embed-wrap figma-embed-wrap--above">
              <iframe
                src={resolvedFigmaUrl}
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
              {currentPage.overviewAfterImageGallery &&
              currentPage.overviewAfterImageGallery.length > 0 ? (
                <div
                  className="study-overview-after-gallery"
                  role="group"
                  aria-label="Screenshots of the current Ready to Buy experience"
                >
                  {currentPage.overviewAfterImageGallery.map((item, idx) => (
                    <figure key={idx} className="study-overview-after-gallery-item">
                      <button
                        type="button"
                        className="study-expandable-image-btn study-expandable-image-btn--overview"
                        onClick={() =>
                          setExpandedStudyImage({ src: item.src, alt: item.alt })
                        }
                        aria-haspopup="dialog"
                        aria-label={
                          item.alt?.trim()
                            ? `View larger: ${item.alt}`
                            : `View larger screenshot ${idx + 1}`
                        }
                      >
                        <img src={item.src} alt="" className="study-overview-after-image" />
                      </button>
                      <figcaption className="study-expandable-image-hint study-expandable-image-hint--in-figure">
                        Click image to enlarge
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : currentPage.overviewAfterImageSrc ? (
                <figure
                  className={`study-overview-after-image-wrap${
                    currentPage.overviewAfterImageFullWidth
                      ? ' study-overview-after-image-wrap--full'
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    className="study-expandable-image-btn study-expandable-image-btn--overview"
                    onClick={() =>
                      setExpandedStudyImage({
                        src: currentPage.overviewAfterImageSrc!,
                        alt: currentPage.overviewAfterImageAlt ?? ''
                      })
                    }
                    aria-haspopup="dialog"
                    aria-label={
                      currentPage.overviewAfterImageAlt?.trim()
                        ? `View larger: ${currentPage.overviewAfterImageAlt}`
                        : 'View larger image'
                    }
                  >
                    <img
                      src={currentPage.overviewAfterImageSrc}
                      alt=""
                      className="study-overview-after-image"
                    />
                  </button>
                  <figcaption className="study-expandable-image-hint study-expandable-image-hint--in-figure">
                    Click image to enlarge
                  </figcaption>
                </figure>
              ) : null}
            </>
          ) : deferHeroBelowQuestion ? null : (
            <>
              {resolvedQuestionTag ? (
                <p className="page-question-tag" data-tag={resolvedQuestionTag}>
                  {questionTagDisplayLabel(resolvedQuestionTag)}
                </p>
              ) : null}
              <h2 className="page-question">{displayedQuestion}</h2>
            </>
          )}

          {deferHeroBelowQuestion && questionHero ? (
            <>
              <div className="study-expandable-image-block study-expandable-image-block--hero study-expandable-image-block--hero-after-question">
                <button
                  type="button"
                  className="study-expandable-image-btn study-expandable-image-btn--hero"
                  onClick={() => setExpandedStudyImage({ src: questionHero.src, alt: questionHero.alt })}
                  aria-haspopup="dialog"
                  aria-label={
                    questionHero.alt.trim() ? `View larger: ${questionHero.alt}` : 'View larger image'
                  }
                >
                  <img src={questionHero.src} alt="" className="study-page-hero-image" />
                </button>
                <p className="study-expandable-image-hint">Click image to enlarge</p>
              </div>
              <div className="page-question-heading-group">
                {resolvedQuestionTag ? (
                  <p className="page-question-tag" data-tag={resolvedQuestionTag}>
                    {questionTagDisplayLabel(resolvedQuestionTag)}
                  </p>
                ) : null}
                <h2 className="page-question">{displayedQuestion}</h2>
                {currentPage.questionSubtext?.trim() ? (
                  <p className="page-question-subtext">{currentPage.questionSubtext}</p>
                ) : null}
              </div>
              {showLikertAboveDeferredHero ? likertScaleEl : null}
            </>
          ) : null}

          {currentPage.type === 'prototype' ? (
            <>
              {resolvedFigmaUrl ? (
                <div className="figma-embed-wrap">
                  <iframe
                    src={resolvedFigmaUrl}
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
              )}
            </>
          ) : (
            resolvedFigmaUrl &&
            !currentPage.figmaEmbedAboveQuestion &&
            !(
              currentPage.type === 'multiple-choice' &&
              currentPage.multipleChoiceOptionsAboveEmbed
            ) && (
              <div className="figma-embed-wrap">
                <iframe
                  src={resolvedFigmaUrl}
                  className="figma-embed"
                  allowFullScreen
                  title="Figma prototype"
                />
              </div>
            )
          )}

          {currentPage.type === 'multiple-choice' && currentPage.options && (
            <div className={currentPage.followUpWhen !== undefined ? 'evaluation-trust' : undefined}>
              {currentPage.instruction && (
                <p className="multiple-choice-instruction">{currentPage.instruction}</p>
              )}
              <div
                className="options-list survey-radio-group"
                role="radiogroup"
                aria-label={displayedQuestion.trim() || 'Choose one option'}
              >
                {currentPage.options.map((option, optIndex) => {
                  const selected = answers[currentPage.id] === option
                  return (
                    <label
                      key={`${currentPage.id}-opt-${optIndex}`}
                      className={`survey-radio-row${selected ? ' survey-radio-row--selected' : ''}`}
                    >
                      <input
                        type="radio"
                        className="survey-radio-input"
                        name={currentPage.id}
                        value={option}
                        checked={selected}
                        onChange={() => handleAnswerChange(option)}
                      />
                      <span className="survey-radio-label">{option}</span>
                    </label>
                  )
                })}
              </div>
              {currentPage.multipleChoiceOptionsAboveEmbed &&
                resolvedFigmaUrl &&
                !currentPage.figmaEmbedAboveQuestion && (
                  <div className="figma-embed-wrap figma-embed-wrap--after-mc-options">
                    <iframe
                      src={resolvedFigmaUrl}
                      className="figma-embed"
                      allowFullScreen
                      title="Figma prototype"
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
                    <div
                      className="options-list survey-radio-group"
                      role="radiogroup"
                      aria-label={
                        currentPage.followUpQuestion?.trim() || 'Choose one option'
                      }
                    >
                      {currentPage.followUpOptions.map((option, i) => {
                        const fk = currentPage.followUpAnswerKey!
                        const selected = answers[fk] === option
                        return (
                          <label
                            key={`${currentPage.id}-followup-${i}-${option}`}
                            className={`survey-radio-row${selected ? ' survey-radio-row--selected' : ''}`}
                          >
                            <input
                              type="radio"
                              className="survey-radio-input"
                              name={`${currentPage.id}-${fk}-followup`}
                              value={option}
                              checked={selected}
                              onChange={() =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [fk]: option
                                }))
                              }
                            />
                            <span className="survey-radio-label">{option}</span>
                          </label>
                        )
                      })}
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
                <div className="multi-select-instruction-block">
                  {currentPage.instruction
                    .split(/\n\n+/)
                    .map((para) => para.trim())
                    .filter(Boolean)
                    .map((para, i) => (
                      <p key={i} className="multi-select-instruction">
                        {para}
                      </p>
                    ))}
                </div>
              )}
              {currentPage.multiSelectListHeading ? (
                <p className="multi-select-options-heading" id={`multi-select-list-h-${currentPage.id}`}>
                  {currentPage.multiSelectListHeading}
                </p>
              ) : null}
              <div
                className="multi-select-options"
                role="group"
                aria-labelledby={
                  currentPage.multiSelectListHeading ? `multi-select-list-h-${currentPage.id}` : undefined
                }
                aria-label={currentPage.multiSelectListHeading ? undefined : 'Multi-select options'}
              >
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
                      aria-pressed={selected}
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
                <div className="value-credits-instruction-block">
                  {currentPage.instruction
                    .split(/\n\n+/)
                    .map((para) => para.trim())
                    .filter(Boolean)
                    .map((para, i) => (
                      <p key={i} className="value-credits-instruction">
                        {para}
                      </p>
                    ))}
                </div>
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
              {currentPage.valueCreditsListHeading ? (
                <p className="value-credits-cards-heading" id={`value-credits-list-h-${currentPage.id}`}>
                  {currentPage.valueCreditsListHeading}
                </p>
              ) : null}
              <div
                className="value-credits-cards"
                role="group"
                aria-labelledby={
                  currentPage.valueCreditsListHeading ? `value-credits-list-h-${currentPage.id}` : undefined
                }
                aria-label={currentPage.valueCreditsListHeading ? undefined : 'Value credit cards'}
              >
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
                      aria-pressed={selected}
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

          {currentPage.type === 'slider' && !showLikertAboveDeferredHero ? likertScaleEl : null}

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
            </>
          )}

          {currentPage.type === 'matrix' && currentPage.rows && currentPage.options && (
            <div className="matrix-question">
              <p className="matrix-instruction">{currentPage.instruction || `Select one for each: ${currentPage.options.join(', ')}`}</p>
              <div className="matrix-table">
                {currentPage.rows.map((row) => (
                  <div key={row.id} className="matrix-row">
                    <div className="matrix-row-label">{row.label}</div>
                    <div
                      className="matrix-row-options"
                      role="radiogroup"
                      aria-label={`${row.label}: choose one`}
                    >
                      {currentPage.options!.map((option) => {
                        const ansKey = `${currentPage.id}:${row.id}`
                        const selected = answers[ansKey] === option
                        return (
                          <label
                            key={option}
                            className={`matrix-option ${selected ? 'selected' : ''}`}
                          >
                            <input
                              type="radio"
                              className="survey-radio-input survey-radio-input--matrix"
                              name={ansKey}
                              value={option}
                              checked={selected}
                              onChange={() => handleAnswerChange(option, row.id)}
                            />
                            <span>{option}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentPage.type === 'buckets' && currentPage.rows && currentPage.options && (
            <div
              className={`buckets-question${currentPage.bucketsSplitSidebar ? ' buckets-question--split' : ''}`}
            >
              <p className="buckets-instruction">{currentPage.instruction || 'Moderator: Drag each term into the bucket where the participant expects to find it'}</p>
              <BucketsBody
                page={currentPage}
                answers={answers}
                splitSidebar={!!currentPage.bucketsSplitSidebar}
                onAssign={(bucket, rowId) => handleAnswerChange(bucket, rowId)}
                onUnplace={(rowId) => handleAnswerChange('', rowId)}
              />
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
              {isLastPage ? 'Submit' : 'Moderator: advance when ready'}
            </button>
          </div>
        </div>

        {showModeratorNotesDock ? (
          <div className="study-moderator-notes-dock" aria-label="Moderator notes">
            {currentPage.type === 'prototype' &&
              currentPage.prototypeOpenTextKey &&
              currentPage.prototypeOpenTextLabel && (
                <div className="multiple-choice-other-follow multiple-choice-other-follow--in-dock">
                  <ModeratorNotesFieldLabel />
                  <p className="multiple-choice-other-follow-label">{currentPage.prototypeOpenTextLabel}</p>
                  <textarea
                    className={moderatorDockTextareaClass(
                      answers[currentPage.prototypeOpenTextKey] || ''
                    )}
                    value={answers[currentPage.prototypeOpenTextKey] || ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [currentPage.prototypeOpenTextKey!]: e.target.value
                      }))
                    }
                    data-moderator-notes-focus="true"
                    placeholder={MODERATOR_OPEN_TEXT_PLACEHOLDER}
                    rows={MODERATOR_DOCK_TEXTAREA_ROWS.large}
                    aria-label={currentPage.prototypeOpenTextLabel}
                  />
                </div>
              )}

            {currentPage.type === 'text' && (
              <div className="study-moderator-notes-block">
                <ModeratorNotesFieldLabel />
                <textarea
                  className={moderatorDockTextareaClass(answers[currentPage.id] || '')}
                  value={answers[currentPage.id] || ''}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  data-moderator-notes-focus="true"
                  placeholder={MODERATOR_OPEN_TEXT_PLACEHOLDER}
                  rows={MODERATOR_DOCK_TEXTAREA_ROWS.large}
                  aria-label="Moderator notes"
                />
              </div>
            )}

            {currentPage.type === 'multiple-choice' &&
              currentPage.options &&
              currentPage.multiChoiceRequiredFreeTextKey &&
              currentPage.multiChoiceRequiredFreeTextLabel && (
                <div className="multiple-choice-other-follow multiple-choice-other-follow--in-dock">
                  <ModeratorNotesFieldLabel />
                  <p className="multiple-choice-other-follow-label">
                    {currentPage.multiChoiceRequiredFreeTextLabel.includes(SELECTED_OPTION_PLACEHOLDER) &&
                    !answers[currentPage.id]?.trim()
                      ? 'Select an option above, then explain your reasoning below.'
                      : resolveMultiChoiceFreeTextLabel(
                          currentPage.multiChoiceRequiredFreeTextLabel,
                          answers[currentPage.id]
                        )}
                  </p>
                  <textarea
                    className={moderatorDockTextareaClass(
                      answers[currentPage.multiChoiceRequiredFreeTextKey] || ''
                    )}
                    value={answers[currentPage.multiChoiceRequiredFreeTextKey] || ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [currentPage.multiChoiceRequiredFreeTextKey!]: e.target.value
                      }))
                    }
                    data-moderator-notes-focus="true"
                    placeholder={MODERATOR_OPEN_TEXT_PLACEHOLDER}
                    rows={MODERATOR_DOCK_TEXTAREA_ROWS.medium}
                    aria-label={
                      currentPage.multiChoiceRequiredFreeTextLabel.includes(SELECTED_OPTION_PLACEHOLDER) &&
                      answers[currentPage.id]?.trim()
                        ? resolveMultiChoiceFreeTextLabel(
                            currentPage.multiChoiceRequiredFreeTextLabel,
                            answers[currentPage.id]
                          )
                        : currentPage.multiChoiceRequiredFreeTextLabel
                    }
                  />
                </div>
              )}

            {currentPage.type === 'multiple-choice' &&
              currentPage.followUpWhen !== undefined &&
              answers[currentPage.id] === currentPage.followUpWhen &&
              currentPage.followUpAnswerKey &&
              currentPage.followUpFreeText && (
                <div className="multiple-choice-other-follow multiple-choice-other-follow--in-dock">
                  <ModeratorNotesFieldLabel />
                  {currentPage.followUpQuestion ? (
                    <p className="multiple-choice-other-follow-label">{currentPage.followUpQuestion}</p>
                  ) : null}
                  <textarea
                    className={moderatorDockTextareaClass(answers[currentPage.followUpAnswerKey] || '')}
                    value={answers[currentPage.followUpAnswerKey] || ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [currentPage.followUpAnswerKey!]: e.target.value
                      }))
                    }
                    data-moderator-notes-focus="true"
                    placeholder={MODERATOR_OPEN_TEXT_PLACEHOLDER}
                    rows={MODERATOR_DOCK_TEXTAREA_ROWS.medium}
                    aria-label={currentPage.followUpQuestion || 'Other — please specify'}
                  />
                </div>
              )}

            {currentPage.type === 'multi-select' &&
              moderatorFocusMsOtherActive &&
              currentPage.multiSelectOtherFreeTextLabel && (
                <div className="multiple-choice-other-follow multiple-choice-other-follow--in-dock">
                  <ModeratorNotesFieldLabel />
                  <p className="multiple-choice-other-follow-label">
                    {currentPage.multiSelectOtherFreeTextLabel}
                  </p>
                  <textarea
                    className={moderatorDockTextareaClass(
                      answers[currentPage.multiSelectOtherFreeTextKey!] || ''
                    )}
                    value={answers[currentPage.multiSelectOtherFreeTextKey!] || ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [currentPage.multiSelectOtherFreeTextKey!]: e.target.value
                      }))
                    }
                    data-moderator-notes-focus="true"
                    placeholder={MODERATOR_OPEN_TEXT_PLACEHOLDER}
                    rows={MODERATOR_DOCK_TEXTAREA_ROWS.medium}
                    aria-label={currentPage.multiSelectOtherFreeTextLabel}
                  />
                </div>
              )}

            {showRankingModeratorDock ? (
              <div className="study-ranking-other-followup study-ranking-other-followup--in-dock">
                <label className="study-ranking-other-label" htmlFor={`ranking-other-${currentPage.id}`}>
                  {currentPage.rankingOtherQuestion}
                </label>
                <ModeratorNotesFieldLabel />
                <textarea
                  id={`ranking-other-${currentPage.id}`}
                  className={`${moderatorDockTextareaClass(
                    answers[currentPage.rankingOtherAnswerKey!] ?? ''
                  )} study-ranking-other-textarea`}
                  rows={MODERATOR_DOCK_TEXTAREA_ROWS.small}
                  data-moderator-notes-focus="true"
                  placeholder={MODERATOR_OPEN_TEXT_PLACEHOLDER}
                  value={answers[currentPage.rankingOtherAnswerKey!] ?? ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [currentPage.rankingOtherAnswerKey!]: e.target.value
                    }))
                  }
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      </div>

      {expandedStudyImage ? (
        <StudyImageLightbox image={expandedStudyImage} onClose={() => setExpandedStudyImage(null)} />
      ) : null}
    </div>
  )
}

export default StudyPages
