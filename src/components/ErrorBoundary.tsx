// If a screen crashes, show a friendly way back instead of a blank page. Data is never touched.
import { Component, type ReactNode } from 'react';
import { useApp } from '../state/app';

function Fallback({ error, reset }: { error: Error; reset: () => void }) {
  const { tab } = useApp();
  return (
    <div className="page">
      <div className="card center" style={{ marginTop: 24 }}>
        <h2 style={{ justifyContent: 'center' }}>Something went wrong on this screen</h2>
        <div className="small muted mb">Your data is safe. Go back to Home and try again.</div>
        <button
          className="btn primary block"
          onClick={() => {
            reset();
            tab('home');
          }}
        >
          Back to Home
        </button>
        <div className="tiny muted mt">{error.message}</div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) return <Fallback error={this.state.error} reset={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}
