import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: '#f87171', backgroundColor: '#0a0a1a', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong.</h1>
          <p style={{ marginBottom: '1rem', color: '#fca5a5' }}>The application encountered an unexpected error.</p>
          <pre style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', fontSize: '0.875rem' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '1.5rem', padding: '0.5rem 1rem', backgroundColor: '#f59e0b', color: '#000', border: 'none', borderRadius: '9999px', cursor: 'pointer', fontWeight: 'bold' }}>
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
