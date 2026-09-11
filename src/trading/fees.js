export const TRADING_FEE_RECEIVER_ADDRESS =
  'bc1p45w8kgh694x7r2laqwfyyfslaqv0shjcrpzu5gkypk3wxmlz5prs3w6dgm';
export const TRADING_FEE_PERCENTAGE = 0.01;
export const MIN_TRADING_FEE_OUTPUT_SATS = 330;
export const PURCHASE_NETWORK_FEE_RESERVE_SATS = 10000;
export const FEE_TX_MINER_RESERVE_SATS = 10000;

export const calculateTradingFeeAmount = (purchasePrice) => {
  const price = Math.floor(Number(purchasePrice) || 0);
  if (price <= 0) return 0;
  const nominalFeeSats = Math.floor(price * TRADING_FEE_PERCENTAGE);
  return Math.max(nominalFeeSats, MIN_TRADING_FEE_OUTPUT_SATS);
};

export const estimateAutoTradePurchaseCost = (
  purchasePrice,
  useFees = true
) => {
  const price = Math.floor(Number(purchasePrice) || 0);
  const tradingFeeReserve = useFees
    ? calculateTradingFeeAmount(price) + FEE_TX_MINER_RESERVE_SATS
    : 0;
  return price + PURCHASE_NETWORK_FEE_RESERVE_SATS + tradingFeeReserve;
};
