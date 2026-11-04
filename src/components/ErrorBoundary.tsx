// If a screen crashes, show a friendly way back instead of a blank page. Data is never touched.
import { Component, useEffect, useState, type ReactNode } from 'react';
import { isMissingFileError, repairMissingFiles } from '../services/autoUpdate';
import { useApp } from '../state/app';

function Fallback({ error, reset }: { error: Error; reset: () => void }) {
  const { tab } = useApp();
  // a part of the app could not be loaded (e.g. right after an update): repair it by itself
  const missing = isMissingFileError(error);
  const [repairing, setRepairing] = useState(missing);
  useEffect(() => {
    if (!missing) return;
    repairMissingFiles().then((started) => {
      if (!started) setRepairing(false);
    });
  }, [missing]);
  if (repairing)
    return (
      <div className="page">
        <div className="card center" style={{ marginTop: 24 }}>
          <h2 style={{ justifyContent: 'center' }}>Finishing the update…</h2>
          <div className="small muted">One moment. Your data is safe.</div>
        </div>
      </div>
    );
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
