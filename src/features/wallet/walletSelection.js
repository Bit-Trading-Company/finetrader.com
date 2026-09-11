/**
 * Which proxy wallets a page acts on.
 *
 * AutoTrade, the Wallet Consolidator and the Ordinal Extractor let the user
 * pick a custom subset of the generated proxy wallets. An empty subset means
 * no wallets: these pages ask for at least one, and the actions behind them
 * move funds, so the selection must never widen back to every wallet.
 *
 * @template {object} W
 * @param {W[]} wallets all generated proxy wallets
 * @param {{ useCustomSubset?: boolean, selectedIndices?: Set<number> }} [options]
 * @returns {W[]}
 */
export const selectActiveWallets = (wallets, options = {}) => {
  if (!Array.isArray(wallets)) return [];
  if (!options.useCustomSubset) return wallets;
  const selected = options.selectedIndices || new Set();
  return wallets.filter((_, index) => selected.has(index));
};
