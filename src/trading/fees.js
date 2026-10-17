/**
 * The Fine Trader app fee: 1% of each purchase an auto-trade run makes.
 *
 * It is not paid per purchase. Each purchase adds what it owes to the buying
 * wallet's ledger (./feeLedger), and the ledger is settled in one transaction
 * per wallet (./feeSettlement) — so a cheap item no longer costs more in miner
 * fees to pay for than the fee itself is worth.
 */

export const TRADING_FEE_RECEIVER_ADDRESS =
  'bc1p45w8kgh694x7r2laqwfyyfslaqv0shjcrpzu5gkypk3wxmlz5prs3w6dgm';
export const TRADING_FEE_PERCENTAGE = 0.01;

/**
 * The smallest fee output a settlement will create: Taproot's dust limit.
 * A wallet owing less carries it until it owes more.
 */
export const MIN_TRADING_FEE_OUTPUT_SATS = 330;

export const PURCHASE_NETWORK_FEE_RESERVE_SATS = 10000;

/**
 * What a purchase sets aside towards the miner fee of the settlement that
 * will eventually pay its app fee. A settlement is one ~154 vB transaction,
 * shared by every purchase it covers, so this is generous.
 */
export const FEE_SETTLEMENT_RESERVE_SATS = 2000;

/** The app fee one purchase owes, in sats. */
export const calculateTradingFeeAmount = (purchasePrice) => {
  const price = Math.floor(Number(purchasePrice) || 0);
  if (price <= 0) return 0;
  return Math.floor(price * TRADING_FEE_PERCENTAGE);
};

/**
 * What a wallet must hold to make a purchase without leaving itself unable
 * to pay what it owes.
 *
 * @param {number} purchasePrice sats
 * @param {boolean} useFees whether this purchase will owe the app fee
 * @param {number} [owedSats] app fees the wallet already owes. Counted
 *   whether or not this purchase pays a fee: owed is owed.
 */
export const estimateAutoTradePurchaseCost = (
  purchasePrice,
  useFees = true,
  owedSats = 0
) => {
  const price = Math.floor(Number(purchasePrice) || 0);
  const owed = Math.max(0, Math.floor(Number(owedSats) || 0));
  const thisFee = useFees
    ? calculateTradingFeeAmount(price) + FEE_SETTLEMENT_RESERVE_SATS
    : 0;
  return price + PURCHASE_NETWORK_FEE_RESERVE_SATS + owed + thisFee;
};
