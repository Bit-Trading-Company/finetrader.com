/**
 * Exchange-independent helpers for reading the token / inscription objects
 * returned by marketplace APIs.
 */

/**
 * Get token ID from ordinal - tries multiple possible field names
 * @param {Object} ordinal - The ordinal object
 * @returns {string|null} Token ID or null
 */
export const getTokenId = (ordinal) => {
  if (!ordinal) return null;
  return (
    ordinal.tokenId ||
    // Satflow item / wallet-contents shape
    ordinal.inscriptionId ||
    ordinal.id ||
    (ordinal.inscriptionNumber
      ? `${ordinal.txid || ordinal.genesisTransaction || ''}i${ordinal.inscriptionNumber}`
      : null)
  );
};

/**
 * Get inscription ID from an ordinal (used for explorer / marketplace links)
 * @param {Object} ordinal - The ordinal object
 * @returns {string|null} Inscription ID
 */
export const getInscriptionId = (ordinal) => {
  if (!ordinal) return null;
  return (
    ordinal.inscriptionId ||
    (ordinal.inscriptionNumber
      ? `${ordinal.txid || ordinal.genesisTransaction || ''}i${ordinal.inscriptionNumber}`
      : null)
  );
};

/**
 * Check if an item has a pending transaction (mempool tx)
 * Items without mempoolTxId are ready to be listed/traded
 * @param {Object} item - The item/token object
 * @returns {boolean} True if item has a pending transaction
 */
export const hasPendingTransaction = (item) => {
  return !!(item.mempoolTxId && item.mempoolTxId !== '');
};
