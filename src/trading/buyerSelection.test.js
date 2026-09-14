import { getBuyerCandidates } from './buyerSelection';

const wallet = (index) => ({ index, address: `bc1p${index}` });
const indexes = (wallets) => wallets.map((w) => w.index);

describe('getBuyerCandidates', () => {
  test('full, ordered wallet list: wallets after the seller, wrapping around', () => {
    const wallets = [0, 1, 2, 3].map(wallet);
    expect(indexes(getBuyerCandidates(wallets, wallets[1]))).toEqual([2, 3, 0]);
    expect(indexes(getBuyerCandidates(wallets, wallets[3]))).toEqual([0, 1, 2]);
  });

  test('shuffled subset never offers the seller as a buyer', () => {
    // Active wallets #6, #2, #8 in random order. The seller's global index (2)
    // is not its position in this array.
    const wallets = [wallet(6), wallet(2), wallet(8)];
    const seller = wallets[1];
    expect(indexes(getBuyerCandidates(wallets, seller))).toEqual([8, 6]);
  });

  test('matches the seller by address when wallet objects are recreated', () => {
    const wallets = [wallet(0), wallet(1), wallet(2)];
    const seller = { ...wallet(1), address: 'BC1P1' };
    expect(indexes(getBuyerCandidates(wallets, seller))).toEqual([2, 0]);
  });

  test('a single wallet has no buyers', () => {
    const only = wallet(0);
    expect(getBuyerCandidates([only], only)).toEqual([]);
  });

  test('seller outside the list: every wallet is a candidate', () => {
    const wallets = [wallet(0), wallet(1)];
    expect(indexes(getBuyerCandidates(wallets, wallet(9)))).toEqual([0, 1]);
  });
});
