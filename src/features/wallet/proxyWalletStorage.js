/**
 * Persistence for the proxy wallet selected in WalletManagement, so other
 * components (and a page reload) can pick up the same wallet.
 *
 * Only which wallet it is — index, address, public key. The private key is
 * never written: it used to be, in plain text, where it outlived disconnect
 * and was handed to whoever connected next in the same browser. Code that
 * signs gets the live wallet, keys included, from the wallet session (or
 * the `wallet-selected` event on the legacy panels), which re-derives it
 * from the user's signature.
 */

export const SELECTED_PROXY_WALLET_KEY = 'selected-proxy-wallet';

/**
 * @returns {{ index: number, address: string, publicKey: string } | null}
 *   never a private key
 */
export const loadSelectedProxyWallet = () => {
  try {
    const stored = localStorage.getItem(SELECTED_PROXY_WALLET_KEY);
    if (!stored) return null;
    const { index, address, publicKey } = JSON.parse(stored);
    return { index, address, publicKey };
  } catch (err) {
    console.error('Error restoring proxy wallet from localStorage:', err);
    return null;
  }
};

/** Persist the selected proxy wallet, or clear it when `wallet` is empty. */
export const saveSelectedProxyWallet = (wallet) => {
  if (!wallet) {
    clearSelectedProxyWallet();
    return;
  }
  localStorage.setItem(
    SELECTED_PROXY_WALLET_KEY,
    JSON.stringify({
      index: wallet.index,
      address: wallet.address,
      publicKey: wallet.publicKey,
    })
  );
};

export const clearSelectedProxyWallet = () => {
  localStorage.removeItem(SELECTED_PROXY_WALLET_KEY);
};

/**
 * Remove a private key that an older version of the app stored here.
 * Run once at startup; keeps the rest of the record.
 */
export const scrubStoredProxyWalletKey = () => {
  try {
    const stored = localStorage.getItem(SELECTED_PROXY_WALLET_KEY);
    if (!stored || !stored.includes('privateKey')) return;
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && 'privateKey' in parsed) {
      saveSelectedProxyWallet(parsed);
    }
  } catch {
    // An unreadable record cannot be trusted either.
    clearSelectedProxyWallet();
  }
};
