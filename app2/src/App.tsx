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
    return <StudyPages focusId={selectedFocus} onBack={handleBackToSelection} onComplete={handleStudyComplete} />
  }

  return (
    <div className="app">
      <FocusSelector 
        onFocusSelect={handleFocusSelect}
        selectedFocus={selectedFocus}
        onTakeStudy={handleTakeStudy}
      />
    </div>
  )
}

export default App
