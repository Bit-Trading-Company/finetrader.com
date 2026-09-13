/**
 * Balances for a set of proxy wallets.
 *
 * The advanced auto-trader shows every proxy wallet at once, so this fetches
 * the address summary (one request per wallet) rather than enumerating UTXOs
 * — a funded wallet can hold thousands of them, and the dashboard only needs
 * the totals. Pages that must spend the UTXOs use `fetchAddressUtxos`.
 *
 * Requests run a few at a time: the public Esplora instances rate-limit, and
 * a user with 100 wallets would otherwise open 100 connections at once.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getMempoolAddressUrl } from '../../lib/mempoolProvider';

/** Concurrent address lookups. Kept low to stay under provider rate limits. */
const CONCURRENCY = 5;

/**
 * @typedef {object} WalletBalance
 * @property {string} address
 * @property {number} index
 * @property {number} confirmed settled balance, in sats
 * @property {number} pending unconfirmed delta, in sats (can be negative)
 * @property {number} total confirmed + pending
 * @property {number} utxoCount confirmed unspent outputs
 * @property {number} txCount confirmed transactions
 */

/**
 * Esplora's address summary reports cumulative funded/spent totals; the
 * balance is the difference, and the same subtraction over `mempool_stats`
 * gives the unconfirmed delta.
 */
export const readBalance = (stats) => {
  const chain = stats?.chain_stats || {};
  const pool = stats?.mempool_stats || {};
  const confirmed = (chain.funded_txo_sum || 0) - (chain.spent_txo_sum || 0);
  const pending = (pool.funded_txo_sum || 0) - (pool.spent_txo_sum || 0);
  return {
    confirmed,
    pending,
    total: confirmed + pending,
    utxoCount: (chain.funded_txo_count || 0) - (chain.spent_txo_count || 0),
    txCount: chain.tx_count || 0,
  };
};

/**
 * Run `task` over `items`, at most `limit` at a time.
 * Resolves once every item has settled.
 */
export const mapWithLimit = async (items, limit, task) => {
  const results = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
};

/**
 * @param {import('./WalletSession').ProxyWallet[]} wallets
 * @param {{network?: string, enabled?: boolean}} [options]
 * @returns {{
 *   balances: Record<string, WalletBalance>,
 *   totals: {confirmed: number, pending: number, funded: number},
 *   isLoading: boolean,
 *   error: string|null,
 *   refresh: () => void,
 * }}
 */
export const useProxyWalletBalances = (wallets, options = {}) => {
  const { network = 'mainnet', enabled = true } = options;

  const [balances, setBalances] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Bumping this re-runs the effect without it depending on a new array
  // identity every render.
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  // The effect should re-run when the set of addresses changes, not when the
  // caller happens to hand over a new array holding the same wallets.
  const addresses = wallets.map((w) => w.address).join(',');
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;

  useEffect(() => {
    if (!enabled || !addresses) {
      setBalances({});
      return undefined;
    }

    let cancelled = false;
    const list = walletsRef.current;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const entries = await mapWithLimit(list, CONCURRENCY, async (w) => {
          try {
            const response = await fetch(
              getMempoolAddressUrl(w.address, network)
            );
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const stats = await response.json();
            return [
              w.address,
              { address: w.address, index: w.index, ...readBalance(stats) },
            ];
          } catch {
            // One unreachable address should not blank the whole table; the
            // row renders as unknown instead.
            return [w.address, null];
          }
        });

        if (cancelled) return;

        const next = {};
        let failures = 0;
        entries.forEach(([address, balance]) => {
          if (balance) next[address] = balance;
          else failures += 1;
        });

        setBalances(next);
        if (failures === list.length) {
          setError('Could not reach the block explorer');
        } else if (failures > 0) {
          setError(`${failures} of ${list.length} balances unavailable`);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [addresses, network, enabled, nonce]);

  const totals = Object.values(balances).reduce(
    (acc, b) => ({
      confirmed: acc.confirmed + b.confirmed,
      pending: acc.pending + b.pending,
      funded: acc.funded + (b.total > 0 ? 1 : 0),
    }),
    { confirmed: 0, pending: 0, funded: 0 }
  );

  return { balances, totals, isLoading, error, refresh };
};
