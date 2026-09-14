import { useState, useEffect } from 'react';

/**
 * Whether the user explicitly disconnected their wallet (the
 * `wallet-disconnected` localStorage flag, see ./bitprint.tsx).
 *
 * Updates when the flag changes in another tab (`storage` event) or in this
 * tab via the custom `localStorageChange` event dispatched by WalletConnect.
 */
export const useWalletDisconnectState = () => {
  const [isDisconnected, setIsDisconnected] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('wallet-disconnected') === 'true';
  });

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'wallet-disconnected') {
        setIsDisconnected(e.newValue === 'true');
        // Update bitprint state if available
        if (window.bitprint) {
          window.bitprint.isDisconnected = e.newValue === 'true';
        }
      }
    };

    // Listen for localStorage changes
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom events (for same-tab changes)
    const handleCustomStorageChange = () => {
      const newState = localStorage.getItem('wallet-disconnected') === 'true';
      setIsDisconnected(newState);
      // Update bitprint state if available
      if (window.bitprint) {
        window.bitprint.isDisconnected = newState;
      }
    };

    window.addEventListener('localStorageChange', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(
        'localStorageChange',
        handleCustomStorageChange
      );
    };
  }, []);

  return isDisconnected;
};
