/**
 * Spendable UTXOs for an address.
 *
 * The mempool providers (mempool.space, blockstream.info) refuse to list
 * outputs for busy addresses: past 500 unspent outputs they answer
 * "Too many unspent transaction outputs" with HTTP 400. Trading wallets reach
 * that quickly, so whenever the provider fails we page through the UniSat
 * indexer (via the /api/unisat proxy) instead, and normalize its rows to the
 * provider's shape (`txid`, `vout`, `value`, `scriptpubkey`, `status`).
 *
 * Failures throw: callers must not mistake an unreachable API for an empty
 * wallet.
 */

import {
  getMempoolAddressUtxoUrl,
  getMempoolApiProvider,
  getMempoolProviderLabel,
} from './mempoolProvider';
import { buildUnisatProxyUrl } from './unisatProxy';

/** UniSat reports outputs that are still in the mempool with this height. */
const UNISAT_UNCONFIRMED_HEIGHT = 4194303;
const UNISAT_PAGE_SIZE = 500;
/** Safety net so a broken cursor cannot loop forever (500 * 200 = 100k UTXOs). */
const UNISAT_MAX_PAGES = 200;

/**
 * Turn one UniSat `utxo-data` row into the shape the mempool providers return.
 * @param {object} utxo
 */
export const normalizeUnisatUtxo = (utxo = {}) => {
  const height = Number(utxo.height);
  const confirmed =
    Number.isFinite(height) && height > 0 && height < UNISAT_UNCONFIRMED_HEIGHT;
  return {
    txid: utxo.txid,
    vout: Number(utxo.vout),
    value: Number(utxo.satoshi ?? utxo.value ?? 0),
    // UniSat spells it scriptPk; the PSBT builders read Esplora's name.
    scriptpubkey: utxo.scriptPk || utxo.scriptpubkey || undefined,
    status: {
      confirmed,
      ...(confirmed ? { block_height: height } : {}),
    },
    inscriptionsCount: Number(utxo.inscriptionsCount ?? 0),
  };
};

const describeResponse = async (label, response) => {
  const detail = await response.text().catch(() => '');
  return `${label} ${response.status}${detail ? `: ${detail.trim().slice(0, 200)}` : ''}`;
};

/** Page through UniSat's utxo-data for an address. */
const fetchUnisatUtxos = async (address, fetchImpl) => {
  const all = [];
  let cursor = 0;

  for (let page = 0; page < UNISAT_MAX_PAGES; page++) {
    const url = buildUnisatProxyUrl(
      `address/${encodeURIComponent(address)}/utxo-data`,
      { cursor: String(cursor), size: String(UNISAT_PAGE_SIZE) }
    );
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(await describeResponse('UniSat utxo-data', response));
    }

    const body = await response.json();
    const data = (body && body.data) || {};
    const rows = Array.isArray(data.utxo) ? data.utxo : [];
    for (const row of rows) {
      if (row && row.isSpent) continue;
      all.push(normalizeUnisatUtxo(row));
    }

    cursor += rows.length;
    const total = Number(data.total);
    if (rows.length < UNISAT_PAGE_SIZE) break;
    if (Number.isFinite(total) && cursor >= total) break;
  }

  return all;
};

/**
 * UTXOs for `address`, from the selected mempool provider, falling back to the
 * UniSat indexer when the provider cannot answer (too many outputs, rate
 * limits, outage).
 *
 * @param {string} address
 * @param {string} [network]
 * @param {{ fetchImpl?: typeof fetch }} [options] injection point for tests
 * @returns {Promise<object[]>} UTXOs as `{ txid, vout, value, scriptpubkey, status }`
 * @throws {Error} when neither source can answer
 */
export const fetchAddressUtxos = async (
  address,
  network = 'mainnet',
  options = {}
) => {
  if (!address) return [];
  const fetchImpl = options.fetchImpl || fetch;
  const providerLabel = getMempoolProviderLabel(getMempoolApiProvider());

  let providerError;
  try {
    const response = await fetchImpl(
      getMempoolAddressUtxoUrl(address, network)
    );
    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
    providerError = await describeResponse(providerLabel, response);
  } catch (error) {
    providerError = `${providerLabel}: ${error.message}`;
  }

  try {
    return await fetchUnisatUtxos(address, fetchImpl);
  } catch (unisatError) {
    throw new Error(
      `Could not load UTXOs for ${address}. ${providerError}. ${unisatError.message}`
    );
  }
};
