import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Check if it's a MetaMask error
    if (
      error &&
      error.message &&
      (error.message.includes('MetaMask') ||
        error.message.includes(
          'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn'
        ))
    ) {
      // Don't show error UI for MetaMask errors
      return { hasError: false, error: null };
    }

    // Update state for other errors
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Suppress MetaMask errors
    if (
      error &&
      error.message &&
      (error.message.includes('MetaMask') ||
        error.message.includes(
          'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn'
        ))
    ) {
      // Silently ignore MetaMask errors
      return;
    }

    // Log other errors
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '20px',
            margin: '20px',
            border: '1px solid #ff0000',
            borderRadius: '4px',
            backgroundColor: '#fff0f0',
          }}
        >
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
