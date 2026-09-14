import { mergePendingPurchases } from './pendingPurchases';

const purchase = (txid, extra = {}) => ({
  txid,
  tokenId: `${txid}i0`,
  buyerWalletAddress: 'bc1pbuyer',
  ...extra,
});

describe('mergePendingPurchases', () => {
  test('keeps purchases still awaiting confirmation when new ones arrive', () => {
    const existing = [purchase('a'), purchase('b')];
    const added = [purchase('c')];
    expect(mergePendingPurchases(existing, added).map((p) => p.txid)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  test('replaces a duplicate entry in place with the newer one', () => {
    const existing = [purchase('a'), purchase('b', { price: 1 })];
    const added = [purchase('b', { price: 2 })];
    const merged = mergePendingPurchases(existing, added);
    expect(merged.map((p) => p.txid)).toEqual(['a', 'b']);
    expect(merged[1].price).toBe(2);
  });

  test('tolerates missing lists', () => {
    expect(mergePendingPurchases(undefined, [purchase('a')])).toHaveLength(1);
    expect(mergePendingPurchases([purchase('a')], null)).toHaveLength(1);
    expect(mergePendingPurchases()).toEqual([]);
  });
});
