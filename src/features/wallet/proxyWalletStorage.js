/**
 * Persistence for the proxy wallet selected in WalletManagement, so other
 * components (and a page reload) can pick up the same wallet.
 *
 * SECURITY: the stored record includes the proxy wallet's private key in plain
 * text, because components sign with it after a reload. See
 * docs/KNOWN_ISSUES.md before relying on this in new code.
 */

export const SELECTED_PROXY_WALLET_KEY = 'selected-proxy-wallet';

/**
 * @returns {{ index: number, address: string, publicKey: string, privateKey: string } | null}
 */
export const loadSelectedProxyWallet = () => {
  try {
    const stored = localStorage.getItem(SELECTED_PROXY_WALLET_KEY);
    if (!stored) return null;
    const { index, address, publicKey, privateKey } = JSON.parse(stored);
    return { index, address, publicKey, privateKey };
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
      privateKey: wallet.privateKey,
    })
  );
};

export const clearSelectedProxyWallet = () => {
  localStorage.removeItem(SELECTED_PROXY_WALLET_KEY);
};
