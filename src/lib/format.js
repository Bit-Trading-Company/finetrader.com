/**
 * Display formatting helpers shared across the UI.
 */

export const SATS_PER_BTC = 100000000;

/**
 * Shorten long strings (txids, PSBTs, keys) to "first7...last7".
 * Strings of 14 characters or fewer are returned unchanged.
 * @param {string} [value]
 * @returns {string}
 */
export const truncateMiddle = (value) => {
  if (value && value.length > 14) {
    return `${value.slice(0, 7)}...${value.slice(-7)}`;
  }
  return value || '';
};

/**
 * Shorten an address to "first8...last8" ('' when missing).
 * @param {string} [address]
 * @returns {string}
 */
export const shortenAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
};

/**
 * Format a sats amount as BTC with 8 decimals; 'N/A' when the amount is missing.
 * @param {number} [sats]
 * @returns {string}
 */
export const formatSatsAsBtc = (sats) => {
  if (!sats && sats !== 0) return 'N/A';
  return (sats / SATS_PER_BTC).toFixed(8);
};

/**
 * Compact number: 1.23K / 4.56M / 7.89B; 'N/A' when missing.
 * @param {number} [num]
 * @returns {string}
 */
export const formatCompactNumber = (num) => {
  if (!num && num !== 0) return 'N/A';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toString();
};
