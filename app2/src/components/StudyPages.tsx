import { useState } from 'react'
import './StudyPages.css'
import logoImage from '../images/Logo-Red_Hat-A-White-RGB.svg'
import CompletionScreen from './CompletionScreen'
import LoadingScreen from './LoadingScreen'

interface StudyPagesProps {
  focusId: string
  onBack: () => void
  onComplete: (focusId: string, answers: Record<string, string>) => void
}

type StudyPage = {
  id: string
  question: string
  type: 'text' | 'multiple-choice' | 'rating'
  options?: string[]
  figmaEmbedUrl?: string
}

// Mock study pages/questions - this will be customized based on focusId
const getStudyPages = (focusId: string): StudyPage[] => {
  const pages: Record<string, StudyPage[]> = {
    'renew-subscription': [
      { id: '1', question: 'How often do you renew your Red Hat subscriptions?', type: 'multiple-choice', options: ['Monthly', 'Quarterly', 'Annually', 'As needed'] },
      { id: '2', question: 'What challenges do you face when renewing?', type: 'text' },
      { id: '3', question: 'How satisfied are you with the renewal process?', type: 'rating' }
    ],
    'trying-products': [
      { id: '1', question: 'What new Red Hat products are you most interested in?', type: 'text' },
      { id: '2', question: 'How do you typically discover new products?', type: 'multiple-choice', options: ['Website', 'Sales team', 'Documentation', 'Community forums', 'Other'] },
      { id: '3', question: 'What information do you need before trying a new product?', type: 'text' }
    ],
    'dashboard': [
      { id: '1', question: 'How often do you use your Red Hat Dashboard?', type: 'multiple-choice', options: ['Daily', 'Weekly', 'Monthly', 'Rarely'] },
      {
        id: '2',
        question: 'Review the dashboard prototype below, then tell us: What features do you use most frequently?',
        type: 'text',
        figmaEmbedUrl: 'https://embed.figma.com/proto/RagMk0n5dRjRUiWypq1jw4?node-id=2561-29592&embed-host=summit-research&scaling=scale-down-width&content-scaling=fixed'
      },
      { id: '3', question: 'What improvements would you like to see?', type: 'text' }
    ],
    'guided-learning-genai': [
      { id: '1', question: 'How often do you use the Guided Learning GenAI experience?', type: 'multiple-choice', options: ['Daily', 'Weekly', 'Monthly', 'Rarely', "I haven't tried it yet"] },
      { id: '2', question: 'What do you find most helpful about Guided Learning with GenAI?', type: 'text' },
      { id: '3', question: 'What would make the Guided Learning GenAI experience better for you?', type: 'text' }
    ],
    'user-preferences': [
      { id: '1', question: 'How do you prefer to manage your Red Hat account settings?', type: 'multiple-choice', options: ['In the product', 'In a central portal', 'Via API or automation', 'I rarely change settings'] },
      { id: '2', question: 'What preferences or customizations matter most to you?', type: 'text' },
      { id: '3', question: 'What would make our preference and settings experience better?', type: 'text' }
    ],
    'buying-products': [
      { id: '1', question: 'How do you typically purchase Red Hat products?', type: 'multiple-choice', options: ['Direct from Red Hat', 'Through a partner or reseller', 'Through my organization\'s procurement', 'Other'] },
      { id: '2', question: 'What challenges do you face when buying Red Hat products?', type: 'text' },
      { id: '3', question: 'What would make the buying process better for you?', type: 'text' }
    ],
    'accessibility-usability': [
      { id: '1', question: 'Do you use any assistive technologies when using Red Hat products?', type: 'multiple-choice', options: ['Screen reader', 'Keyboard only', 'High contrast or zoom', 'Voice control', 'None', 'Other'] },
      { id: '2', question: 'What accessibility or usability barriers have you encountered?', type: 'text' },
      { id: '3', question: 'What would make Red Hat products more accessible or easier to use for you?', type: 'text' }
    ],
    'developer-for-business': [
      { id: '1', question: 'Which Red Hat developer tools do you use in your business?', type: 'multiple-choice', options: ['OpenShift', 'RHEL', 'Ansible', 'Quay', 'Buildah/Podman', 'Other'] },
      { id: '2', question: 'How do developer tools support your business outcomes?', type: 'text' },
      { id: '3', question: 'What would help you use Red Hat developer tools more effectively for business?', type: 'text' }
    ]
  }
  return pages[focusId] || []
}

