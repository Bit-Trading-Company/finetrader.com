/**
 * Keeping inscriptions and runes out of transactions that only mean to move
 * bitcoin.
 *
 * Every wallet this app touches can hold inscriptions on ordinary-looking
 * outputs, and an inscription spent as payment or fee is gone. Three tools,
 * from cheapest to most thorough:
 *
 *   fetchHeldInscriptions     one paged UniSat call: every inscription an
 *                             address holds, with the outpoint it sits on
 *   isUnconfirmedPostageSized a just-received inscription that no index has
 *                             seen yet looks exactly like small change
 *   checkOutpointIsPlain      one UniSat call per outpoint, inscriptions and
 *                             runes both; for the few inputs actually spent
 *
 * All of them fail closed: an answer that cannot be read is an error, never
 * "this output is plain".
 */
import { buildUnisatProxyUrl } from './unisatProxy';

/*
 * An unconfirmed output at or below this is treated as an inscription.
 *
 * A wallet that has just bought holds the new inscription on an unconfirmed
 * output, often 10,000 sats (ord.net's listings carry that much), which the
 * owner index may not have caught up with. Change that small is not worth
 * the risk of guessing wrong.
 */
export const UNCONFIRMED_POSTAGE_CEILING_SATS = 10000;

/** True for an output that may be an inscription no index has seen yet. */
export const isUnconfirmedPostageSized = (utxo) =>
  utxo?.status?.confirmed === false &&
  Number(utxo.value) <= UNCONFIRMED_POSTAGE_CEILING_SATS;

export const outpointKey = (txid, vout) =>
  `${String(txid).toLowerCase()}:${Number(vout)}`;

/**
 * Inscriptions an address holds, from UniSat's owner-indexed API.
 *
 * @param {string} address
 * @returns {Promise<Map<string, {inscriptionId: string, inscriptionNumber: number, txid: string, vout: number}>>}
 *   keyed by inscription id
 * @throws when any page cannot be read: a partial list could let an
 *   inscription through as money
 */
export const fetchHeldInscriptions = async (address) => {
  const held = new Map();
  let cursor = 0;

  for (let page = 0; page < 20; page++) {
    const response = await fetch(
      buildUnisatProxyUrl(
        `address/${encodeURIComponent(address)}/inscription-utxo-data`,
        { cursor: String(cursor), size: '100' }
      ),
      { headers: { accept: 'application/json' } }
    );
    if (!response.ok) {
      throw new Error(
        `Could not read the inscriptions held by ${address} (HTTP ${response.status})`
      );
    }

    const body = await response.json();
    const data = body?.data;
    const utxos = Array.isArray(data?.utxo) ? data.utxo : [];

    for (const utxo of utxos) {
      for (const inscription of utxo.inscriptions || []) {
        if (!inscription?.inscriptionId) continue;
        held.set(inscription.inscriptionId, {
          inscriptionId: inscription.inscriptionId,
          inscriptionNumber: inscription.inscriptionNumber,
          txid: utxo.txid,
          vout: utxo.vout,
        });
      }
    }

    cursor += utxos.length;
    if (utxos.length === 0) break;
    if (typeof data?.total === 'number' && cursor >= data.total) break;
  }

  return held;
};

/** Outpoints (`txid:vout`) of everything `fetchHeldInscriptions` returns. */
export const fetchInscriptionOutpoints = async (address) =>
  new Set(
    Array.from((await fetchHeldInscriptions(address)).values()).map((h) =>
      outpointKey(h.txid, h.vout)
    )
  );

const hasPayload = (field) => {
  if (Array.isArray(field)) return field.length > 0;
  if (field && typeof field === 'object') return Object.keys(field).length > 0;
  return Boolean(field);
};

/**
 * Whether one outpoint carries neither inscriptions nor runes, per UniSat.
 *
 * @returns {Promise<boolean>}
 * @throws when UniSat cannot answer
 */
export const checkOutpointIsPlain = async (txid, vout) => {
  const response = await fetch(
    buildUnisatProxyUrl(
      `utxo/${encodeURIComponent(String(txid))}/${encodeURIComponent(String(vout))}`
    ),
    { headers: { accept: 'application/json' } }
  );
  if (!response.ok) {
    throw new Error(
      `Could not check ${txid}:${vout} for inscriptions (HTTP ${response.status})`
    );
  }
  const body = await response.json();
  const data = body?.data;
  if (!data || typeof data !== 'object') {
    throw new Error(`Could not check ${txid}:${vout} for inscriptions`);
  }

  const inscriptionsCount = Number(data.inscriptionsCount ?? 0);
  if (inscriptionsCount > 0 || hasPayload(data.inscriptions)) return false;
  if (
    [data.runes, data.rune, data.rune_balances, data.runeBalances].some(
      hasPayload
    )
  ) {
    return false;
  }
  return true;
};
