import React, { createContext, useContext, useState } from 'react';

/**
 * App-wide "explicitly disconnected" flag.
 *
 * ord-connect restores the last wallet from localStorage on load, so after the
 * user disconnects, the app also sets `wallet-disconnected` in localStorage and
 * treats the wallet as disconnected until they connect again. The flag is
 * mirrored on `window.bitprint` for useConnect's UniSat auto-reconnect.
 *
 * Every provider shares the single module-level object below, so mutating
 * `globalState.isDisconnected` is visible app-wide.
 */

declare global {
  interface Window {
    bitprint?: {
      isDisconnected: boolean;
      disconnect: () => void;
    };
  }
}

const bitprintState = {
  isDisconnected:
    typeof window !== 'undefined'
      ? localStorage.getItem('wallet-disconnected') === 'true'
      : false,
  disconnect() {
    try {
      this.isDisconnected = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet-disconnected', 'true');
      }
    } catch {
      // Ignore storage failures; the in-memory flag is still set.
    }
  },
};

const Bitprint = createContext({});

export const BitprintProvider = ({ children }) => {
  const [globalState, setGlobalState] = useState(bitprintState);

  // Make the flag available to useConnect (outside React context).
  if (typeof window !== 'undefined') {
    window.bitprint = globalState;
  }

  return (
    <Bitprint.Provider value={{ globalState, setGlobalState }}>
      {children}
    </Bitprint.Provider>
  );
};

export const useBitprint = () => useContext(Bitprint);
