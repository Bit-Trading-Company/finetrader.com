/**
 * What each proxy wallet owes in app fees, and what it has paid.
 *
 * One entry per purchase, keyed by the purchase txid, so recording the same
 * purchase twice — a retried cycle, two code paths — never charges twice.
 * An entry moves through three states:
 *
 *   owed      recorded, not yet in any transaction
 *   settling  in a signed settlement whose txid is known; written BEFORE the
 *             broadcast, so a tab closed mid-broadcast cannot leave the
 *             payment out or let the next settlement pay it again
 *   settled   that settlement is on the network
 *
 * `reconcile` in ./feeSettlement resolves "settling" entries against the
 * chain: found means settled, long gone means owed again.
 *
 * Kept in localStorage per wallet address, beside the wallets themselves:
 * proxy wallets only exist in this browser too.
 */
import { calculateTradingFeeAmount } from './fees';

const KEY_PREFIX = 'fine-trading-fee-ledger-v2:';
/** Paid entries kept for the record; owed ones are never dropped. */
const MAX_SETTLED_ENTRIES = 500;

const keyFor = (address) => `${KEY_PREFIX}${String(address).toLowerCase()}`;

/**
 * @typedef {Object} FeeEntry
 * @property {string} purchaseTxid
 * @property {number} priceSats
 * @property {number} feeSats
 * @property {number} recordedAt ms epoch
 * @property {string} [settlingTxid]
 * @property {number} [settlingAt]
 * @property {string} [settledTxid]
 * @property {number} [settledAt]
 */

/** @returns {FeeEntry[]} */
export const loadFeeEntries = (address) => {
  if (!address) return [];
  try {
    const raw = localStorage.getItem(keyFor(address));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
};

const saveFeeEntries = (address, entries) => {
  const owed = entries.filter((e) => !e.settledTxid);
  const settled = entries
    .filter((e) => e.settledTxid)
    .sort((a, b) => (b.settledAt || 0) - (a.settledAt || 0))
    .slice(0, MAX_SETTLED_ENTRIES);
  localStorage.setItem(
    keyFor(address),
    JSON.stringify({ entries: [...owed, ...settled] })
  );
};

const update = (address, change) => {
  const entries = loadFeeEntries(address);
  const next = change(entries);
  saveFeeEntries(address, next);
  return next;
};

/**
 * Record the app fee a purchase owes. Idempotent per purchase txid.
 * @returns {{ recorded: boolean, feeSats: number }} recorded is false when
 *   this purchase was already on the ledger (or owes nothing)
 */
export const recordFeeOwed = (address, { purchaseTxid, priceSats }) => {
  const feeSats = calculateTradingFeeAmount(priceSats);
  if (!address || !purchaseTxid || feeSats <= 0) {
    return { recorded: false, feeSats: 0 };
  }
  let recorded = false;
  update(address, (entries) => {
    if (entries.some((e) => e.purchaseTxid === purchaseTxid)) return entries;
    recorded = true;
    return [
      ...entries,
      {
        purchaseTxid,
        priceSats: Math.floor(Number(priceSats) || 0),
        feeSats,
        recordedAt: Date.now(),
      },
    ];
  });
  return { recorded, feeSats };
};

/** Entries owed and not in any settlement yet. */
export const getOwedEntries = (address) =>
  loadFeeEntries(address).filter((e) => !e.settledTxid && !e.settlingTxid);

/** Entries in a settlement that is not confirmed on the network yet. */
export const getSettlingEntries = (address) =>
  loadFeeEntries(address).filter((e) => e.settlingTxid && !e.settledTxid);

const sum = (entries) => entries.reduce((t, e) => t + (e.feeSats || 0), 0);

/**
 * Sats this wallet still has to pay, including any settlement in flight —
 * it is not paid until it is on the network.
 */
export const getOwedSats = (address) =>
  sum(loadFeeEntries(address).filter((e) => !e.settledTxid));

/** Sats this wallet has paid, over the entries still kept. */
export const getSettledSats = (address) =>
  sum(loadFeeEntries(address).filter((e) => e.settledTxid));

/** Put these entries in the settlement `txid`, before it is broadcast. */
export const markSettling = (address, purchaseTxids, txid) => {
  const ids = new Set(purchaseTxids);
  const at = Date.now();
  update(address, (entries) =>
    entries.map((e) =>
      ids.has(e.purchaseTxid) && !e.settledTxid
        ? { ...e, settlingTxid: txid, settlingAt: at }
        : e
    )
  );
};

/** The settlement `txid` reached the network: its entries are paid. */
export const markSettled = (address, txid) => {
  const at = Date.now();
  update(address, (entries) =>
    entries.map((e) =>
      e.settlingTxid === txid
        ? { ...e, settledTxid: txid, settledAt: at, settlingTxid: undefined }
        : e
    )
  );
};

/** The settlement `txid` never made it: its entries are owed again. */
export const releaseSettling = (address, txid) => {
  update(address, (entries) =>
    entries.map((e) =>
      e.settlingTxid === txid
        ? { ...e, settlingTxid: undefined, settlingAt: undefined }
        : e
    )
  );
};
