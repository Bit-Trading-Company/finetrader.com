import { fetchWalletBalance } from './chain';

const stats = (chain, mempool = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({
    chain_stats: { funded_txo_sum: 0, spent_txo_sum: 0, ...chain },
    mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0, ...mempool },
  }),
});

afterEach(() => {
  delete global.fetch;
});

describe('fetchWalletBalance', () => {
  it('is the confirmed balance', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        stats({ funded_txo_sum: 500000, spent_txo_sum: 100000 })
      );
    await expect(fetchWalletBalance('bc1p')).resolves.toBe(400000);
  });

  it('subtracts what is already flowing out in the mempool', async () => {
    // A purchase spent a 400k input and returned 150k change, unconfirmed.
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        stats(
          { funded_txo_sum: 400000 },
          { funded_txo_sum: 150000, spent_txo_sum: 400000 }
        )
      );
    await expect(fetchWalletBalance('bc1p')).resolves.toBe(150000);
  });

  it('does not count unconfirmed incoming funds', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        stats({ funded_txo_sum: 100000 }, { funded_txo_sum: 900000 })
      );
    await expect(fetchWalletBalance('bc1p')).resolves.toBe(100000);
  });

  it('is null, not zero, when the balance cannot be read', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    await expect(fetchWalletBalance('bc1p')).resolves.toBeNull();
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(fetchWalletBalance('bc1p')).resolves.toBeNull();
  });
});
