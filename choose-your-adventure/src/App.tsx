import { useState, useEffect, useCallback, useMemo } from 'react'
import FocusSelector from './components/FocusSelector'
import StudyPages from './components/StudyPages'
import LoadingScreen from './components/LoadingScreen'
import { getAppViewModeFromLocation, type AppViewMode } from './appViewMode'
import { saveResponse, exportResponsesToCsv, retryPendingResponsesOnce } from './studyPersistence'
import './App.css'

function App() {
  const viewMode = useMemo<AppViewMode>(() => getAppViewModeFromLocation(), [])
  const isModeratorView = viewMode === 'moderator'

  const [selectedFocus, setSelectedFocus] = useState<string | null>(null)
  const [sessionParticipantId, setSessionParticipantId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showStudy, setShowStudy] = useState(false)

  // Retry pending responses when online (only if a real API URL is configured)
  useEffect(() => {
    const onOnline = () => {
      void retryPendingResponsesOnce()
    }
    window.addEventListener('online', onOnline)
    if (navigator.onLine) void retryPendingResponsesOnce()
    return () => window.removeEventListener('online', onOnline)
  }, [])

  const handleFocusSelect = (focus: string) => {
    setSelectedFocus(focus)
  }

  const handleClearFocusSelection = () => {
    setSelectedFocus(null)
  }

  const handleTakeStudy = useCallback((participantId: string, focusOverride?: string | null) => {
    const focus = focusOverride ?? selectedFocus
    if (!focus) return
    if (focusOverride) setSelectedFocus(focus)
    setSessionParticipantId(participantId)
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setShowStudy(true)
    }, 1500)
  }, [selectedFocus])

  const handleBackToSelection = () => {
    setShowStudy(false)
    setSelectedFocus(null)
    setSessionParticipantId('')
  }

  const handleStudyComplete = async (focusId: string, answers: Record<string, string>) => {
    await saveResponse({
      timestamp: new Date().toISOString(),
      focusId,
      answers,
      participantId: sessionParticipantId || undefined
    })
  }

  if (isLoading) {
    return <LoadingScreen message="Preparing" />
  }

  if (showStudy && selectedFocus) {
    return (
      <StudyPages
        key={selectedFocus}
        focusId={selectedFocus}
        moderatorMode={isModeratorView}
        onBack={handleBackToSelection}
        onComplete={handleStudyComplete}
        onExportCsv={isModeratorView ? exportResponsesToCsv : undefined}
      />
    )
  }

  return (
    <div className="app">
      <FocusSelector
        viewMode={viewMode}
        onFocusSelect={handleFocusSelect}
        onClearFocusSelection={handleClearFocusSelection}
        selectedFocus={selectedFocus}
        onTakeStudy={handleTakeStudy}
        onExportCsv={isModeratorView ? exportResponsesToCsv : undefined}
      />
      {import.meta.env.DEV && (
        <div data-build="dev-indicator" style={{ position: 'fixed', bottom: 8, right: 8, fontSize: 10, color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}>
          dev · Study detail modal · http://localhost:5181
        </div>
      )}
    </div>
  )
}

export default App