function StudyPages({ focusId, onBack, onComplete }: StudyPagesProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showCompletion, setShowCompletion] = useState(false)
  const [isLoadingCompletion, setIsLoadingCompletion] = useState(false)
  const studyPages = getStudyPages(focusId)

  const currentPage = studyPages[currentPageIndex]
  const isLastPage = currentPageIndex === studyPages.length - 1
  const isFirstPage = currentPageIndex === 0

  const handleAnswerChange = (value: string) => {
    setAnswers(prev => ({ ...prev, [currentPage.id]: value }))
  }

  const handleNext = async () => {
    if (currentPageIndex < studyPages.length - 1) {
      setCurrentPageIndex(prev => prev + 1)
    } else {
      // Submit study - save responses then show loading then completion
      await onComplete(focusId, answers)
      setIsLoadingCompletion(true)
      setTimeout(() => {
        setIsLoadingCompletion(false)
        setShowCompletion(true)
      }, 1500)
    }
  }

  const handlePrevious = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1)
    }
  }

  const canProceed = () => {
    return answers[currentPage?.id] && answers[currentPage.id].trim() !== ''
  }

  if (isLoadingCompletion) {
    return <LoadingScreen message="Preparing" />
  }

  if (showCompletion) {
    return <CompletionScreen onBack={onBack} />
  }

  if (studyPages.length === 0) {
    return (
      <div className="study-pages-screen">
        <div className="study-header">
          <img src={logoImage} alt="Red Hat Logo" className="study-logo" />
          <button className="back-button" onClick={onBack}>Back to study selection</button>
        </div>
        <div className="study-content">
          <p>No study pages available for this focus area.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="study-pages-screen">
      <div className="study-header">
        <img src={logoImage} alt="Red Hat Logo" className="study-logo" />
        <button className="back-button" onClick={onBack}>Back to study selection</button>
      </div>

      <div className="study-content">
        <div className="page-indicator">
          Page {currentPageIndex + 1} of {studyPages.length}
        </div>

        <div className="page-content">
          <h2 className="page-question">{currentPage.question}</h2>

          {currentPage.figmaEmbedUrl && (
            <div className="figma-embed-wrap">
              <iframe
                src={currentPage.figmaEmbedUrl}
                className="figma-embed"
                allowFullScreen
                title="Figma prototype"
              />
            </div>
          )}

          {currentPage.type === 'text' && (
            <textarea
              className="text-input"
              value={answers[currentPage.id] || ''}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Type your answer here..."
              rows={6}
            />
          )}

          {currentPage.type === 'multiple-choice' && currentPage.options && (
            <div className="options-list">
              {currentPage.options.map((option) => (
                <button
                  key={option}
                  className={`option-button ${answers[currentPage.id] === option ? 'selected' : ''}`}
                  onClick={() => handleAnswerChange(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {currentPage.type === 'rating' && (
            <div className="rating-buttons">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  className={`rating-button ${answers[currentPage.id] === rating.toString() ? 'selected' : ''}`}
                  onClick={() => handleAnswerChange(rating.toString())}
                >
                  {rating}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="page-navigation">
          {!isFirstPage && (
            <button className="nav-button previous" onClick={handlePrevious}>
              Previous
            </button>
          )}
          <button
            className="nav-button next"
            onClick={handleNext}
            disabled={!canProceed()}
          >
            {isLastPage ? 'Submit' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default StudyPages
