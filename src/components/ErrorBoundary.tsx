import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Catches rendering errors on a page so one bad input does not blank the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string; onReset?: () => void }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="panel error-state" role="alert">
        <h2>Something went wrong on this page</h2>
        <p>The inputs could not be processed: <code>{this.state.error.message}</code></p>
        <p className="fine">Your inputs are still saved in this browser. You can go back to another page, or reset the group to the sample.</p>
        <div className="page-actions">
          <button type="button" className="secondary" onClick={() => this.setState({ error: null })}>Try again</button>
          {this.props.onReset && (
            <button type="button" className="secondary" onClick={() => { this.props.onReset?.(); this.setState({ error: null }) }}>Reset group to sample</button>
          )}
        </div>
      </div>
    )
  }
}
