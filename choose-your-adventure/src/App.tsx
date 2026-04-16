import { useState, useEffect } from 'react'
import FocusSelector from './components/FocusSelector'
import StudyPages from './components/StudyPages'
import LoadingScreen from './components/LoadingScreen'
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

// Backend API configuration
// Set VITE_API_ENDPOINT in .env file or replace this URL with your actual API endpoint
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || 'https://your-api-endpoint.com/api/responses'

const saveResponseToBackend = async (data: {
  timestamp: string
  focusId: string
  answers: Record<string, string>
}): Promise<boolean> => {
  try {
    const response = await fetch(API_ENDPOINT, {
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
    const answerKeySet = new Set<string>()
    sorted.forEach((r) => {
      Object.keys(r.answers || {}).forEach((k) => answerKeySet.add(k))
    })
    const answerKeys = [...answerKeySet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    const headers = ['timestamp', 'focusId', ...answerKeys]
    const rows: string[][] = [headers]
    for (const r of sorted) {
      rows.push([
        r.timestamp || '',
        r.focusId || '',
        ...answerKeys.map((k) => r.answers?.[k] ?? '')
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

  // Retry pending responses when online
  useEffect(() => {
    const retryPendingResponses = async () => {
      try {
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
