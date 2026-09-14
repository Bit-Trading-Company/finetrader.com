import { useOrdConnect } from '@ordzaar/ord-connect';
import { useBitprint } from './bitprint.tsx';
import { useConnect } from './useConnect.ts';

const CONNECT_TIMEOUT_MS = 5000;

/** localStorage flag that keeps the app disconnected across reloads. */
export const WALLET_DISCONNECTED_KEY = 'wallet-disconnected';

// Module-level so it is stable across renders: useConnect memoizes on it, and
// a new function each render would re-run its UniSat auto-reconnect effect.
const logConnectionError = (message) =>
  console.error('Connection error:', message);

/**
 * Connect / disconnect actions for the page headers (Dashboard, Analytics,
 * AutoTrade, WalletConsolidator, OrdinalExtractor).
 *
 * Wallet state lives in the root OrdConnectProvider (src/index.js). A
 * successful connect or disconnect reloads the page so components that keep
 * their own copies of wallet-derived state start fresh.
 *
 * @param {{ onError?: (message: string) => void }} [options] onError must be
 *   stable across renders (e.g. a state setter); defaults to console.error.
 */
export const useWalletConnection = ({ onError = logConnectionError } = {}) => {
  const ordConnect = useOrdConnect();
  const { globalState: bitprint } = useBitprint();
  const { connectWallet } = useConnect({ onClose: () => {}, onError });

  const isWalletConnected = Boolean(
    ordConnect.address?.ordinals && !(bitprint && bitprint.isDisconnected)
  );

  /**
   * Connect a browser wallet.
   * @returns {Promise<'connected' | 'failed' | 'timeout'>} 'timeout' when the
   *   extension did not respond within 5s (the popup may still be open).
   */
  const connect = async (wallet) => {
    if (bitprint) bitprint.isDisconnected = false;
    localStorage.removeItem(WALLET_DISCONNECTED_KEY);

    const result = await Promise.race([
      connectWallet(wallet),
      new Promise((resolve) =>
        setTimeout(() => resolve('timeout'), CONNECT_TIMEOUT_MS)
      ),
    ]);
    if (result === 'timeout') return 'timeout';
    if (!result) return 'failed';

    window.location.reload();
    return 'connected';
  };

  const disconnect = () => {
    if (bitprint?.disconnect) bitprint.disconnect();
    localStorage.setItem(WALLET_DISCONNECTED_KEY, 'true');
    ordConnect.disconnectWallet();
    window.location.reload();
  };

  /** Switch network and reconnect the current wallet on it. */
  const changeNetwork = async (network) => {
    ordConnect.updateNetwork(network);
    try {
      await connectWallet(ordConnect.wallet);
    } catch {
      // Reconnect failures are reported through onError.
    }
  };

  return {
    ...ordConnect,
    isWalletConnected,
    connect,
    disconnect,
    changeNetwork,
  };
};
