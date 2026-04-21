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
      value: "The builder (Developer / Architect) – I create new things.",
      icon: (
        <svg className="persona-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        </svg>
      )
    },
    {
      value: "The operator (SysAdmin / Ops / SRE) – I keep the lights on.",
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
      value: "The defender (Security / Compliance) – I manage risk.",
      icon: (
        <svg className="persona-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )
    },
    {
      value: "The strategist (CIO / VP / Director) – I manage budget and vision.",
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
    "Interactive experience (animations/videos/slides)",
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
    { value: "1", label: "I need to verify every word" },
    { value: "2", label: "Show me a draft first, then I'll approve" },
    { value: "3", label: "Give me options, I'll choose" },
    { value: "4", label: "Execute with minimal confirmation" },
    { value: "5", label: "Fix it automatically; don't even ask me" }
  ]

  const buyingRoleOptions = [
    "I research and find solutions",
    "I test it to see if it breaks",
    "I pitch it to my boss",
    "I approve the budget"
  ]

  const timeToFindOptions = [
    "Instant",
    "Around 5 minutes",
    "Deep dive (30+ minutes)",
    "I would give up"
  ]

  const whereNextOptions = [
    "Google search",
    "ChatGPT / Claude / Gemini",
    "Community forums (Reddit / Stack Overflow / Spiceworks)",
    "My peer network (Slack / Discord groups)",
    "Your support line (Phone / Ticket)"
  ]


  const handleClear = () => {
    const syntheticEvent = {
      target: { value: '' }
    } as React.ChangeEvent<HTMLInputElement>
    onInputChange(syntheticEvent)
  }

  const isOtherSelected = Boolean(
    answers.format === 'Other' ||
      (!!answers.format && !formatOptions.slice(0, -1).includes(answers.format))
  )
  const isOtherSelected2 = Boolean(
    answers.location === 'Other' ||
      (!!answers.location && !locationOptions.slice(0, -1).includes(answers.location))
  )

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

  const handleTimeToFindSelect = (option: string) => {
    onAnswerChange('timeToFind', option)
  }

  const handleWhereNextSelect = (option: string) => {
    onAnswerChange('whereNext', option)
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
    if (currentQuestion === 6) {
      return !!answers.timeToFind
    }
    if (currentQuestion === 7) {
      return !!answers.whereNext
    }
    if (currentQuestion === 8) {
      return true
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
              padding: '0 0 0.5rem 0',
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
          <div className="dashboard-headline-row">
            <div className="dashboard-headline-section">
              <h1 className="dashboard-headline">You aren't alone!</h1>
              <p className="dashboard-subheadline">Your questions are unique, but others have asked similar ones. <br />This will help us build new features and improve our websites.</p>
            </div>
            <div className="dashboard-headline-spacer" aria-hidden="true" />
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
                <h3 className="step-title">SWAG</h3>
                <p className="step-text">Don't forget to retrieve your swag from the front desk!</p>
              </div>
              <div className="step-box">
                <h3 className="step-title">Community</h3>
                <div className="qr-code-container">
                  <img src={qrCodeImage} alt="QR Code" className="qr-code-image" />
                </div>
                <p className="step-text">Join our research community</p>
              </div>
              <div className="step-box">
                <h3 className="step-title">Keep going</h3>
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
              <div className="input-display-row">
                <div className="input-display">
                  <p className="input-display-text">
                    <span className="input-display-label">Your response:</span> {inputValue}
                  </p>
                  {currentQuestion === 1 && (
                    <button
                      type="button"
                      onClick={onAdjustInput}
                      className="adjust-input-button"
                    >
                      Edit my response
                    </button>
                  )}
                </div>
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
              <h2 className="question-title">Question {currentQuestion} of 8</h2>
              
              {currentQuestion === 1 && (
                <>
                  <p className="question-text" id="wizard-question-prompt">
                    If we could generate this answer instantly, what format would be most useful?
                  </p>
                  
                  <div
                    className="question-options"
                    role="radiogroup"
                    aria-labelledby="wizard-question-prompt"
                  >
                    {formatOptions.map((option, index) => {
                      const isSelected = option === 'Other' 
                        ? isOtherSelected 
                        : answers.format === option
                      return (
                        <label
                          key={index}
                          className={`wizard-radio-row${isSelected ? ' wizard-radio-row--selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="wizard-q-format"
                            className="wizard-radio-input"
                            value={option}
                            checked={isSelected}
                            onChange={() => handleFormatSelect(option)}
                          />
                          <span className="wizard-radio-label">{option}</span>
                        </label>
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
                  <p className="question-text" id="wizard-question-prompt">
                    What mode are you usually in when this question comes up?
                  </p>
                  
                  <div
                    className="question-options"
                    role="radiogroup"
                    aria-labelledby="wizard-question-prompt"
                  >
                    {locationOptions.map((option, index) => {
                      const isSelected = option === 'Other' 
                        ? isOtherSelected2 
                        : answers.location === option
                      return (
                        <label
                          key={index}
                          className={`wizard-radio-row${isSelected ? ' wizard-radio-row--selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="wizard-q-location"
                            className="wizard-radio-input"
                            value={option}
                            checked={isSelected}
                            onChange={() => handleLocationSelect(option)}
                          />
                          <span className="wizard-radio-label">{option}</span>
                        </label>
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
                  <p className="question-text" id="wizard-question-prompt">
                    For this specific task, how much autonomy would you give an AI agent?
                  </p>
                  
                  <div
                    className="question-options"
                    role="radiogroup"
                    aria-labelledby="wizard-question-prompt"
                  >
                    {autonomyOptions.map((option) => {
                      const isSelected = answers.autonomy === option.value
                      return (
                        <label
                          key={option.value}
                          className={`wizard-radio-row${isSelected ? ' wizard-radio-row--selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="wizard-q-autonomy"
                            className="wizard-radio-input"
                            value={option.value}
                            checked={isSelected}
                            onChange={() => handleAutonomySelect(option.value)}
                          />
                          <span className="wizard-radio-label">{option.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}

              {currentQuestion === 4 && (
                <>
                  <p className="question-text" id="wizard-question-prompt">
                    To customize your future interface, tell us how you spend your day.
                  </p>
                  
                  <div
                    className="persona-options"
                    role="radiogroup"
                    aria-labelledby="wizard-question-prompt"
                  >
                    {personaOptions.map((option, index) => {
                      const isSelected = answers.jobRole === option.value
                      return (
                        <label
                          key={index}
                          className={`wizard-radio-row wizard-radio-row--persona${isSelected ? ' wizard-radio-row--selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="wizard-q-jobrole"
                            className="wizard-radio-input"
                            value={option.value}
                            checked={isSelected}
                            onChange={() => handlePersonaSelect(option.value)}
                          />
                          <span className={`persona-icon-wrap${isSelected ? ' persona-icon-wrap--selected' : ''}`}>
                            {option.icon}
                          </span>
                          <span className="wizard-radio-label persona-label">{option.value}</span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}

              {currentQuestion === 5 && (
                <>
                  <p className="question-text" id="wizard-question-prompt">
                    When it comes to buying new tech, what is your role?
                  </p>
                  
                  <div
                    className="question-options"
                    role="radiogroup"
                    aria-labelledby="wizard-question-prompt"
                  >
                    {buyingRoleOptions.map((option, index) => {
                      const isSelected = answers.buyingRole === option
                      return (
                        <label
                          key={index}
                          className={`wizard-radio-row${isSelected ? ' wizard-radio-row--selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="wizard-q-buyingrole"
                            className="wizard-radio-input"
                            value={option}
                            checked={isSelected}
                            onChange={() => handleBuyingRoleSelect(option)}
                          />
                          <span className="wizard-radio-label">{option}</span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}

              {currentQuestion === 6 && (
                <>
                  <p className="question-text" id="wizard-question-prompt">
                    How long would it take you to find this specific answer on our (or any vendor's) website today?
                  </p>
                  
                  <div
                    className="question-options"
                    role="radiogroup"
                    aria-labelledby="wizard-question-prompt"
                  >
                    {timeToFindOptions.map((option, index) => {
                      const isSelected = answers.timeToFind === option
                      return (
                        <label
                          key={index}
                          className={`wizard-radio-row${isSelected ? ' wizard-radio-row--selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="wizard-q-timetofind"
                            className="wizard-radio-input"
                            value={option}
                            checked={isSelected}
                            onChange={() => handleTimeToFindSelect(option)}
                          />
                          <span className="wizard-radio-label">{option}</span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}

              {currentQuestion === 7 && (
                <>
                  <p className="question-text" id="wizard-question-prompt">
                    If you couldn't find this answer on our site in 2 minutes, where would you go next?
                  </p>
                  
                  <div
                    className="question-options"
                    role="radiogroup"
                    aria-labelledby="wizard-question-prompt"
                  >
                    {whereNextOptions.map((option, index) => {
                      const isSelected = answers.whereNext === option
                      return (
                        <label
                          key={index}
                          className={`wizard-radio-row${isSelected ? ' wizard-radio-row--selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="wizard-q-wherenext"
                            className="wizard-radio-input"
                            value={option}
                            checked={isSelected}
                            onChange={() => handleWhereNextSelect(option)}
                          />
                          <span className="wizard-radio-label">{option}</span>
                        </label>
                      )
                    })}
                  </div>
                </>
              )}

              {currentQuestion === 8 && (
                <>
                  <p className="question-text" id="wizard-question-prompt">
                    {
                      "Is there anything else you'd like to tell us about your question and how you'd prefer to get that information?"
                    }
                  </p>
                  <div className="wizard-open-response">
                    <label htmlFor="wizard-additional-feedback" className="wizard-open-response-label">
                      Your response (optional)
                    </label>
                    <textarea
                      id="wizard-additional-feedback"
                      className="wizard-open-textarea"
                      rows={6}
                      value={answers.additionalFeedback ?? ''}
                      onChange={(e) => onAnswerChange('additionalFeedback', e.target.value)}
                      placeholder="Share any extra context…"
                    />
                  </div>
                </>
              )}

              <div className="question-navigation">
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
                    onClick={currentQuestion === 8 ? onSubmit : onNextQuestion}
                    className="go-button"
                  >
                    {currentQuestion === 8 ? 'Submit' : 'Next'}
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
