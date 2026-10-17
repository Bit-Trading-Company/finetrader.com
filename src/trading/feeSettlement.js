/**
 * Paying what the fee ledger (./feeLedger) says a wallet owes.
 *
 * One transaction covers every purchase a wallet owes for, and it is only
 * sent once the amount is worth sending:
 *
 *   during a run    when a wallet owes FEE_SETTLEMENT_THRESHOLD_SATS
 *   at Stop / end   when it owes FEE_SETTLEMENT_ON_STOP_SATS
 *   on withdrawal   the Consolidator adds what is owed to its sweep
 *
 * Below those, what is owed carries to the next run. That is the point:
 * paying 1% of a cheap item in its own transaction cost more in miner fees
 * than the fee was worth.
 */
import { getMempoolTxApiUrl, getMempoolTxUrl } from '../lib/mempoolProvider';
import {
  getOwedEntries,
  getOwedSats,
  getSettlingEntries,
  markSettled,
  markSettling,
  releaseSettling,
} from './feeLedger';
import { MIN_TRADING_FEE_OUTPUT_SATS } from './fees';
import { sendFeePayment } from './feeTransaction';

export const FEE_SETTLEMENT_THRESHOLD_SATS = 20000;
export const FEE_SETTLEMENT_ON_STOP_SATS = 5000;

/*
 * A settlement that has not appeared anywhere after this long never made it
 * out; its entries go back to owed. Long enough to ride out an explorer that
 * is slow to index.
 */
const SETTLING_GIVE_UP_MS = 30 * 60 * 1000;

const formatBtc = (sats) => (sats / 100000000).toFixed(8);

/** Wallets with a settlement under way in this tab. */
const inFlight = new Set();

/**
 * Resolve "settling" entries against the network: a settlement the explorer
 * knows is paid; one it has never heard of, long enough after signing, is
 * owed again. An unreachable explorer changes nothing.
 */
export const reconcileSettlements = async (address, network = 'mainnet') => {
  const byTxid = new Map();
  for (const entry of getSettlingEntries(address)) {
    byTxid.set(entry.settlingTxid, entry.settlingAt || 0);
  }

  for (const [txid, settlingAt] of byTxid) {
    let status = null;
    try {
      const response = await fetch(getMempoolTxApiUrl(txid, network));
      status = response.status;
    } catch {
      continue;
    }
    if (status === 200) markSettled(address, txid);
    else if (status === 404 && Date.now() - settlingAt > SETTLING_GIVE_UP_MS) {
      releaseSettling(address, txid);
    }
  }
};

/**
 * Settle one wallet if it owes at least `minimumSats`.
 *
 * @param {Object} wallet proxy wallet ({ address, publicKey, privateKey, index })
 * @param {Object} [options]
 * @param {string} [options.network]
 * @param {number} [options.minimumSats] skip below this
 * @param {Function} [options.addConsoleLog]
 * @returns {Promise<{ status: 'paid'|'below-minimum'|'nothing-owed'|'busy'|'failed', owedSats: number, txid?: string, error?: string }>}
 */
export const settleWalletFees = async (wallet, options = {}) => {
  const {
    network = 'mainnet',
    minimumSats = FEE_SETTLEMENT_THRESHOLD_SATS,
    addConsoleLog = null,
  } = options;
  const log = (message, link) =>
    typeof addConsoleLog === 'function' && addConsoleLog(message, link);
  const address = wallet?.address;
  if (!address) return { status: 'nothing-owed', owedSats: 0 };
  if (inFlight.has(address)) {
    return { status: 'busy', owedSats: getOwedSats(address) };
  }

  inFlight.add(address);
  try {
    await reconcileSettlements(address, network);

    const entries = getOwedEntries(address);
    const owedSats = entries.reduce((t, e) => t + e.feeSats, 0);
    if (owedSats === 0) return { status: 'nothing-owed', owedSats };
    if (owedSats < Math.max(minimumSats, MIN_TRADING_FEE_OUTPUT_SATS)) {
      return { status: 'below-minimum', owedSats };
    }

    const label = `wallet #${(wallet.index ?? 0) + 1}`;
    const result = await sendFeePayment({
      wallet,
      amountSats: owedSats,
      network,
      onSigned: (txid) =>
        markSettling(
          address,
          entries.map((e) => e.purchaseTxid),
          txid
        ),
    });

    if (result.success) {
      markSettled(address, result.txid);
      log(
        `  💸 App fee paid from ${label}: ${formatBtc(owedSats)} BTC for ${entries.length} purchase(s)`,
        getMempoolTxUrl(result.txid, network)
      );
      return { status: 'paid', owedSats, txid: result.txid };
    }

    // Refused outright: nothing went out, so it is owed again now. Anything
    // else stays "settling" until reconcileSettlements can tell.
    if (result.broadcastRejected && result.txid) {
      releaseSettling(address, result.txid);
    }
    log(
      `  ⚠ App fee from ${label} not paid yet (${formatBtc(owedSats)} BTC owed): ${result.error}. It stays owed and is retried later.`
    );
    return { status: 'failed', owedSats, error: result.error };
  } finally {
    inFlight.delete(address);
  }
};

/**
 * Settle every wallet that owes at least `minimumSats`, one at a time.
 * @returns {Promise<{ paidSats: number, stillOwedSats: number }>}
 */
export const settleOwedFees = async ({
  wallets,
  network = 'mainnet',
  minimumSats = FEE_SETTLEMENT_THRESHOLD_SATS,
  addConsoleLog = null,
}) => {
  let paidSats = 0;
  let stillOwedSats = 0;
  for (const wallet of wallets || []) {
    if (!wallet?.address || getOwedSats(wallet.address) === 0) continue;
    const result = await settleWalletFees(wallet, {
      network,
      minimumSats,
      addConsoleLog,
    });
    if (result.status === 'paid') paidSats += result.owedSats;
    else stillOwedSats += result.owedSats;
  }
  return { paidSats, stillOwedSats };
};
