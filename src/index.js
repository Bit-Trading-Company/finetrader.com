/**
 * App entry point: MetaMask interference guards, then the root providers
 * (router + ord-connect wallet state) around <App />.
 *
 * Note: every page is statically imported by App, so all page CSS is bundled
 * and applied globally regardless of the current route.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { BrowserRouter } from 'react-router-dom';
import { OrdConnectProvider } from '@ordzaar/ord-connect';
import ErrorBoundary from './app/ErrorBoundary';

// AGGRESSIVELY block MetaMask from interfering with Bitcoin app
// This is a Bitcoin-only application and should not use Ethereum wallets
if (typeof window !== 'undefined' && window.ethereum) {
  // Store original ethereum object
  const originalEthereum = window.ethereum;

  // Try to override window.ethereum with a non-functional object
  try {
    // Create a dummy object that blocks all MetaMask operations
    const dummyEthereum = {
      isMetaMask: false,
      request: () =>
        Promise.reject(new Error('MetaMask disabled for Bitcoin app')),
      enable: () =>
        Promise.reject(new Error('MetaMask disabled for Bitcoin app')),
      send: () =>
        Promise.reject(new Error('MetaMask disabled for Bitcoin app')),
    };

    // Try to redefine the property
    Object.defineProperty(window, 'ethereum', {
      get() {
        return dummyEthereum;
      },
      set() {
        // Silently ignore attempts to set window.ethereum
      },
      configurable: true,
    });
  } catch (e) {
    // If we can't override it, wrap it in a proxy
    try {
      window.ethereum = new Proxy(originalEthereum, {
        get(target, prop) {
          if (prop === 'request' || prop === 'enable' || prop === 'send') {
            return () =>
              Promise.reject(new Error('MetaMask disabled for Bitcoin app'));
          }
          if (prop === 'isMetaMask') {
            return false;
          }
          return target[prop];
        },
      });
    } catch (proxyError) {
      // If even proxy fails, just log it
      console.log('MetaMask blocking failed, but errors will be suppressed');
    }
  }
}

// Add global error handler to catch and suppress MetaMask errors
window.addEventListener('error', function (event) {
  if (
    event.error &&
    event.error.message &&
    (event.error.message.includes('MetaMask') ||
      event.error.message.includes(
        'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn'
      ))
  ) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
});

// Add unhandled promise rejection handler
window.addEventListener('unhandledrejection', function (event) {
  if (
    event.reason &&
    event.reason.message &&
    (event.reason.message.includes('MetaMask') ||
      event.reason.message.includes(
        'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn'
      ))
  ) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  }
});

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <OrdConnectProvider network="mainnet" chain="bitcoin" ssr={true}>
            <App />
          </OrdConnectProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
}

// React Router v7 will require future flags for startTransition and relative splat path.
// See https://reactrouter.com/en/main/upgrading/v6-to-v7#future-flags
// TODO: When upgrading to v7, use createBrowserRouter and add the future flags as described in the AI docs.
