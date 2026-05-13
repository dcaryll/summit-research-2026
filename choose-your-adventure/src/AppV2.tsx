import { useCallback, useEffect, useMemo } from 'react'
import FocusSelector from './components/FocusSelector'
import StudyPages, { type StudySessionSyncState } from './components/StudyPages'
import LoadingScreen from './components/LoadingScreen'
import { getAppViewModeFromLocation, type AppViewMode } from './appViewMode'
import { exportResponsesToCsv, retryPendingResponsesOnce, saveResponse } from './studyPersistence'
import { useSessionV2Store } from './sessionV2/useSessionV2Store'
import { resetSessionV2ToSelector, updateSessionV2 } from './sessionV2/crossWindowSessionStore'
import './App.css'

const LOADING_MS = 1500

/**
 * Multi-window session: open the same origin with `?v=2` (participant) and `?v=2&moderator=1`
 * (moderator tools). State is shared via `localStorage` + `BroadcastChannel`.
 * Participant `?v=2` does not start from the grid alone; use **Continue to session** in the detail modal
 * (after the facilitator enters the participant ID) or wait for **Moderator: start this activity**. Use `?v=2&solo=1`
 * for self-serve testing on one machine.
 */
export default function AppV2() {
  const viewMode = useMemo<AppViewMode>(() => getAppViewModeFromLocation(), [])
  const isModeratorView = viewMode === 'moderator'
  const isParticipantView = viewMode === 'participant'
  const soloParticipantMayStart = useMemo(
    () => new URLSearchParams(window.location.search).get('solo') === '1',
    []
  )
  const mirrorParticipantSelectionOnly = !isModeratorView && !soloParticipantMayStart
  const [snap] = useSessionV2Store()

  useEffect(() => {
    const onOnline = () => {
      void retryPendingResponsesOnce()
    }
    window.addEventListener('online', onOnline)
    if (navigator.onLine) void retryPendingResponsesOnce()
    return () => window.removeEventListener('online', onOnline)
  }, [])

  useEffect(() => {
    if (snap.phase !== 'loading' || snap.loadingStartedAt == null) return
    const deadline = snap.loadingStartedAt + LOADING_MS
    const delay = Math.max(0, deadline - Date.now())
    const id = window.setTimeout(() => {
      updateSessionV2({ phase: 'study', loadingStartedAt: null })
    }, delay)
    return () => window.clearTimeout(id)
  }, [snap.phase, snap.loadingStartedAt])

  const handleFocusSelect = useCallback((focus: string) => {
    updateSessionV2({ focusId: focus })
  }, [])

  const onSyncedStudyDetailModalChange = useCallback(
    (focusId: string | null) => {
      if (focusId === null) {
        if (mirrorParticipantSelectionOnly) {
          updateSessionV2({ studyDetailModalFocusId: null })
        } else {
          updateSessionV2({
            focusId: null,
            studyDetailModalFocusId: null,
            moderatorParticipantIdDraft: ''
          })
        }
        return
      }
      updateSessionV2({
        focusId: focusId,
        studyDetailModalFocusId: focusId,
        moderatorParticipantIdDraft: ''
      })
    },
    [mirrorParticipantSelectionOnly]
  )

  const onSyncedModeratorParticipantIdDraftChange = useCallback((draft: string) => {
    updateSessionV2({ moderatorParticipantIdDraft: draft })
  }, [])

  const handleTakeStudy = useCallback(
    (participantId: string, focusOverride?: string | null) => {
      if (snap.phase !== 'selector') return
      const nextFocus = focusOverride ?? snap.focusId
      if (!nextFocus) return
      updateSessionV2({
        focusId: nextFocus,
        participantId,
        phase: 'loading',
        loadingStartedAt: Date.now(),
        currentPageIndex: 0,
        answers: {},
        showCompletion: false,
        isLoadingCompletion: false,
        studyDetailModalFocusId: null,
        moderatorParticipantIdDraft: ''
      })
    },
    [snap.focusId, snap.phase]
  )

  const handleBackToSelection = useCallback(() => {
    resetSessionV2ToSelector()
  }, [])

  const handleStudyComplete = useCallback(
    async (focusId: string, answers: Record<string, string>, durationMs?: number) => {
      await saveResponse({
        timestamp: new Date().toISOString(),
        focusId,
        answers,
        participantId: snap.participantId || undefined,
        durationMs
      })
    },
    [snap.participantId]
  )

  const studySessionSync = useMemo<StudySessionSyncState>(
    () => ({
      answers: snap.answers,
      setAnswers: (action) =>
        updateSessionV2((prev) => ({
          answers: typeof action === 'function' ? action(prev.answers) : action
        })),
      currentPageIndex: snap.currentPageIndex,
      setCurrentPageIndex: (action) =>
        updateSessionV2((prev) => ({
          currentPageIndex:
            typeof action === 'function' ? action(prev.currentPageIndex) : action
        })),
      showCompletion: snap.showCompletion,
      setShowCompletion: (action) =>
        updateSessionV2((prev) => ({
          showCompletion: typeof action === 'function' ? action(prev.showCompletion) : action
        })),
      isLoadingCompletion: snap.isLoadingCompletion,
      setIsLoadingCompletion: (action) =>
        updateSessionV2((prev) => ({
          isLoadingCompletion:
            typeof action === 'function' ? action(prev.isLoadingCompletion) : action
        }))
    }),
    [snap.answers, snap.currentPageIndex, snap.showCompletion, snap.isLoadingCompletion]
  )

  if (snap.phase === 'loading') {
    return <LoadingScreen message="Preparing" showRunnerGame={isParticipantView} />
  }

  if (snap.phase === 'study' && snap.focusId) {
    return (
      <StudyPages
        key={snap.focusId}
        focusId={snap.focusId}
        moderatorMode={isModeratorView}
        onBack={handleBackToSelection}
        onComplete={handleStudyComplete}
        onExportCsv={isModeratorView ? exportResponsesToCsv : undefined}
        studySessionSync={studySessionSync}
      />
    )
  }

  return (
    <div className="app">
      <FocusSelector
        viewMode={viewMode}
        onFocusSelect={handleFocusSelect}
        selectedFocus={snap.focusId}
        onTakeStudy={handleTakeStudy}
        onExportCsv={isModeratorView ? exportResponsesToCsv : undefined}
        mirrorParticipantSelectionOnly={mirrorParticipantSelectionOnly}
        syncedStudyDetailModalFocusId={snap.studyDetailModalFocusId}
        onSyncedStudyDetailModalChange={onSyncedStudyDetailModalChange}
        syncedModeratorParticipantIdDraft={snap.moderatorParticipantIdDraft}
        onSyncedModeratorParticipantIdDraftChange={
          isModeratorView ? onSyncedModeratorParticipantIdDraftChange : undefined
        }
      />
      {import.meta.env.DEV && (
        <div
          data-build="dev-indicator"
          style={{
            position: 'fixed',
            bottom: 8,
            right: 8,
            fontSize: 10,
            color: 'rgba(255,255,255,0.5)',
            pointerEvents: 'none'
          }}
        >
          dev · v2 multi-window · http://localhost:5181
        </div>
      )}
    </div>
  )
}