import { mapWithLimit, readBalance } from './useProxyWalletBalances';

describe('readBalance', () => {
  it('derives the balance from funded minus spent', () => {
    expect(
      readBalance({
        chain_stats: {
          funded_txo_sum: 150000,
          spent_txo_sum: 50000,
          funded_txo_count: 4,
          spent_txo_count: 1,
          tx_count: 5,
        },
        mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
      })
    ).toEqual({
      confirmed: 100000,
      pending: 0,
      total: 100000,
      utxoCount: 3,
      txCount: 5,
    });
  });

  it('reports an outgoing unconfirmed spend as a negative pending delta', () => {
    const balance = readBalance({
      chain_stats: { funded_txo_sum: 100000, spent_txo_sum: 0 },
      mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 30000 },
    });

    expect(balance.pending).toBe(-30000);
    expect(balance.total).toBe(70000);
  });

  it('treats a wallet the explorer has never seen as empty', () => {
    expect(readBalance({})).toEqual({
      confirmed: 0,
      pending: 0,
      total: 0,
      utxoCount: 0,
      txCount: 0,
    });
  });
});

describe('mapWithLimit', () => {
  it('keeps results in input order regardless of completion order', async () => {
    const delays = [30, 0, 15, 0, 5];
    const results = await mapWithLimit(delays, 2, async (ms, index) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return index;
    });

    expect(results).toEqual([0, 1, 2, 3, 4]);
  });

  it('never runs more than `limit` tasks at once', async () => {
    let inFlight = 0;
    let peak = 0;

    await mapWithLimit(Array.from({ length: 12 }), 3, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
    });

    expect(peak).toBeLessThanOrEqual(3);
  });

  it('handles an empty list without hanging', async () => {
    await expect(mapWithLimit([], 4, async () => 1)).resolves.toEqual([]);
  });
});
