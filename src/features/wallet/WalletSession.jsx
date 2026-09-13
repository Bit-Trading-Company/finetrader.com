/**
 * App-level proxy wallet session.
 *
 * Proxy wallets are derived from a signature the user produces with their
 * connected wallet (see `generateDeterministicWallets`). Before this provider
 * existed, every page rendered its own `WalletManagement`, each holding its
 * own copy of the wallets in local state and broadcasting over its own event
 * hub — so moving between pages meant signing again, five times over.
 *
 * Holding that state once, above the router, is what lets the user sign once
 * and find the same wallets everywhere.
 *
 * Deliberately memory-only: the signature is the master secret for every
 * derived key, so it is never written to storage and never leaves this
 * module. Wallets therefore survive navigation but not a page reload, which
 * is the same trade-off the wallet extensions themselves make.
 *
 * @see docs/ARCHITECTURE.md
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useOrdConnect, useSignMessage } from '@ordzaar/ord-connect';
import { generateDeterministicWallets } from '../../lib/bitcoinUtils';
import {
  clearSelectedProxyWallet,
  loadSelectedProxyWallet,
  saveSelectedProxyWallet,
} from './proxyWalletStorage';

/**
 * The message the user signs. Changing this string changes the seed, and so
 * changes every address the app derives — existing users would no longer see
 * the wallets holding their funds. It must not be edited.
 */
export const DERIVATION_MESSAGE = 'Generate Fine Trading proxy wallets';

/** How many wallets to derive when the caller does not say. */
export const DEFAULT_WALLET_COUNT = 10;

/** The generator is linear in this, and wallet extensions rate-limit. */
export const MAX_WALLET_COUNT = 100;

/**
 * @typedef {object} ProxyWallet
 * @property {number} index position in the derivation sequence, 0-based
 * @property {string} privateKey 64-char hex
 * @property {string} publicKey compressed hex
 * @property {{p2pkh: string, p2wpkh: string, p2tr: string}} addresses
 * @property {string} address the primary (taproot) address
 */

/**
 * @typedef {object} WalletSession
 * @property {ProxyWallet[]} wallets every derived wallet, ordered by index
 * @property {ProxyWallet|null} selectedWallet
 * @property {boolean} hasWallets
 * @property {boolean} isGenerating a signature or derivation is in flight
 * @property {string|null} error
 * @property {boolean} isWalletConnected
 * @property {string|null} connectedAddress the ordinals address, if connected
 * @property {(count?: number) => Promise<ProxyWallet[]>} generateWallets
 * @property {(wallet: ProxyWallet|number|null) => void} selectWallet
 * @property {() => void} clearWallets
 */

const WalletSessionContext = createContext(null);

const clampCount = (count) =>
  Math.max(1, Math.min(MAX_WALLET_COUNT, Math.floor(count) || 1));

export const WalletSessionProvider = ({ children }) => {
  const { address: connectedAddress, wallet: connectedWallet } =
    useOrdConnect();
  const { signMsg } = useSignMessage();

  const [wallets, setWallets] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const ordinalsAddress = connectedAddress?.ordinals || null;
  const isWalletConnected = Boolean(ordinalsAddress);

  /** Guards against two concurrent signature prompts. */
  const generationRef = useRef(null);

  const clearWallets = useCallback(() => {
    setWallets([]);
    setSelectedIndex(null);
    setError(null);
    clearSelectedProxyWallet();
  }, []);

  /*
   * Derived keys belong to the address that signed for them. When the wallet
   * disconnects — or the user switches to a different account — the old
   * wallets are meaningless and must not linger where the next user can spend
   * from them.
   */
  const lastAddressRef = useRef(ordinalsAddress);
  useEffect(() => {
    if (lastAddressRef.current === ordinalsAddress) return;
    lastAddressRef.current = ordinalsAddress;
    clearWallets();
  }, [ordinalsAddress, clearWallets]);

  const generateWallets = useCallback(
    async (count = DEFAULT_WALLET_COUNT) => {
      if (!isWalletConnected) {
        setError('Connect a wallet first');
        return [];
      }
      // A second call while the extension's prompt is open joins the first.
      if (generationRef.current) return generationRef.current;

      const run = (async () => {
        setIsGenerating(true);
        setError(null);
        try {
          const signature = await signMsg(ordinalsAddress, DERIVATION_MESSAGE);
          if (!signature) {
            throw new Error('Wallet did not return a signature');
          }

          const derived = await generateDeterministicWallets(
            signature,
            clampCount(count)
          );
          setWallets(derived);

          // Restore the previously selected wallet by position in the
          // sequence. The stored copy's keys are ignored; the freshly derived
          // wallet is the source of truth.
          const stored = loadSelectedProxyWallet();
          const restored =
            stored && derived.find((w) => w.index === stored.index);
          setSelectedIndex(restored ? restored.index : null);

          return derived;
        } catch (err) {
          setError(err?.message || 'Could not derive proxy wallets');
          return [];
        } finally {
          setIsGenerating(false);
          generationRef.current = null;
        }
      })();

      generationRef.current = run;
      return run;
    },
    [isWalletConnected, ordinalsAddress, signMsg]
  );

  const selectWallet = useCallback(
    (target) => {
      if (target === null || target === undefined) {
        setSelectedIndex(null);
        clearSelectedProxyWallet();
        return;
      }
      const index = typeof target === 'number' ? target : target.index;
      setSelectedIndex(index);

      const wallet = wallets.find((w) => w.index === index);
      // Legacy marketplace panels read this back from storage directly.
      if (wallet) saveSelectedProxyWallet(wallet);
    },
    [wallets]
  );

  const selectedWallet = useMemo(
    () => wallets.find((w) => w.index === selectedIndex) || null,
    [wallets, selectedIndex]
  );

  const value = useMemo(
    () => ({
      wallets,
      selectedWallet,
      hasWallets: wallets.length > 0,
      isGenerating,
      error,
      isWalletConnected,
      connectedAddress: ordinalsAddress,
      connectedWallet,
      generateWallets,
      selectWallet,
      clearWallets,
    }),
    [
      wallets,
      selectedWallet,
      isGenerating,
      error,
      isWalletConnected,
      ordinalsAddress,
      connectedWallet,
      generateWallets,
      selectWallet,
      clearWallets,
    ]
  );

  return (
    <WalletSessionContext.Provider value={value}>
      {children}
    </WalletSessionContext.Provider>
  );
};

/**
 * Read the shared proxy wallet session.
 * @returns {WalletSession}
 */
export const useWalletSession = () => {
  const context = useContext(WalletSessionContext);
  if (!context) {
    throw new Error(
      'useWalletSession must be used inside a WalletSessionProvider'
    );
  }
  return context;
};

/**
 * Mirror session state onto a legacy event hub.
 *
 * The pre-redesign panels (Dispatch, the marketplace forms, WalletDetails)
 * learn about wallets by listening for `wallets-generated` and
 * `wallet-selected`. A redesigned page that still renders one of them can
 * call this to keep those children fed from the session, so pages can be
 * migrated one at a time instead of all at once.
 *
 * @param {{emit: Function}|null} hub
 */
export const useWalletSessionBridge = (hub) => {
  const { wallets, selectedWallet } = useWalletSession();

  useEffect(() => {
    if (hub && wallets.length > 0) hub.emit('wallets-generated', wallets);
  }, [hub, wallets]);

  useEffect(() => {
    if (hub && selectedWallet) hub.emit('wallet-selected', selectedWallet);
  }, [hub, selectedWallet]);
};
