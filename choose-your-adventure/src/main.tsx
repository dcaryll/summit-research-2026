import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import AppV2 from './AppV2.tsx'
import './index.css'

const v = new URLSearchParams(window.location.search).get('v')
const Root = v === '2' ? AppV2 : App

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '2rem',
            maxWidth: 720,
            margin: '0 auto',
            color: '#f5f5f5',
            fontFamily: 'system-ui, sans-serif',
            minHeight: '100vh',
            boxSizing: 'border-box',
            background: '#0a0a0c'
          }}
        >
          <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>This page failed to load</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, opacity: 0.9 }}>
            {this.state.error.message}
          </pre>
          <button
            type="button"
            style={{ marginTop: '1.5rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML =
    '<p style="padding:1rem;font-family:system-ui">Missing #root — check index.html.</p>'
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <Root />
      </RootErrorBoundary>
    </React.StrictMode>
  )
}
