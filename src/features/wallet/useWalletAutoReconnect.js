/**
 * Restore a previously connected UniSat session when the app loads.
 *
 * ord-connect remembers which wallet was used (in localStorage) but not its
 * live addresses, so on boot the app has to ask the extension for them again.
 * This hook does that, once, at the app root.
 *
 * It used to live inside `useConnect`, which is where the strobing came from.
 * The effect listed `address`, `publicKey` and `format` in its dependencies and
 * then, on success, wrote all three — and ord-connect's setters store a brand
 * new object every time, so a successful reconnect always re-triggered the
 * effect that caused it. Worse, every component calling `useConnect` ran its
 * own copy, so several of those loops raced: one copy's success wrote an
 * address while another's failure called `disconnectWallet`, which is why the
 * wallet panel flipped between the address and "Connect wallet" while the page
 * re-rendered hundreds of times a second.
 *
 * Two rules keep it from coming back:
 *   1. only primitives (`wallet`, `network`, `chain`) are dependencies, so
 *      nothing this effect writes can re-trigger it;
 *   2. it is mounted in exactly one place — <App /> — so there is one attempt,
 *      not one per consumer.
 */
import { useEffect, useRef } from 'react';
import { Wallet, useOrdConnect } from '@ordzaar/ord-connect';
import { useConnect } from './useConnect.ts';

/** How long to wait for the extension to inject `window.unisat`. */
const UNISAT_READY_TIMEOUT_MS = 10000;
const UNISAT_POLL_MS = 100;

/**
 * Resolves true once `window.unisat` exists, false if it never turns up.
 * The previous version polled forever, so a stale "unisat" in localStorage on
 * a browser without the extension left a promise pending for the life of the
 * tab.
 */
const waitForUnisatExtension = () =>
  new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.unisat) {
      resolve(true);
      return;
    }
    const deadline = Date.now() + UNISAT_READY_TIMEOUT_MS;
    const poll = () => {
      if (typeof window !== 'undefined' && window.unisat) resolve(true);
      else if (Date.now() >= deadline) resolve(false);
      else setTimeout(poll, UNISAT_POLL_MS);
    };
    setTimeout(poll, UNISAT_POLL_MS);
  });

const noop = () => {};

export const useWalletAutoReconnect = () => {
  const {
    wallet: connectedWallet,
    network,
    chain,
    disconnectWallet,
  } = useOrdConnect();
  const { connectWallet } = useConnect({ onClose: noop, onError: noop });

  /*
   * Read these through refs. `connectWallet` gets a new identity on most
   * renders, and `disconnectWallet` could too; as dependencies they would
   * re-run the effect on every render, which is the other half of the loop.
   */
  const connectRef = useRef(connectWallet);
  connectRef.current = connectWallet;
  const disconnectRef = useRef(disconnectWallet);
  disconnectRef.current = disconnectWallet;

  useEffect(() => {
    if (connectedWallet !== Wallet.UNISAT) return undefined;

    let cancelled = false;
    let listening = false;
    const onAccountsChanged = () => connectRef.current(Wallet.UNISAT);

    (async () => {
      // An explicit disconnect outranks the remembered wallet.
      if (typeof window !== 'undefined' && window.bitprint?.isDisconnected) {
        return;
      }

      if (!(await waitForUnisatExtension())) {
        // The extension is gone. Forget the wallet rather than retrying.
        if (!cancelled) disconnectRef.current();
        return;
      }
      if (cancelled) return;

      const connected = await connectRef.current(Wallet.UNISAT, {
        readOnly: true,
      });
      // A failure has already been reported and disconnected by useConnect;
      // it is deliberately not retried.
      if (cancelled || !connected) return;

      window.unisat?.addListener('accountsChanged', onAccountsChanged);
      listening = true;
    })();

    return () => {
      cancelled = true;
      if (listening) {
        window.unisat?.removeListener('accountsChanged', onAccountsChanged);
      }
    };
    // Primitives only — see the note at the top of this file.
  }, [connectedWallet, network, chain]);
};
