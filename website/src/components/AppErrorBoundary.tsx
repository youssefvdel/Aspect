import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Contains a crash inside the embedded Recon app.
 *
 * The desktop app ships without an error boundary, which is fine there — but
 * once its React tree is mounted inside the marketing site, one bad field
 * unmounted the ENTIRE page and the visitor saw a black screen. Scoping an
 * boundary to the app frame means a failure degrades to a readable panel
 * instead of taking the site down with it.
 */
export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ReconApp] render crashed inside the website embed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="w-full h-full flex items-center justify-center bg-m3-surface text-m3-on-surface p-8">
        <div className="max-w-md text-center space-y-3">
          <div className="font-mono text-[11px] uppercase tracking-wider text-m3-primary font-bold">
            Preview unavailable
          </div>
          <div className="font-display font-bold text-lg">
            The demo app view hit an error while rendering.
          </div>
          <p className="text-sm text-m3-on-surface-variant leading-relaxed">
            This is the embedded preview only — the desktop app is unaffected.
          </p>
          <pre className="text-[11px] font-mono text-m3-outline text-left bg-m3-surface-container rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap break-words">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-lg bg-m3-primary text-m3-on-primary font-bold text-sm transition-transform duration-160 active:scale-[0.97] cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}
