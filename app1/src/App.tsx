import { useState, useEffect } from 'react'
import TerminalScreen from './components/TerminalScreen'
import './App.css'

// IndexedDB setup
const DB_NAME = 'UserFeedbackDB'
const DB_VERSION = 1
const STORE_NAME = 'responses'

const STORAGE_KEY_ON_DASHBOARD = 'wizardOnDashboard'
const STORAGE_KEY_SESSION_RESPONSES = 'dashboardSessionResponses'

// Backend API configuration
// Set VITE_API_ENDPOINT in .env file or replace this URL with your actual API endpoint
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || 'https://your-api-endpoint.com/api/responses'

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

const saveResponseToBackend = async (data: {
  timestamp: string
  question: string
  jobRole: string
  format: string
  location: string
  autonomy: string
  buyingRole: string
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
  question: string
  jobRole: string
  format: string
  location: string
  autonomy: string
  buyingRole: string
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
    const backupKey = 'userFeedbackBackup'
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
      const pendingKey = 'userFeedbackPending'
      const pending = localStorage.getItem(pendingKey)
      const pendingData = pending ? JSON.parse(pending) : []
      pendingData.push(data)
      localStorage.setItem(pendingKey, JSON.stringify(pendingData))
    } catch (error) {
      console.error('Error saving pending response:', error)
    }
  }
}

const getAllResponses = async (): Promise<any[]> => {
  // Try IndexedDB first (primary storage)
  try {
    const db = await initDB()
    const indexedDBData = await new Promise<any[]>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    // If IndexedDB has data, use it and sync to localStorage backup
    if (indexedDBData && indexedDBData.length > 0) {
      try {
        localStorage.setItem('userFeedbackBackup', JSON.stringify(indexedDBData))
      } catch (error) {
        console.error('Error syncing to localStorage backup:', error)
      }
      return indexedDBData
    }
  } catch (error) {
    console.error('Error reading from IndexedDB, falling back to localStorage:', error)
  }

  // Fallback to localStorage backup
  try {
    const backupKey = 'userFeedbackBackup'
    const backupData = localStorage.getItem(backupKey)
    if (backupData) {
      const parsed = JSON.parse(backupData)
      console.log('Loaded responses from localStorage backup')
      return parsed
    }
  } catch (error) {
    console.error('Error reading from localStorage backup:', error)
  }

  return []
}

function App() {
  const [inputValue, setInputValue] = useState('')
  const [showQuestions, setShowQuestions] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(1)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showDashboard, setShowDashboard] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)
  const [sessionResponses, setSessionResponses] = useState<Array<{ timestamp: string; question: string; jobRole: string; format: string; location: string; autonomy: string; buyingRole: string }>>([])

  // Retry pending responses when online
  useEffect(() => {
    const retryPendingResponses = async () => {
      try {
        const pendingKey = 'userFeedbackPending'
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
  const [dashboardData, setDashboardData] = useState<{
    wordCloud: Array<{ word: string; count: number }>
    stats: {
      formatStats: Record<string, number>
      locationStats: Record<string, number>
      autonomyStats: Record<string, number>
    }
  } | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    // Save to localStorage as user types
    localStorage.setItem('firstScreenInput', value)
  }

  useEffect(() => {
    // Load saved input from localStorage on mount
    const savedInput = localStorage.getItem('firstScreenInput')
    if (savedInput) {
      setInputValue(savedInput)
    }
  }, [])

  useEffect(() => {
    const onDashboard = sessionStorage.getItem(STORAGE_KEY_ON_DASHBOARD)
    if (onDashboard) {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY_SESSION_RESPONSES)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) setSessionResponses(parsed)
        }
      } catch (e) {
        console.error('Error restoring session responses:', e)
      }
      setShowDashboard(true)
    }
  }, [])

  const extractWords = (text: string): string[] => {
    // Common stop words to exclude
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
      'when', 'where', 'why', 'how', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
      'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'both', 'few',
      'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 'just', 'now'
    ])

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
  }

  const calculateWordCloud = (responses: any[]): Array<{ word: string; count: number }> => {
    const wordCounts: Record<string, number> = {}
    
    // Extract words from the first input field (question field) of all responses
    responses.forEach(response => {
      if (response.question) {
        const words = extractWords(response.question)
        words.forEach(word => {
          wordCounts[word] = (wordCounts[word] || 0) + 1
        })
      }
    })

    return Object.entries(wordCounts)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15) // Top 15 words
  }

  const calculateStats = (responses: any[]) => {
    const formatStats: Record<string, number> = {}
    const locationStats: Record<string, number> = {}
    const autonomyStats: Record<string, number> = {}
    const total = responses.length

    responses.forEach(response => {
      if (response.format) {
        formatStats[response.format] = (formatStats[response.format] || 0) + 1
      }
      if (response.location) {
        locationStats[response.location] = (locationStats[response.location] || 0) + 1
      }
      if (response.autonomy) {
        autonomyStats[response.autonomy] = (autonomyStats[response.autonomy] || 0) + 1
      }
    })

    return {
      formatStats: Object.fromEntries(
        Object.entries(formatStats).map(([key, count]) => [
          key,
          Math.round((count / total) * 100)
        ])
      ),
      locationStats: Object.fromEntries(
        Object.entries(locationStats).map(([key, count]) => [
          key,
          Math.round((count / total) * 100)
        ])
      ),
      autonomyStats: Object.fromEntries(
        Object.entries(autonomyStats).map(([key, count]) => [
          key,
          Math.round((count / total) * 100)
        ])
      )
    }
  }

  const loadDashboardData = async () => {
    try {
      const responsesForStats = sessionResponses
      let allResponses: any[] = []
      try {
        allResponses = await getAllResponses()
      } catch (e) {
        console.error('Error loading responses for word cloud:', e)
      }
      const wordCloud = allResponses.length > 0 ? calculateWordCloud(allResponses) : []
      const stats =
        responsesForStats.length > 0
          ? calculateStats(responsesForStats)
          : { formatStats: {}, locationStats: {}, autonomyStats: {} }
      setDashboardData({ wordCloud, stats })
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
  }

  const saveResponseToDB = async () => {
    try {
      const newResponse = {
        timestamp: new Date().toISOString(),
        question: inputValue || '',
        jobRole: answers.jobRole || '',
        format: answers.format || '',
        location: answers.location || '',
        autonomy: answers.autonomy || '',
        buyingRole: answers.buyingRole || ''
      }
      await saveResponse(newResponse)
      console.log('Response saved to IndexedDB')
      setSessionResponses(prev => [...prev, newResponse])
    } catch (error) {
      console.error('Error saving response:', error)
    }
  }

  const exportToCSV = async () => {
    try {
      const allResponses = await getAllResponses()
      
      // Create CSV headers
      const headers = ['Timestamp', 'Question', 'Job Role', 'Format Preference', 'Location', 'Autonomy Level', 'Tech Buying Role']
      const rows = [headers]

      // Add all responses
      allResponses.forEach(response => {
        rows.push([
          response.timestamp || '',
          response.question || '',
          response.jobRole || '',
          response.format || '',
          response.location || '',
          response.autonomy || '',
          response.buyingRole || ''
        ])
      })

      // Convert to CSV format
      const csvContent = rows.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n')

      // Download the CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      link.setAttribute('download', 'user-feedback-responses.csv')
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting CSV:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showQuestions) {
      // First submit - validate input is not empty
      if (!inputValue || !inputValue.trim()) {
        return // Don't proceed if input is empty or only whitespace
      }
      // First submit - show loading state for 2 seconds
      setIsLoading(true)
      setTimeout(() => {
        setIsLoading(false)
        setShowQuestions(true)
        setCurrentQuestion(1)
      }, 2000)
    } else if (currentQuestion < 5) {
      // Move to next question
      setCurrentQuestion(prev => prev + 1)
    } else {
      // Final submission - show loading state for 2 seconds before dashboard
      setIsLoadingDashboard(true)
      await saveResponseToDB()
      setTimeout(() => {
        setIsLoadingDashboard(false)
        setShowDashboard(true)
        sessionStorage.setItem(STORAGE_KEY_ON_DASHBOARD, '1')
      }, 2000)
    }
  }

  useEffect(() => {
    if (showDashboard) {
      sessionStorage.setItem(STORAGE_KEY_ON_DASHBOARD, '1')
      loadDashboardData()
    }
  }, [showDashboard, sessionResponses])

  useEffect(() => {
    if (sessionResponses.length > 0) {
      sessionStorage.setItem(STORAGE_KEY_SESSION_RESPONSES, JSON.stringify(sessionResponses))
    }
  }, [sessionResponses])

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handleNextQuestion = () => {
    if (currentQuestion < 5) {
      setCurrentQuestion(prev => prev + 1)
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestion > 1) {
      setCurrentQuestion(prev => prev - 1)
    }
  }

  const handleStartOver = () => {
    setInputValue('')
    localStorage.removeItem('firstScreenInput')
    setShowQuestions(false)
    setCurrentQuestion(1)
    setAnswers({})
    setShowDashboard(false)
    setIsLoading(false)
    setIsLoadingDashboard(false)
    setSessionResponses([])
    sessionStorage.removeItem(STORAGE_KEY_ON_DASHBOARD)
    sessionStorage.removeItem(STORAGE_KEY_SESSION_RESPONSES)
  }

  const handleAdjustInput = () => {
    setShowQuestions(false)
    setIsLoading(false)
  }

  return (
    <div className="app">
      <TerminalScreen
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        showQuestions={showQuestions}
        currentQuestion={currentQuestion}
        answers={answers}
        onAnswerChange={handleAnswerChange}
        onNextQuestion={handleNextQuestion}
        onPreviousQuestion={handlePreviousQuestion}
        showDashboard={showDashboard}
        onStartOver={handleStartOver}
        onExportCSV={exportToCSV}
        dashboardData={dashboardData}
        isLoading={isLoading}
        isLoadingDashboard={isLoadingDashboard}
        onAdjustInput={handleAdjustInput}
      />
    </div>
  )
}

export default App
