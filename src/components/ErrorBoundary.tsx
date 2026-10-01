import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Clears stored session state so a bad restore can't repeat on reload. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * A render error used to unmount the whole tree and leave a blank white page
 * with nothing but a console trace. Show what broke instead, and offer the one
 * recovery that actually helps — dropping the stored session.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private reset = () => {
    try {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith('dgbt:')) sessionStorage.removeItem(key);
      }
    } catch {
      /* private mode — reloading is still worth a try */
    }
    this.props.onReset?.();
    location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash" role="alert">
        <h1>Something broke while rendering.</h1>
        <p>
          This is usually a bag saved by an older version of the app. Clearing the session fixes it —
          you will need to rebuild your bag from search.
        </p>
        <pre className="crash__detail">{error.message}</pre>
        <button type="button" className="button button--primary" onClick={this.reset}>
          Clear session and reload
        </button>
      </div>
    );
  }
}
