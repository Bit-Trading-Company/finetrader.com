/**
 * Bitcoin chain lookups via the mempool provider: transaction confirmation,
 * mempool presence and address balance.
 */

import {
  getMempoolTxStatusUrl,
  getMempoolTxUrl,
  getMempoolAddressUrl,
} from '../lib/mempoolProvider';

/**
 * Check if a transaction is confirmed (fallback method using mempool)
 * @param {string} txId - Transaction ID
 * @param {string} network - Network type
 * @returns {Promise<boolean>} True if confirmed
 */
export const checkTransactionConfirmed = async (txId, network = 'mainnet') => {
  try {
    const response = await fetch(
      getMempoolTxStatusUrl(txId, network || 'mainnet')
    );
    if (response.ok) {
      const data = await response.json();
      return data.confirmed || false;
    }
    return false;
  } catch (err) {
    console.error('Error checking transaction status:', err);
    return false;
  }
};

/**
 * Verify that a transaction has been accepted into the mempool
 * @param {string} txid - Transaction ID to verify
 * @param {string} network - Network type
 * @param {number} maxRetries - Maximum retry attempts (default: 10)
 * @param {number} retryDelay - Delay between retries in ms (default: 2000)
 * @returns {Promise<boolean>} True if tx is in mempool or confirmed
 */
export const verifyTxInMempool = async (
  txid,
  network = 'mainnet',
  maxRetries = 10,
  retryDelay = 2000
) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(getMempoolTxUrl(txid, network));
      if (response.ok) {
        // Transaction is in mempool or confirmed
        return true;
      }
      if (response.status === 404) {
        // Not yet in mempool, wait and retry
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, retryDelay));
          continue;
        }
      }
      // Other errors (500, etc.) - retry
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, retryDelay));
      }
    } catch (err) {
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, retryDelay));
      }
    }
  }
  return false; // Failed to verify after all retries
};

/**
 * What a wallet can spend, in sats — or null when that cannot be read.
 *
 * Null is not zero. This drives buyer selection, and a mempool.space hiccup
 * or 429 used to read as an empty wallet: every buyer looked broke, the
 * engine delisted the seller's items and could stop the run outright.
 * Callers treat null as "skip this wallet for now", never as "broke".
 *
 * The confirmed balance, less anything already flowing out in the mempool.
 * A purchase spends confirmed coin straight away; counting only confirmed
 * funds let the same wallet be picked again for money it had just spent.
 * Incoming unconfirmed funds are not counted.
 *
 * @param {string} address - Wallet address
 * @param {string} network - Network type
 * @returns {Promise<number|null>} Spendable balance in sats, or null if unknown
 */
export const fetchWalletBalance = async (address, network = 'mainnet') => {
  try {
    const response = await fetch(
      getMempoolAddressUrl(address, network || 'mainnet')
    );
    if (!response.ok) return null;
    const data = await response.json();
    const chain = data?.chain_stats;
    if (!chain) return null;
    const confirmed =
      Number(chain.funded_txo_sum || 0) - Number(chain.spent_txo_sum || 0);
    const mempool = data.mempool_stats || {};
    const pendingNet =
      Number(mempool.funded_txo_sum || 0) - Number(mempool.spent_txo_sum || 0);
    return Math.max(0, confirmed + Math.min(0, pendingNet));
  } catch (err) {
    console.error('Error fetching wallet balance:', err);
    return null;
  }
};
