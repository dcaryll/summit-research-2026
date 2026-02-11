import './LoadingScreen.css'

interface LoadingScreenProps {
  message?: string
}

function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <p className="loading-text">{message}</p>
    </div>
  )
}

export default LoadingScreen
