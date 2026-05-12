/**
 * Cross-window study session (v2). Same origin only.
 * - `localStorage` survives refresh and aligns tabs via `storage` events.
 * - `BroadcastChannel` delivers instant updates to all windows (including the sender).
 */

export type SessionV2Phase = 'selector' | 'loading' | 'study'

export type SessionV2Snapshot = {
  version: 2
  revision: number
  phase: SessionV2Phase
  focusId: string | null
  participantId: string
  /** When `phase === 'loading'`, wall-clock ms when loading began (all windows schedule the same end time). */
  loadingStartedAt: number | null
  currentPageIndex: number
  answers: Record<string, string>
  showCompletion: boolean
  isLoadingCompletion: boolean
  /** Which study’s detail modal is open on the selector (`null` = closed). v2 only; synced across windows. */
  studyDetailModalFocusId: string | null
  /** Moderator’s in-progress participant ID (`CYUX-n-digits`), synced so the participant view can enable “Continue”. */
  moderatorParticipantIdDraft: string
}

const STORAGE_KEY = 'summit-cya-v2-session'
const CHANNEL_NAME = 'summit-cya-v2-sync'

const defaultSnapshot = (): SessionV2Snapshot => ({
  version: 2,
  revision: 0,
  phase: 'selector',
  focusId: null,
  participantId: '',
  loadingStartedAt: null,
  currentPageIndex: 0,
  answers: {},
  showCompletion: false,
  isLoadingCompletion: false,
  studyDetailModalFocusId: null,
  moderatorParticipantIdDraft: ''
})

function normalize(raw: unknown): SessionV2Snapshot {
  const d = defaultSnapshot()
  if (!raw || typeof raw !== 'object') return d
  const o = raw as Record<string, unknown>
  if (o.version !== 2) return d
  return {
    ...d,
    revision: typeof o.revision === 'number' ? o.revision : d.revision,
    phase:
      o.phase === 'selector' || o.phase === 'loading' || o.phase === 'study'
        ? (o.phase as SessionV2Phase)
        : o.phase === 'completion'
          ? 'study'
          : d.phase,
    focusId: typeof o.focusId === 'string' || o.focusId === null ? (o.focusId as string | null) : d.focusId,
    participantId: typeof o.participantId === 'string' ? o.participantId : d.participantId,
    loadingStartedAt:
      typeof o.loadingStartedAt === 'number' && Number.isFinite(o.loadingStartedAt)
        ? o.loadingStartedAt
        : o.loadingStartedAt === null
          ? null
          : d.loadingStartedAt,
    currentPageIndex:
      typeof o.currentPageIndex === 'number' && Number.isFinite(o.currentPageIndex)
        ? Math.max(0, Math.floor(o.currentPageIndex))
        : d.currentPageIndex,
    answers: o.answers && typeof o.answers === 'object' && !Array.isArray(o.answers)
      ? { ...(o.answers as Record<string, string>) }
      : d.answers,
    showCompletion: typeof o.showCompletion === 'boolean' ? o.showCompletion : d.showCompletion,
    isLoadingCompletion:
      typeof o.isLoadingCompletion === 'boolean' ? o.isLoadingCompletion : d.isLoadingCompletion,
    studyDetailModalFocusId:
      typeof o.studyDetailModalFocusId === 'string' || o.studyDetailModalFocusId === null
        ? (o.studyDetailModalFocusId as string | null)
        : d.studyDetailModalFocusId,
    moderatorParticipantIdDraft:
      typeof o.moderatorParticipantIdDraft === 'string' ? o.moderatorParticipantIdDraft : d.moderatorParticipantIdDraft
  }
}

function loadFromStorage(): SessionV2Snapshot {
  if (typeof window === 'undefined') return defaultSnapshot()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSnapshot()
    return normalize(JSON.parse(raw))
  } catch {
    return defaultSnapshot()
  }
}

let snapshot: SessionV2Snapshot = loadFromStorage()
const listeners = new Set<() => void>()
const clientId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2)}`

let bc: BroadcastChannel | null = null
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    bc = new BroadcastChannel(CHANNEL_NAME)
    bc.addEventListener('message', (ev: MessageEvent) => {
      const data = ev.data as { clientId?: string; snapshot?: SessionV2Snapshot } | undefined
      if (!data?.snapshot || data.clientId === clientId) return
      applyRemoteSnapshot(data.snapshot, 'broadcast')
    })
  } catch {
    bc = null
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || e.newValue == null) return
    try {
      const remote = normalize(JSON.parse(e.newValue))
      applyRemoteSnapshot(remote, 'storage')
    } catch {
      /* ignore */
    }
  })
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch (e) {
    console.error('session v2: could not persist to localStorage', e)
  }
}

function emit(): void {
  listeners.forEach((l) => l())
}

function applyRemoteSnapshot(remote: SessionV2Snapshot, _source: 'broadcast' | 'storage'): void {
  if (remote.revision < snapshot.revision) return
  snapshot = normalize(remote)
  emit()
}

function broadcast(): void {
  if (!bc) return
  try {
    bc.postMessage({ clientId, snapshot })
  } catch (e) {
    console.error('session v2: broadcast failed', e)
  }
}

export function getSessionV2Snapshot(): SessionV2Snapshot {
  return snapshot
}

export function subscribeSessionV2(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

type SessionPatch =
  | Partial<Omit<SessionV2Snapshot, 'version'>>
  | ((prev: SessionV2Snapshot) => Partial<Omit<SessionV2Snapshot, 'version'>>)

export function updateSessionV2(patch: SessionPatch): void {
  const prev = snapshot
  const partial = typeof patch === 'function' ? patch(prev) : patch
  const { revision: _ignoreRevision, ...rest } = partial as Partial<SessionV2Snapshot>
  snapshot = normalize({
    ...prev,
    ...rest,
    version: 2,
    revision: prev.revision + 1
  })
  persist()
  broadcast()
  emit()
}

export function resetSessionV2ToSelector(): void {
  const prev = snapshot
  snapshot = normalize({
    ...defaultSnapshot(),
    revision: prev.revision + 1,
    loadingStartedAt: null
  })
  persist()
  broadcast()
  emit()
}
