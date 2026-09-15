/**
 * Everything the app keeps in localStorage, and a way to throw it all away.
 *
 * Nothing here is irreplaceable: the Fine Trader wallets derive from a
 * signature, so reconnecting and signing again brings back the same wallets
 * and the same funds. That makes a full reset the safe first move when a
 * browser is carrying state from an older build.
 */

/** Key prefixes this app owns. Anything else in localStorage is left alone. */
const OWNED_PREFIXES = [
  'ord-connect_', // the wallet ord-connect remembers, and its addresses
  'fine-trading-', // display, run and fee preferences
  'proxy-wallet-',
  'wallet-',
  'selected-proxy-wallet',
  'previous-wallet-address',
];

/** @returns {string[]} the keys `resetAppStorage` would remove */
export const listAppStorageKeys = () => {
  try {
    return Object.keys(window.localStorage).filter((key) =>
      OWNED_PREFIXES.some((prefix) => key.startsWith(prefix))
    );
  } catch {
    return [];
  }
};

/**
 * Forget every piece of app state this browser is holding.
 * @returns {number} how many keys were removed
 */
export const resetAppStorage = () => {
  const keys = listAppStorageKeys();
  keys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* a key we cannot remove is not worth failing the reset over */
    }
  });
  return keys.length;
};
