import './CompletionScreen.css'
import logoImage from '../images/Logo-Red_Hat-A-White-RGB.svg'
import qrCodeImage from '../images/qr-code.svg'

interface CompletionScreenProps {
  onBack: () => void
}

function CompletionScreen({ onBack }: CompletionScreenProps) {
  return (
    <div className="completion-screen">
      <div className="completion-header">
        <img src={logoImage} alt="Red Hat Logo" className="completion-logo" />
        <button className="back-button" onClick={onBack}>Start over</button>
      </div>

      <div className="completion-content">
        <div className="completion-headline-section">
          <h1 className="completion-headline">Thank you!</h1>
          <p className="completion-subheadline">Your feedback helps us build better products and experiences.</p>
        </div>

        <div className="completion-steps">
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
            <p className="step-text">Take another usability study</p>
            <button
              className="step-button"
              onClick={onBack}
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompletionScreen
