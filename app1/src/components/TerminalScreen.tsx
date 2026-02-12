import { useState, useEffect } from 'react'
import './TerminalScreen.css'
import logoImage from '../images/Logo-Red_Hat-A-White-RGB.svg'
import qrCodeImage from '../images/qr-code.svg'

interface TerminalScreenProps {
  inputValue: string
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: (e: React.FormEvent) => void
  showQuestions: boolean
  currentQuestion: number
  answers: Record<string, string>
  onAnswerChange: (questionId: string, value: string) => void
  onNextQuestion: () => void
  onPreviousQuestion: () => void
  showDashboard: boolean
  onStartOver: () => void
  onExportCSV: () => void
  dashboardData: {
    wordCloud: Array<{ word: string; count: number }>
    stats: {
      formatStats: Record<string, number>
      locationStats: Record<string, number>
      autonomyStats: Record<string, number>
    }
  } | null
  isLoading: boolean
  isLoadingDashboard: boolean
  onAdjustInput: () => void
}

function TerminalScreen({ inputValue, onInputChange, onSubmit, showQuestions, currentQuestion, answers, onAnswerChange, onNextQuestion, onPreviousQuestion, showDashboard, onStartOver, onExportCSV, dashboardData, isLoading, isLoadingDashboard, onAdjustInput }: TerminalScreenProps) {
  const [otherInputValue, setOtherInputValue] = useState('')
  const [otherInputValue2, setOtherInputValue2] = useState('')
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0)
  const [fadeKey, setFadeKey] = useState(0)
  
  const cyclingPrompts = [
    "Example prompt: 'Compare OpenShift cost vs. DIY K8s'",
    "Example prompt: 'Generate a security audit script for RHEL 9'",
    "Example prompt: 'Show me migration steps from CentOS to RHEL'",
    "Example prompt: 'Create an Ansible playbook for server hardening'",
    "Example prompt: 'Explain OpenShift networking architecture'",
    "Example prompt: 'Help me troubleshoot container startup failures'"
  ]
  
  const handleStartOver = () => {
    // Reset prompt cycling
    setCurrentPromptIndex(0)
    setFadeKey(0)
    onStartOver()
  }

  // Cycle through prompts with fade animation
  useEffect(() => {
    if (showQuestions || showDashboard) return
    
    const interval = setInterval(() => {
      // Change text and trigger animation restart simultaneously
      setCurrentPromptIndex((prev) => (prev + 1) % cyclingPrompts.length)
      setFadeKey((prev) => prev + 1)
    }, 4000) // Change prompt every 4 seconds

    return () => clearInterval(interval)
  }, [showQuestions, showDashboard, cyclingPrompts.length])

  const personaOptions = [
    {
      value: "The builder (developer / architect) – I create new things.",
      icon: (
        <svg className="persona-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        </svg>
      )
    },
    {
      value: "The operator (sysadmin / ops / sre) – I keep the lights on.",
      icon: (
        <svg className="persona-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          <path d="M12 5a7 7 0 0 0-7 7" />
          <path d="M12 19a7 7 0 0 1 7-7" />
        </svg>
      )
    },
    {
      value: "The defender (security / compliance) – I manage risk.",
      icon: (
        <svg className="persona-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    },
    {
      value: "The strategist (cio / vp / director) – I manage budget and vision.",
      icon: (
        <svg className="persona-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      )
    }
  ]

  const formatOptions = [
    "A summary (3 bullet points max)",
    "A technical deep dive (whitepaper/docs)",
    "Ready to use code (CLI/api snippet)",
    "Visual proof (charts/diagrams)",
    "Other"
  ]

  const locationOptions = [
    "Justifying budget/strategy",
    "Fixing a critical issue",
    "Researching",
    "During implementation",
    "Other"
  ]

  const autonomyOptions = [
    { value: "1", label: "1 - I need to verify every word" },
    { value: "2", label: "2 - Show me a draft first, then I'll approve" },
    { value: "3", label: "3 - Give me options, I'll choose" },
    { value: "4", label: "4 - Execute with minimal confirmation" },
    { value: "5", label: "5 - Fix it automatically; don't even ask me" }
  ]

  const buyingRoleOptions = [
    "The explorer (I research and find solutions)",
    "The validator (I test it to see if it breaks)",
    "The champion (I pitch it to my boss)",
    "The signer (I approve the budget)"
  ]


  const handleClear = () => {
    const syntheticEvent = {
      target: { value: '' }
    } as React.ChangeEvent<HTMLInputElement>
    onInputChange(syntheticEvent)
  }

  const isOtherSelected = answers.format === 'Other' || (answers.format && !formatOptions.slice(0, -1).includes(answers.format))
  const isOtherSelected2 = answers.location === 'Other' || (answers.location && !locationOptions.slice(0, -1).includes(answers.location))

  const handlePersonaSelect = (value: string) => {
    onAnswerChange('jobRole', value)
  }

  const handleFormatSelect = (option: string) => {
    if (option === 'Other') {
      onAnswerChange('format', 'Other')
      // Keep otherInputValue if it exists, otherwise focus will be handled by autoFocus
    } else {
      onAnswerChange('format', option)
      setOtherInputValue('')
    }
  }

  const handleOtherInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setOtherInputValue(value)
    // Store custom value, but keep "Other" as the selected option indicator
    onAnswerChange('format', value || 'Other')
  }

  const handleLocationSelect = (option: string) => {
    if (option === 'Other') {
      onAnswerChange('location', 'Other')
    } else {
      onAnswerChange('location', option)
      setOtherInputValue2('')
    }
  }

  const handleOtherInputChange2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setOtherInputValue2(value)
    onAnswerChange('location', value || 'Other')
  }

  const handleAutonomySelect = (value: string) => {
    onAnswerChange('autonomy', value)
  }

  const handleBuyingRoleSelect = (option: string) => {
    onAnswerChange('buyingRole', option)
  }

  const canProceed = () => {
    if (currentQuestion === 1) {
      return answers.format && (answers.format !== 'Other' || otherInputValue.trim())
    }
    if (currentQuestion === 2) {
      return answers.location && (answers.location !== 'Other' || otherInputValue2.trim())
    }
    if (currentQuestion === 3) {
      return !!answers.autonomy
    }
    if (currentQuestion === 4) {
      return !!answers.jobRole
    }
    if (currentQuestion === 5) {
      return !!answers.buyingRole
    }
    return false
  }

  return (
    <div className="terminal-screen">
      {isLoadingDashboard ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p className="loading-text">Analyzing</p>
        </div>
      ) : showDashboard ? (
        <div className="dashboard-container">
          <div
            className="dashboard-actions"
            data-actions-position="top"
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              flexShrink: 0,
              padding: '0.5rem 0',
              position: 'sticky',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              background: '#0f0f0f',
              borderBottom: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <button
              type="button"
              onClick={handleStartOver}
              className="start-over-button"
            >
              <span className="start-over-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </span>
              Start over
            </button>
            <button
              type="button"
              onClick={onExportCSV}
              className="export-csv-button"
            >
              Export responses to CSV
            </button>
          </div>
          <div className="dashboard-headline-section">
            <h1 className="dashboard-headline">You aren't alone!</h1>
            <p className="dashboard-subheadline">Your questions are unique, but others have asked similar ones. <br />This will help us build new features and improve our websites.</p>
          </div>
          
          <div className="dashboard-main-layout">
            {/* Left Side - Main Content */}
            <div className="dashboard-content">
              {/* Word Cloud */}
              <div className="word-cloud-section">
                <h2 className="section-title">Common terms</h2>
                <div className="word-cloud">
                  {dashboardData && dashboardData.wordCloud.length > 0 ? (
                    dashboardData.wordCloud.map((item, index) => {
                      // Determine size based on count (larger count = larger word)
                      let sizeClass = 'word-small'
                      const maxCount = dashboardData.wordCloud[0].count
                      const ratio = item.count / maxCount
                      
                      if (ratio > 0.7) {
                        sizeClass = 'word-large'
                      } else if (ratio > 0.4) {
                        sizeClass = 'word-medium'
                      }
                      
                      return (
                        <span key={index} className={`word ${sizeClass}`} title={`${item.count} occurrence${item.count > 1 ? 's' : ''}`}>
                          {item.word}
                        </span>
                      )
                    })
                  ) : (
                    <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>
                      No responses yet. Submit a response to see word cloud.
                    </p>
                  )}
                </div>
              </div>

              {/* Peer Stats */}
              <div className="peer-stats-section">
                <h2 className="section-title">Common responses</h2>
                {dashboardData && dashboardData.stats ? (
                  <>
                    <div className="peer-stats-grid">
                      <div className="stat-card">
                        <div className="stat-value">{dashboardData.stats.formatStats['Ready to use code (CLI/api snippet)'] ?? 0}%</div>
                        <div className="stat-label">of attendees also want CLI snippets</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value">{dashboardData.stats.locationStats['Fixing a critical issue'] ?? 0}%</div>
                        <div className="stat-label">are fixing critical issues</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value">{dashboardData.stats.formatStats['A technical deep dive (whitepaper/docs)'] ?? 0}%</div>
                        <div className="stat-label">prefer technical deep dives</div>
                      </div>
                    </div>
                    {Object.keys(dashboardData.stats.formatStats).length === 0 && 
                     Object.keys(dashboardData.stats.locationStats).length === 0 && (
                      <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic', textAlign: 'center' }}>
                        No peer data yet. More responses needed.
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic', textAlign: 'center' }}>
                    Loading peer statistics...
                  </p>
                )}
              </div>
            </div>

            {/* Right Side - Steps Sidebar */}
            <div className="dashboard-sidebar">
              <div className="step-box">
                <h3 className="step-title">Step 1</h3>
                <p className="step-text">Don't forget to retrieve your swag from the front desk!</p>
              </div>
              <div className="step-box">
                <h3 className="step-title">Step 2</h3>
                <div className="qr-code-container">
                  <img src={qrCodeImage} alt="QR Code" className="qr-code-image" />
                </div>
                <p className="step-text">Join our research community</p>
              </div>
              <div className="step-box">
                <h3 className="step-title">Step 3</h3>
                <p className="step-text">Join another usability study!</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="terminal-content">
          {/* Logo Section */}
          <div className="logo-container">
            <div className="logo-placeholder">
              <img src={logoImage} alt="Red Hat Logo" className="logo-image" />
            </div>
            {showQuestions && inputValue && (
              <div className="input-display">
                <p className="input-display-text">
                  <span className="input-display-label">Your response:</span> {inputValue}
                </p>
              </div>
            )}
          </div>

          {/* Headline and Input Section */}
          <div className="input-section">
          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p className="loading-text">Processing your request...</p>
            </div>
          ) : !showQuestions ? (
            <>
              <h1 className="headline">
                Imagine you have a direct line to our entire technical and business database. No menus, no sales calls.<br />
                <strong>What do you need to know right now?</strong>
              </h1>
              
              <form onSubmit={onSubmit} className="input-form">
                <div className="input-row">
                  <div className="input-wrapper">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={onInputChange}
                      placeholder="admin@redhat-future:~$ "
                      className="terminal-input"
                      autoFocus
                    />
                    {inputValue && (
                      <button
                        type="button"
                        onClick={handleClear}
                        className="clear-button"
                        aria-label="Clear input"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <button 
                    type="submit" 
                    className="go-button"
                    disabled={!inputValue || !inputValue.trim()}
                  >
                    &gt; Execute
                  </button>
                </div>
                <div className="cycling-prompt-wrapper">
                  <div key={fadeKey} className="cycling-prompt">
                    {cyclingPrompts[currentPromptIndex]}
                  </div>
                </div>
              </form>
            </>
          ) : (
            <div className="questions-container">
              <h2 className="question-title">Question {currentQuestion} of 5</h2>
              
              {currentQuestion === 1 && (
                <>
                  <p className="question-text">
                    If we could generate this answer instantly, what format would be most useful?
                  </p>
                  
                  <div className="question-options">
                    {formatOptions.map((option, index) => {
                      const isSelected = option === 'Other' 
                        ? isOtherSelected 
                        : answers.format === option
                      return (
                        <button
                          key={index}
                          type="button"
                          className={`question-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleFormatSelect(option)}
                        >
                          <span>{option}</span>
                          {isSelected && <span className="checkmark">✓</span>}
                        </button>
                      )
                    })}
                  </div>

                  {isOtherSelected && (
                    <div className="other-input-wrapper">
                      <input
                        type="text"
                        value={otherInputValue}
                        onChange={handleOtherInputChange}
                        placeholder="Please specify..."
                        className="terminal-input"
                        autoFocus
                      />
                    </div>
                  )}
                </>
              )}

              {currentQuestion === 2 && (
                <>
                  <p className="question-text">
                    Where are you usually sitting when this question comes up?
                  </p>
                  
                  <div className="question-options">
                    {locationOptions.map((option, index) => {
                      const isSelected = option === 'Other' 
                        ? isOtherSelected2 
                        : answers.location === option
                      return (
                        <button
                          key={index}
                          type="button"
                          className={`question-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleLocationSelect(option)}
                        >
                          <span>{option}</span>
                          {isSelected && <span className="checkmark">✓</span>}
                        </button>
                      )
                    })}
                  </div>

                  {isOtherSelected2 && (
                    <div className="other-input-wrapper">
                      <input
                        type="text"
                        value={otherInputValue2}
                        onChange={handleOtherInputChange2}
                        placeholder="Please specify..."
                        className="terminal-input"
                        autoFocus
                      />
                    </div>
                  )}
                </>
              )}

              {currentQuestion === 3 && (
                <>
                  <p className="question-text">
                    For this specific task, how much autonomy would you give an AI agent?
                  </p>
                  
                  <div className="question-options">
                    {autonomyOptions.map((option) => {
                      const isSelected = answers.autonomy === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`question-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleAutonomySelect(option.value)}
                        >
                          <span>{option.label}</span>
                          {isSelected && <span className="checkmark">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {currentQuestion === 4 && (
                <>
                  <p className="question-text">
                    To customize your future interface, tell us how you spend your day.
                  </p>
                  
                  <div className="persona-options">
                    {personaOptions.map((option, index) => {
                      const isSelected = answers.jobRole === option.value
                      return (
                        <button
                          key={index}
                          type="button"
                          className={`persona-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => handlePersonaSelect(option.value)}
                        >
                          <span className="persona-icon-wrap">{option.icon}</span>
                          <span className="persona-label">{option.value}</span>
                          {isSelected && <span className="checkmark">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {currentQuestion === 5 && (
                <>
                  <p className="question-text">
                    When it comes to buying new tech, what is your role?
                  </p>
                  
                  <div className="question-options">
                    {buyingRoleOptions.map((option, index) => {
                      const isSelected = answers.buyingRole === option
                      return (
                        <button
                          key={index}
                          type="button"
                          className={`question-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleBuyingRoleSelect(option)}
                        >
                          <span>{option}</span>
                          {isSelected && <span className="checkmark">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <div className="question-navigation">
                {currentQuestion === 1 && (
                  <button
                    type="button"
                    onClick={onAdjustInput}
                    className="adjust-input-button"
                  >
                    Adjust my input
                  </button>
                )}
                {currentQuestion > 1 && (
                  <button
                    type="button"
                    onClick={onPreviousQuestion}
                    className="previous-button"
                  >
                    Previous
                  </button>
                )}
                {canProceed() && (
                  <button
                    type="button"
                    onClick={currentQuestion === 5 ? onSubmit : onNextQuestion}
                    className="go-button"
                  >
                    {currentQuestion === 5 ? 'Submit' : 'Next'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

export default TerminalScreen
