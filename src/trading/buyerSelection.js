/**
 * Buyer rotation for auto-trade purchases between proxy wallets.
 */

const addressKey = (wallet) => String(wallet?.address || '').toLowerCase();

/**
 * Wallets that may buy an item listed by `sellerWallet`, in rotation order:
 * the wallets after the seller in `wallets`, wrapping around, seller excluded.
 *
 * `wallets` is the active subset of proxy wallets and may be shuffled
 * (AutoTrade's random wallet order), so the seller is located by address
 * rather than by its global `index`. When the seller is not in `wallets`,
 * every wallet is a candidate.
 *
 * @template {{ address?: string }} W
 * @param {W[]} wallets
 * @param {W} sellerWallet
 * @returns {W[]}
 */
export const getBuyerCandidates = (wallets, sellerWallet) => {
  const sellerKey = addressKey(sellerWallet);
  const isSeller = (wallet) =>
    wallet === sellerWallet ||
    (sellerKey !== '' && addressKey(wallet) === sellerKey);

  const sellerPosition = wallets.findIndex(isSeller);
  const start = sellerPosition === -1 ? 0 : sellerPosition + 1;
  return [...wallets.slice(start), ...wallets.slice(0, start)].filter(
    (wallet) => !isSeller(wallet)
  );
};
