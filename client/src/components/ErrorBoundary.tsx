import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] React-Fehler aufgefangen:', error.message);
    console.error('[ErrorBoundary] Komponenten-Stack:', info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#0f0f13',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16, padding: 24, fontFamily: 'Segoe UI, sans-serif',
        }}>
          <div style={{ fontSize: 32 }}>⚠</div>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>
            Unerwarteter Fehler
          </div>
          <div style={{
            color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center',
            maxWidth: 420,
          }}>
            {this.state.error?.message ?? 'Unbekannter Fehler'}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, color: '#fff',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
              padding: '9px 22px', marginTop: 8,
            }}
          >
            Seite neu laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
