import { useState, useEffect } from 'react'
import FocusSelector from './components/FocusSelector'
import StudyPages from './components/StudyPages'
import LoadingScreen from './components/LoadingScreen'
import { studyDisplayName } from './studyDisplayNames'
import './App.css'

// IndexedDB setup
const DB_NAME = 'UserStudyDB'
const DB_VERSION = 1
const STORE_NAME = 'responses'

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        objectStore.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

// Backend: set VITE_API_ENDPOINT in `.env` (e.g. `VITE_API_ENDPOINT=https://api.example.com/responses`).
// When unset, the app stays local-only (IndexedDB + localStorage) and does not POST or queue retries.
function getBackendApiEndpoint(): string | null {
  const url = (import.meta.env.VITE_API_ENDPOINT as string | undefined)?.trim()
  return url || null
}

const saveResponseToBackend = async (data: {
  timestamp: string
  focusId: string
  answers: Record<string, string>
}): Promise<boolean> => {
  const endpoint = getBackendApiEndpoint()
  if (!endpoint) {
    return true
  }
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`)
    }

    console.log('Response saved to backend successfully')
    return true
  } catch (error) {
    console.error('Error saving to backend:', error)
    return false
  }
}

const saveResponse = async (data: {
  timestamp: string
  focusId: string
  answers: Record<string, string>
}) => {
  // Try to save to backend first (primary storage)
  const backendSuccess = await saveResponseToBackend(data)

  // Always save locally as backup/offline fallback
  // Save to IndexedDB
  try {
    const db = await initDB()
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.add(data)

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Error saving to IndexedDB:', error)
  }

  // Backup to localStorage
  try {
    const backupKey = 'userStudyBackup'
    const existingBackup = localStorage.getItem(backupKey)
    const backupData = existingBackup ? JSON.parse(existingBackup) : []
    backupData.push({ ...data, id: Date.now() })
    // Keep only last 1000 responses to avoid exceeding localStorage limits
    const trimmedData = backupData.slice(-1000)
    localStorage.setItem(backupKey, JSON.stringify(trimmedData))
  } catch (error) {
    console.error('Error saving to localStorage backup:', error)
  }

  // If backend failed, mark for retry later
  if (!backendSuccess) {
    try {
      const pendingKey = 'userStudyPending'
      const pending = localStorage.getItem(pendingKey)
      const pendingData = pending ? JSON.parse(pending) : []
      pendingData.push(data)
      localStorage.setItem(pendingKey, JSON.stringify(pendingData))
    } catch (error) {
      console.error('Error saving pending response:', error)
    }
  }
}

type StoredStudyResponse = {
  id?: number
  timestamp: string
  focusId: string
  answers: Record<string, string>
}

const getAllResponses = async (): Promise<StoredStudyResponse[]> => {
  try {
    const db = await initDB()
    const indexedDBData = await new Promise<StoredStudyResponse[]>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
    if (indexedDBData.length > 0) {
      try {
        localStorage.setItem('userStudyBackup', JSON.stringify(indexedDBData))
      } catch (e) {
        console.error('Error syncing study backup to localStorage:', e)
      }
      return indexedDBData
    }
  } catch (error) {
    console.error('Error reading study responses from IndexedDB:', error)
  }
  try {
    const raw = localStorage.getItem('userStudyBackup')
    if (raw) {
      const parsed = JSON.parse(raw) as StoredStudyResponse[]
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (e) {
    console.error('Error reading study backup from localStorage:', e)
  }
  return []
}

function escapeCsvCell(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

type AnswerColumn = { focusId: string; answerKey: string }

function buildAnswerColumns(responses: StoredStudyResponse[]): AnswerColumn[] {
  const seen = new Set<string>()
  const out: AnswerColumn[] = []
  for (const r of responses) {
    const focusId = (r.focusId || '').trim()
    const keys = Object.keys(r.answers || {})
    for (const answerKey of keys) {
      const id = `${focusId}\u0000${answerKey}`
      if (seen.has(id)) continue
      seen.add(id)
      out.push({ focusId, answerKey })
    }
  }
  out.sort((a, b) => {
    const fc = a.focusId.localeCompare(b.focusId)
    if (fc !== 0) return fc
    return a.answerKey.localeCompare(b.answerKey, undefined, { numeric: true })
  })
  return out
}

function answerColumnHeader(col: AnswerColumn): string {
  const label = studyDisplayName(col.focusId)
  return `${label} — ${col.answerKey}`
}

/** If two studies share the same display title, duplicate headers get a `focusId` suffix. */
function resolveAnswerColumnHeaders(columns: AnswerColumn[]): string[] {
  const base = columns.map(answerColumnHeader)
  const counts = new Map<string, number>()
  for (const h of base) {
    counts.set(h, (counts.get(h) ?? 0) + 1)
  }
  return columns.map((col, i) => {
    const h = base[i]!
    if ((counts.get(h) ?? 0) <= 1) return h
    return `${studyDisplayName(col.focusId)} (${col.focusId}) — ${col.answerKey}`
  })
}

const exportResponsesToCsv = async () => {
  try {
    const all = await getAllResponses()
    if (all.length === 0) {
      window.alert(
        'No responses found to export. Responses are saved when a participant finishes a study.'
      )
      return
    }
    const sorted = [...all].sort((a, b) =>
      (a.timestamp || '').localeCompare(b.timestamp || '')
    )
    const answerColumns = buildAnswerColumns(sorted)
    const answerHeaders = resolveAnswerColumnHeaders(answerColumns)
    const headers = ['timestamp', 'focusId', ...answerHeaders]
    const rows: string[][] = [headers]
    for (const r of sorted) {
      const fid = (r.focusId || '').trim()
      rows.push([
        r.timestamp || '',
        r.focusId || '',
        ...answerColumns.map((col) =>
          col.focusId === fid ? (r.answers?.[col.answerKey] ?? '') : ''
        )
      ])
    }
    const csvBody = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
    const csvContent = `\uFEFF${csvBody}`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `summit-research-choose-your-adventure-responses-${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exporting study responses CSV:', error)
    window.alert('Could not export CSV. Check the console for details.')
  }
}

