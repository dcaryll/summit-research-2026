import './FocusSelector.css'
import logoImage from '../images/Logo-Red_Hat-A-White-RGB.svg'

interface FocusSelectorProps {
  onFocusSelect: (focus: string) => void
  selectedFocus: string | null
  onTakeStudy: () => void
}

interface FocusOption {
  id: string
  title: string
  description: string
}

const focusOptions: FocusOption[] = [
  {
    id: 'renew-subscription',
    title: 'Renewing a subscription',
    description: 'Help us improve the subscription renewal experience'
  },
  {
    id: 'trying-products',
    title: 'Trying new Products',
    description: 'Share your experience exploring new Red Hat products'
  },
  {
    id: 'dashboard',
    title: 'My Red Hat Dashboard',
    description: 'Tell us about your dashboard usage and preferences'
  }
]

function FocusSelector({ onFocusSelect, selectedFocus, onTakeStudy }: FocusSelectorProps) {
  const handleRandomize = () => {
    const randomIndex = Math.floor(Math.random() * focusOptions.length)
    const randomFocus = focusOptions[randomIndex].id
    onFocusSelect(randomFocus)
    // Automatically proceed to the study
    setTimeout(() => {
      onTakeStudy()
    }, 100) // Small delay to ensure state is updated
  }

  return (
    <div className="focus-selector-screen">
      <div className="logo-container">
        <img src={logoImage} alt="Red Hat Logo" className="logo-image" />
      </div>

      <div className="selector-content">
        <h1 className="selector-title">Select your focus</h1>
        <p className="selector-subtitle">Choose a study track that interests you</p>

        <div className="focus-cards-grid">
          {focusOptions.map((option) => (
            <button
              key={option.id}
              className={`focus-card ${selectedFocus === option.id ? 'selected' : ''}`}
              onClick={() => onFocusSelect(option.id)}
            >
              <h2 className="focus-card-title">{option.title}</h2>
              <p className="focus-card-description">{option.description}</p>
            </button>
          ))}
        </div>

        {selectedFocus && (
          <button
            className="take-study-button"
            onClick={onTakeStudy}
          >
            Take the study
          </button>
        )}

        <div className="randomize-section">
          <h2 className="randomize-title">Not sure which to choose?</h2>
          <button
            className="randomize-button"
            onClick={handleRandomize}
          >
            Assign me a random study
          </button>
        </div>
      </div>
    </div>
  )
}

export default FocusSelector
