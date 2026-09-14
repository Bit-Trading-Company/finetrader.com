import { selectActiveWallets } from './walletSelection';

const wallets = [0, 1, 2].map((index) => ({ index, address: `bc1p${index}` }));
const indexes = (list) => list.map((w) => w.index);

describe('selectActiveWallets', () => {
  test('returns every wallet when no custom subset is used', () => {
    expect(selectActiveWallets(wallets)).toBe(wallets);
    expect(
      selectActiveWallets(wallets, { selectedIndices: new Set([1]) })
    ).toBe(wallets);
  });

  test('returns the ticked wallets, in list order', () => {
    expect(
      indexes(
        selectActiveWallets(wallets, {
          useCustomSubset: true,
          selectedIndices: new Set([2, 0]),
        })
      )
    ).toEqual([0, 2]);
  });

  test('an empty subset selects no wallets', () => {
    expect(
      selectActiveWallets(wallets, {
        useCustomSubset: true,
        selectedIndices: new Set(),
      })
    ).toEqual([]);
    expect(selectActiveWallets(wallets, { useCustomSubset: true })).toEqual([]);
  });

  test('tolerates a missing wallet list', () => {
    expect(selectActiveWallets(undefined)).toEqual([]);
  });
});
