/**
 * Pending-purchase bookkeeping for the AutoTrade page.
 *
 * A pending purchase is created by the engine after a purchase is broadcast
 * (`{ txid, tokenId, buyerWalletAddress, ... }`) and removed by
 * processWalletItems once the purchase confirms.
 */

const pendingKey = (purchase) =>
  [purchase?.txid, purchase?.tokenId, purchase?.buyerWalletAddress]
    .map((value) => String(value ?? ''))
    .join('|');

/**
 * Add newly created pending purchases to the current list without dropping
 * purchases that are still waiting for confirmation. An entry for the same
 * txid / token / buyer is replaced by the newer one, keeping its position.
 *
 * @param {object[]} [existing]
 * @param {object[]} [added]
 * @returns {object[]}
 */
export const mergePendingPurchases = (existing = [], added = []) => {
  const byKey = new Map();
  for (const purchase of [...(existing || []), ...(added || [])]) {
    byKey.set(pendingKey(purchase), purchase);
  }
  return [...byKey.values()];
};
