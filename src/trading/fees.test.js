import {
  calculateTradingFeeAmount,
  estimateAutoTradePurchaseCost,
  FEE_SETTLEMENT_RESERVE_SATS,
  PURCHASE_NETWORK_FEE_RESERVE_SATS,
} from './fees';

describe('app fee helpers', () => {
  it('is 1% of the purchase price, with no per-purchase minimum', () => {
    // The dust minimum applies to the settlement output, not each purchase.
    expect(calculateTradingFeeAmount(100000)).toBe(1000);
    expect(calculateTradingFeeAmount(1000)).toBe(10);
    expect(calculateTradingFeeAmount(0)).toBe(0);
  });

  it('reserves the fee and a share of its settlement when fees are on', () => {
    expect(estimateAutoTradePurchaseCost(100000, true)).toBe(
      100000 +
        PURCHASE_NETWORK_FEE_RESERVE_SATS +
        1000 +
        FEE_SETTLEMENT_RESERVE_SATS
    );
  });

  it('reserves nothing for fees when they are off', () => {
    expect(estimateAutoTradePurchaseCost(100000, false)).toBe(
      100000 + PURCHASE_NETWORK_FEE_RESERVE_SATS
    );
  });

  it('counts fees the wallet already owes, whether or not this one pays', () => {
    expect(estimateAutoTradePurchaseCost(100000, false, 7000)).toBe(
      100000 + PURCHASE_NETWORK_FEE_RESERVE_SATS + 7000
    );
  });
});
