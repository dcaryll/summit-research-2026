import { useState } from 'react'
import './QualifyingQuestions.css'
import logoImage from '../images/Logo-Red_Hat-A-White-RGB.svg'

interface QualifyingQuestionsProps {
  onBack: () => void
  onComplete: (recommendedFocusId: string) => void
}

// Focus options for Q3 - maps answer to focus id
const FOCUS_OPTIONS = [
  { id: 'renew-subscription', label: 'Renewing a subscription' },
  { id: 'trying-products', label: 'Trying new Products' },
  { id: 'dashboard', label: 'My Red Hat Dashboard' },
  { id: 'guided-learning-genai', label: 'GenAI Guided Learning' },
  { id: 'user-preferences', label: 'User preferences' },
  { id: 'buying-products', label: 'Buying products' },
  { id: 'accessibility-usability', label: 'Accessibility and usability' },
  { id: 'developer-for-business', label: 'Developer for business' }
] as const

const QUESTIONS = [
  {
    id: 'q1',
    question: 'What best describes your goal today?',
    options: [
      { value: 'renew', label: 'I need to renew or manage a subscription' },
      { value: 'explore', label: "I'm exploring new Red Hat products" },
      { value: 'dashboard', label: 'I use or want to improve my Red Hat Dashboard' },
      { value: 'learning', label: "I'm interested in Guided Learning with GenAI" }
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

  return (
    <div className="qualifying-screen">
      <div className="qualifying-header">
        <img src={logoImage} alt="Red Hat Logo" className="qualifying-logo" />
        <button type="button" className="qualifying-back-button" onClick={onBack}>
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
            {isLastQuestion ? 'See my recommended study' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default QualifyingQuestions
