import { useState, useEffect } from 'react'
import './QualifyingQuestions.css'
import { confirmLeaveQualifyingFlow, registerBeforeUnloadIfInProgress } from '../studyExitPrompt'
import { studyLogo } from '../studyBrand'

interface QualifyingQuestionsProps {
  onBack: () => void
  onComplete: (recommendedFocusId: string) => void
}

// Focus options for Q3 - maps answer to focus id
const FOCUS_OPTIONS = [
  { id: 'user-preferences', label: 'User preferences' },
  { id: 'product-evaluation', label: 'Product evaluation' },
  { id: 'developer-program', label: 'Developer program' },
  { id: 'my-red-hat', label: 'My Red Hat' },
  { id: 'my-trials', label: 'Trying & buying new products' },
  { id: 'product-marketing', label: 'Product marketing' },
  { id: 'content-discovery', label: 'Content discovery' }
] as const

const QUESTIONS = [
  {
    id: 'q1',
    question: 'What best describes your goal today?',
    options: [
      { value: 'preferences', label: 'Profile, preferences, and personalization across Red Hat' },
      { value: 'evaluate', label: 'Evaluating or trying products' },
      { value: 'developer', label: 'Developer program, tools, or sandbox' },
      { value: 'portal', label: 'My Red Hat portal or dashboard' },
      { value: 'trials', label: 'Product trials and evaluation access' },
      { value: 'marketing', label: 'Product information, marketing, or procurement' },
      { value: 'content', label: 'Finding documentation, learning, or technical content' }
    ]
  },
  {
    id: 'q2',
    question: 'How would you describe your experience with Red Hat products?',
    options: [
      { value: 'new', label: 'New to Red Hat' },
      { value: 'some', label: 'Some experience' },
      { value: 'regular', label: 'Regular user' },
      { value: 'expert', label: 'Expert' }
    ]
  },
  {
    id: 'q3',
    question: 'Based on your goals, which study would you like to take?',
    options: FOCUS_OPTIONS.map((f) => ({ value: f.id, label: f.label }))
  }
]

function QualifyingQuestions({ onBack, onComplete }: QualifyingQuestionsProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const currentQuestion = QUESTIONS[currentIndex]
  const currentAnswer = answers[currentQuestion?.id]
  const isLastQuestion = currentIndex === QUESTIONS.length - 1
  const isFirstQuestion = currentIndex === 0
  const canProceed = !!currentAnswer

  const handleSelect = (value: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }))
  }

  const handleNext = () => {
    if (isLastQuestion) {
      // Q3 answer is the recommended focus
      const recommendedFocusId = answers['q3'] || currentAnswer
      onComplete(recommendedFocusId)
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  const handlePrevious = () => {
    if (!isFirstQuestion) setCurrentIndex((i) => i - 1)
  }

  const hasQualifyingProgress = currentIndex > 0 || Object.keys(answers).length > 0

  useEffect(() => {
    return registerBeforeUnloadIfInProgress(hasQualifyingProgress)
  }, [hasQualifyingProgress])

  const handleLeaveQualifying = () => {
    if (!hasQualifyingProgress || confirmLeaveQualifyingFlow()) {
      onBack()
    }
  }

  return (
    <div className="qualifying-screen">
      <div className="qualifying-header">
        <img src={studyLogo} alt="" className="qualifying-logo" />
        <button type="button" className="qualifying-back-button" onClick={handleLeaveQualifying}>
          Back
        </button>
      </div>

      <div className="qualifying-content">
        <p className="qualifying-indicator">
          Question {currentIndex + 1} of {QUESTIONS.length}
        </p>
        <h2 className="qualifying-question">{currentQuestion.question}</h2>
        <div className="qualifying-options">
          {currentQuestion.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`qualifying-option ${currentAnswer === opt.value ? 'selected' : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="qualifying-navigation">
          {!isFirstQuestion && (
            <button type="button" className="qualifying-nav previous" onClick={handlePrevious}>
              Previous
            </button>
          )}
          <button
            type="button"
            className="qualifying-nav next"
            onClick={handleNext}
            disabled={!canProceed}
          >
            {isLastQuestion ? 'See my recommended study' : 'Moderator: advance when ready'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default QualifyingQuestions
