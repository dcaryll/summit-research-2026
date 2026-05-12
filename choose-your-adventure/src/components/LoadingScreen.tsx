import ParticipantDinoGame from './ParticipantDinoGame'
import './LoadingScreen.css'

interface LoadingScreenProps {
  message?: string
  /** Participant-only: Chrome-style mini runner while waiting (e.g. session prep). */
  showRunnerGame?: boolean
}

function LoadingScreen({ message = 'Loading...', showRunnerGame = false }: LoadingScreenProps) {
  return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <p className="loading-text">{message}</p>
      {showRunnerGame ? (
        <div className="loading-screen-runner">
          <p className="loading-dino-hint">While you wait — jump the fedora over hat racks (Space, ↑, or tap)</p>
          <ParticipantDinoGame />
        </div>
      ) : null}
    </div>
  )
}

export default LoadingScreen
