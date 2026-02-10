import { useState, useEffect } from 'react'
import TerminalScreen from './components/TerminalScreen'
import './App.css'

// IndexedDB setup
const DB_NAME = 'UserFeedbackDB'
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

const saveResponse = async (data: {
  timestamp: string
  question: string
  format: string
  location: string
  autonomy: string
}) => {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(data)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const getAllResponses = async (): Promise<any[]> => {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function App() {
  const [inputValue, setInputValue] = useState('')
  const [showQuestions, setShowQuestions] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(1)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showDashboard, setShowDashboard] = useState(false)
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
      const responses = await getAllResponses()
      if (responses.length > 0) {
        const wordCloud = calculateWordCloud(responses)
        const stats = calculateStats(responses)
        setDashboardData({ wordCloud, stats })
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
  }

  const saveResponseToDB = async () => {
    try {
      await saveResponse({
        timestamp: new Date().toISOString(),
        question: inputValue || '',
        format: answers.format || '',
        location: answers.location || '',
        autonomy: answers.autonomy || ''
      })
      console.log('Response saved to IndexedDB')
      // Reload dashboard data after saving
      await loadDashboardData()
    } catch (error) {
      console.error('Error saving response:', error)
    }
  }

  const exportToCSV = async () => {
    try {
      const allResponses = await getAllResponses()
      
      // Create CSV headers
      const headers = ['Timestamp', 'Question', 'Format Preference', 'Location', 'Autonomy Level']
      const rows = [headers]

      // Add all responses
      allResponses.forEach(response => {
        rows.push([
          response.timestamp || '',
          response.question || '',
          response.format || '',
          response.location || '',
          response.autonomy || ''
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
      // First submit - show questions
      setShowQuestions(true)
      setCurrentQuestion(1)
    } else if (currentQuestion < 3) {
      // Move to next question
      setCurrentQuestion(prev => prev + 1)
    } else {
      // Final submission
      console.log('Query submitted:', inputValue)
      console.log('Answers:', answers)
      await saveResponseToDB()
      setShowDashboard(true)
    }
  }

  useEffect(() => {
    if (showDashboard) {
      loadDashboardData()
    }
  }, [showDashboard])

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handleNextQuestion = () => {
    if (currentQuestion < 3) {
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
      />
    </div>
  )
}

export default App
