import {
  getOwedEntries,
  getOwedSats,
  getSettledSats,
  getSettlingEntries,
  markSettled,
  markSettling,
  recordFeeOwed,
  releaseSettling,
} from './feeLedger';

const W = 'bc1pWallet';

beforeEach(() => localStorage.clear());

describe('fee ledger', () => {
  it('records 1% per purchase, once per purchase txid', () => {
    expect(recordFeeOwed(W, { purchaseTxid: 'a', priceSats: 150000 })).toEqual({
      recorded: true,
      feeSats: 1500,
    });
    // The same purchase again — a retried cycle — is not charged twice.
    expect(recordFeeOwed(W, { purchaseTxid: 'a', priceSats: 150000 })).toEqual({
      recorded: false,
      feeSats: 1500,
    });
    recordFeeOwed(W, { purchaseTxid: 'b', priceSats: 50000 });
    expect(getOwedSats(W)).toBe(2000);
    // Addresses are case-insensitive keys.
    expect(getOwedSats(W.toLowerCase())).toBe(2000);
  });

  it('keeps wallets apart', () => {
    recordFeeOwed(W, { purchaseTxid: 'a', priceSats: 100000 });
    expect(getOwedSats('bc1pother')).toBe(0);
  });

  it('moves entries through settling to settled', () => {
    recordFeeOwed(W, { purchaseTxid: 'a', priceSats: 100000 });
    recordFeeOwed(W, { purchaseTxid: 'b', priceSats: 100000 });

    markSettling(W, ['a', 'b'], 'settle-1');
    // In flight: no longer up for the next settlement, but still owed.
    expect(getOwedEntries(W)).toEqual([]);
    expect(getSettlingEntries(W)).toHaveLength(2);
    expect(getOwedSats(W)).toBe(2000);

    // A purchase recorded meanwhile is not part of that settlement.
    recordFeeOwed(W, { purchaseTxid: 'c', priceSats: 100000 });
    markSettled(W, 'settle-1');
    expect(getOwedSats(W)).toBe(1000);
    expect(getSettledSats(W)).toBe(2000);
    expect(getOwedEntries(W).map((e) => e.purchaseTxid)).toEqual(['c']);
  });

  it('puts a settlement that never went out back to owed', () => {
    recordFeeOwed(W, { purchaseTxid: 'a', priceSats: 100000 });
    markSettling(W, ['a'], 'settle-1');
    releaseSettling(W, 'settle-1');
    expect(getOwedEntries(W).map((e) => e.purchaseTxid)).toEqual(['a']);
  });

  it('ignores purchases that owe nothing', () => {
    expect(recordFeeOwed(W, { purchaseTxid: 'a', priceSats: 0 }).recorded).toBe(
      false
    );
    expect(recordFeeOwed(W, { priceSats: 100000 }).recorded).toBe(false);
  });
});