function App() {
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showStudy, setShowStudy] = useState(false)

  // Retry pending responses when online (only if a real API URL is configured)
  useEffect(() => {
    const retryPendingResponses = async () => {
      try {
        if (!getBackendApiEndpoint()) return

        const pendingKey = 'userStudyPending'
        const pending = localStorage.getItem(pendingKey)
        if (!pending) return

        const pendingData = JSON.parse(pending)
        if (pendingData.length === 0) return

        const successful: number[] = []
        for (let i = 0; i < pendingData.length; i++) {
          const success = await saveResponseToBackend(pendingData[i])
          if (success) {
            successful.push(i)
          }
        }

        // Remove successfully sent responses
        if (successful.length > 0) {
          const remaining = pendingData.filter((_: any, index: number) => !successful.includes(index))
          if (remaining.length > 0) {
            localStorage.setItem(pendingKey, JSON.stringify(remaining))
          } else {
            localStorage.removeItem(pendingKey)
          }
        }
      } catch (error) {
        console.error('Error retrying pending responses:', error)
      }
    }

    // Retry when coming online
    window.addEventListener('online', retryPendingResponses)
    
    // Also try immediately on mount if online
    if (navigator.onLine) {
      retryPendingResponses()
    }

    return () => {
      window.removeEventListener('online', retryPendingResponses)
    }
  }, [])

  const handleFocusSelect = (focus: string) => {
    setSelectedFocus(focus)
  }

  const handleClearFocusSelection = () => {
    setSelectedFocus(null)
  }

  const handleTakeStudy = () => {
    if (!selectedFocus) return
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setShowStudy(true)
    }, 1500)
  }

  const handleBackToSelection = () => {
    setShowStudy(false)
    setSelectedFocus(null)
  }

  const handleStudyComplete = async (focusId: string, answers: Record<string, string>) => {
    await saveResponse({
      timestamp: new Date().toISOString(),
      focusId,
      answers
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
        onBack={handleBackToSelection}
        onComplete={handleStudyComplete}
        onExportCsv={exportResponsesToCsv}
      />
    )
  }

  return (
    <div className="app">
      <FocusSelector
        onFocusSelect={handleFocusSelect}
        onClearFocusSelection={handleClearFocusSelection}
        selectedFocus={selectedFocus}
        onTakeStudy={handleTakeStudy}
        onExportCsv={exportResponsesToCsv}
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
