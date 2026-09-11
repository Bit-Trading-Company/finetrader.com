import { useState, useEffect } from 'react';

export const useLocalStorage = (key, initialValue) => {
  // Get from local storage then parse stored json or return initialValue
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.log(error);
    }
  };

  // Listen for changes to localStorage from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        setStoredValue(JSON.parse(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue];
};

// Custom hook specifically for wallet disconnect state
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
