import {
  calculateTradingFeeAmount,
  estimateAutoTradePurchaseCost,
  FEE_TX_MINER_RESERVE_SATS,
  MIN_TRADING_FEE_OUTPUT_SATS,
  PURCHASE_NETWORK_FEE_RESERVE_SATS,
} from './tradingFeeUtils';

describe('auto trading fee helpers', () => {
  it('uses the minimum relay-safe fee when 1% is below dust', () => {
    expect(calculateTradingFeeAmount(1000)).toBe(MIN_TRADING_FEE_OUTPUT_SATS);
  });

  it('uses 1% of the purchase price when above the minimum fee', () => {
    expect(calculateTradingFeeAmount(100000)).toBe(1000);
  });

  it('reserves purchase miner fee, trading fee, and fee tx miner fee when fees are enabled', () => {
    const purchasePrice = 100000;

    expect(estimateAutoTradePurchaseCost(purchasePrice, true)).toBe(
      purchasePrice +
        PURCHASE_NETWORK_FEE_RESERVE_SATS +
        calculateTradingFeeAmount(purchasePrice) +
        FEE_TX_MINER_RESERVE_SATS
    );
  });

  it('does not reserve the trading fee path when fees are disabled', () => {
    const purchasePrice = 100000;

    expect(estimateAutoTradePurchaseCost(purchasePrice, false)).toBe(
      purchasePrice + PURCHASE_NETWORK_FEE_RESERVE_SATS
    );
  });
});
