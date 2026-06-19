import * as bitcoin from 'bitcoinjs-lib';
import { signPsbtWithProxyWallet } from './bitcoinUtils';
import {
  getMempoolBroadcastUrl,
  getMempoolTxHexUrl,
  getMempoolTxUrl,
} from './mempoolProvider';
import { estimateConsolidationFee, fetchUtxos } from './consolidatorUtils';

const DUST_THRESHOLD = 546;

/** Same-origin proxy (dev: setupProxy, prod: /api/unisat.js) — avoids browser CORS to UniSat. */
const buildUnisatProxyUrl = (indexerPath, query = {}) => {
  const params = new URLSearchParams();
  params.set('path', String(indexerPath).replace(/^\/+/, ''));
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  return `/api/unisat?${params.toString()}`;
};

const utxoHasInscriptions = async (txid, vout) => {
  const url = buildUnisatProxyUrl(
    `utxo/${encodeURIComponent(String(txid))}/${encodeURIComponent(String(vout))}`
  );

  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Unisat utxo lookup failed (${res.status}): ${text.slice(0, 200)}`
    );
  }
  const body = await res.json();
  const data = body && body.data ? body.data : null;
  const inscriptionsCount =
    data && data.inscriptionsCount != null ? Number(data.inscriptionsCount) : 0;
  const inscriptions =
    data && Array.isArray(data.inscriptions) ? data.inscriptions : [];
  return inscriptionsCount > 0 || inscriptions.length > 0;
};

export const pickLargestNonOrdinalFeeUtxo = async (
  utxos,
  { exclude = [] } = {}
) => {
  const excluded = new Set(exclude.map((e) => `${e.txid}:${e.vout}`));
  const candidates = utxos
    .filter((u) => !excluded.has(`${u.txid}:${u.vout}`))
    .slice()
    .sort((a, b) => b.value - a.value);

  for (const c of candidates) {
    const has = await utxoHasInscriptions(c.txid, c.vout);
    if (!has) return c;
  }
  return null;
};

export const fetchInscriptionUtxoData = async (
  address,
  { cursor = 0, size = 16 } = {}
) => {
  const url = buildUnisatProxyUrl(
    `address/${encodeURIComponent(address)}/inscription-utxo-data`,
    { cursor: String(cursor), size: String(size) }
  );

  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text.slice(0, 200);
    try {
      const parsed = JSON.parse(text);
      if (parsed?.hint)
        detail = `${parsed.msg || parsed.message || ''} — ${parsed.hint}`;
      else if (parsed?.msg) detail = String(parsed.msg);
    } catch {
      // keep raw slice
    }
    if (res.status === 403 || res.status === 401) {
      const lower = detail.toLowerCase();
      if (lower.includes('invalid token')) {
        detail +=
          ' Check UNISAT_API_KEY in frontend/.env: copy only the API key from https://developer.unisat.io/ (no "Bearer ", no quotes, not pasted twice). Restart npm start.';
      } else if (
        lower.includes('authorization') ||
        lower.includes('unauthenticated')
      ) {
        detail +=
          ' Add UNISAT_API_KEY to frontend/.env (https://developer.unisat.io/) and restart the dev server.';
      }
    }
    throw new Error(
      `Unisat inscription-utxo-data failed (${res.status}): ${detail}`
    );
  }
  const body = await res.json();
  return body && body.data ? body.data : { utxo: [], total: 0, cursor };
};

export const fetchAllInscriptionUtxos = async (
  address,
  { pageSize = 16 } = {}
) => {
  let cursor = 0;
  let total = null;
  const out = [];

  // Safety cap so we don't accidentally loop forever
  for (let page = 0; page < 50; page++) {
    const data = await fetchInscriptionUtxoData(address, {
      cursor,
      size: pageSize,
    });

    const utxos = Array.isArray(data.utxo) ? data.utxo : [];
    out.push(...utxos);
    if (typeof data.total === 'number') total = data.total;

    cursor = (data.cursor || 0) + utxos.length;
    if (utxos.length === 0) break;
    if (total != null && out.length >= total) break;
  }

  return out;
};

const detectScriptTypeFromHex = (scriptHex = '') => {
  if (scriptHex.startsWith('5120')) return 'p2tr';
  if (scriptHex.startsWith('0014')) return 'p2wpkh';
  if (scriptHex.startsWith('76')) return 'p2pkh';
  return 'unknown';
};

const getPrevoutScriptHexFromTxHex = async (
  txid,
  vout,
  network = 'mainnet'
) => {
  const txHexRes = await fetch(getMempoolTxHexUrl(txid, network));
  if (!txHexRes.ok) {
    const txt = await txHexRes.text().catch(() => '');
    throw new Error(
      `Failed to fetch tx hex for ${txid} (${txHexRes.status}): ${txt.slice(0, 120)}`
    );
  }
  const txHex = await txHexRes.text();
  const tx = bitcoin.Transaction.fromHex(txHex.trim());
  const out = tx.outs && tx.outs[vout] ? tx.outs[vout] : null;
  if (!out || !out.script) {
    throw new Error(`Cannot locate vout ${vout} in tx ${txid}`);
  }
  return Buffer.from(out.script).toString('hex');
};

const buildPsbtInput = async ({ utxo, network, pubkeyBuffer }) => {
  const inputData = {
    hash: utxo.txid,
    index: utxo.vout,
    sequence: 0xffffffff,
  };

  let scriptHex = utxo.scriptpubkey || utxo.scriptPk || '';
  if (!scriptHex) {
    // Esplora address/utxo does not include scriptpubkey.
    // Resolve it from the parent transaction output script.
    scriptHex = await getPrevoutScriptHexFromTxHex(
      utxo.txid,
      utxo.vout,
      network
    );
  }

  if (scriptHex) {
    const scriptBuffer = Buffer.from(scriptHex, 'hex');
    const scriptType = detectScriptTypeFromHex(scriptHex);

    if (scriptType === 'p2tr') {
      inputData.witnessUtxo = {
        script: new Uint8Array(scriptBuffer),
        value: BigInt(utxo.value),
      };
      // Taproot key-path spends require internal key.
      // For connected wallets, the wallet itself can sign without this, but
      // providing it improves compatibility. We infer it from pubkeyBuffer if present.
      if (pubkeyBuffer && pubkeyBuffer.length >= 33) {
        inputData.tapInternalKey = pubkeyBuffer.slice(1, 33);
      }
    } else if (scriptType === 'p2wpkh') {
      inputData.witnessUtxo = {
        script: new Uint8Array(scriptBuffer),
        value: BigInt(utxo.value),
      };
    } else if (scriptType === 'p2pkh') {
      const txHexRes = await fetch(getMempoolTxHexUrl(utxo.txid, network));
      if (!txHexRes.ok)
        throw new Error(`Failed to fetch tx hex for ${utxo.txid}`);
      const txHex = await txHexRes.text();
      inputData.nonWitnessUtxo = Buffer.from(txHex, 'hex');
    } else {
      inputData.witnessUtxo = {
        script: new Uint8Array(scriptBuffer),
        value: BigInt(utxo.value),
      };
    }
  } else {
    // We require scriptpubkey/scriptPk for reliable signing.
    throw new Error(`Missing script for utxo ${utxo.txid}:${utxo.vout}`);
  }

  return inputData;
};

/**
 * Build an extraction PSBT that creates a 546-sat output which contains the inscription.
 * If offset >= 546, we also create a leading "padding" output of value=offset to shift
 * the inscription sat to the next output boundary, while keeping the inscription output 546.
 *
 * Fee is subtracted from the final change output (never from the 546 inscription output).
 */
export const buildInscriptionExtractionPsbtBase64 = async ({
  inscriptionUtxo,
  inscription,
  feeUtxo = null,
  destinationAddress,
  changeAddress,
  feeRate,
  network = 'mainnet',
  // optional: used for p2tr tapInternalKey hint
  walletPublicKeyHex = null,
}) => {
  if (!inscriptionUtxo?.txid) throw new Error('Missing inscription UTXO');
  if (!destinationAddress) throw new Error('Missing destinationAddress');
  if (!changeAddress) throw new Error('Missing changeAddress');

  const inscriptions = Array.isArray(inscriptionUtxo.inscriptions)
    ? inscriptionUtxo.inscriptions
    : [];
  if (inscriptions.length < 1)
    throw new Error('Selected UTXO has no inscriptions in Unisat data');

  const target =
    inscription && inscription.inscriptionId
      ? inscriptions.find((i) => i.inscriptionId === inscription.inscriptionId)
      : null;

  if (!target) {
    if (inscriptions.length === 1) {
      // Allow single-inscription UTXOs without extra selection.
      // eslint-disable-next-line no-param-reassign
      inscription = inscriptions[0];
    } else {
      throw new Error(
        `UTXO ${inscriptionUtxo.txid}:${inscriptionUtxo.vout} has multiple inscriptions; select which inscriptionId to extract.`
      );
    }
  }

  const chosen = target || inscription;
  const offset = Number(chosen.offset || 0);
  if (!Number.isFinite(offset) || offset < 0) throw new Error('Invalid offset');

  const pubkeyBuffer = walletPublicKeyHex
    ? Buffer.from(walletPublicKeyHex, 'hex')
    : null;

  // Inputs must be ordered so inscription UTXO comes first (FIFO sat flow).
  const inputs = [inscriptionUtxo];
  if (feeUtxo) inputs.push(feeUtxo);

  // Fixed outputs that guarantee the inscription lands in the 546 output
  const fixedOutputs = [];
  if (offset >= DUST_THRESHOLD) {
    fixedOutputs.push({ address: changeAddress, value: BigInt(offset) });
  }
  fixedOutputs.push({
    address: destinationAddress,
    value: BigInt(DUST_THRESHOLD),
  });

  // Estimate fee and compute change
  const inputCount = inputs.length;
  const outputCountAssumingChange = fixedOutputs.length + 1;
  const estimatedFee = estimateConsolidationFee(
    inputCount,
    outputCountAssumingChange,
    feeRate
  );

  const totalIn = inputs.reduce((s, u) => s + Number(u.value), 0);
  const fixedOutSum = fixedOutputs.reduce((s, o) => s + Number(o.value), 0);
  const changeValue = totalIn - fixedOutSum - estimatedFee;

  if (changeValue < DUST_THRESHOLD) {
    throw new Error(
      `Insufficient change after fee. Need >=${DUST_THRESHOLD} sats for change, got ${changeValue}. ` +
        `Try adding a fee UTXO or lowering feeRate.`
    );
  }

  const psbtNetwork =
    network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
  const psbt = new bitcoin.Psbt({ network: psbtNetwork });

  for (const u of inputs) {
    const inputData = await buildPsbtInput({
      utxo: u,
      network,
      pubkeyBuffer,
    });
    psbt.addInput(inputData);
  }

  // Outputs order matters: fixed outputs first, change last.
  for (const out of fixedOutputs) {
    psbt.addOutput({ address: out.address, value: out.value });
  }
  psbt.addOutput({ address: changeAddress, value: BigInt(changeValue) });

  return { psbtBase64: psbt.toBase64(), estimatedFee, changeValue, offset };
};

export const broadcastTxHex = async ({ txHex, network = 'mainnet' }) => {
  const broadcastUrl = getMempoolBroadcastUrl(network);
  const broadcastRes = await fetch(broadcastUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: txHex,
  });
  if (!broadcastRes.ok) {
    const errText = await broadcastRes
      .text()
      .catch(() => broadcastRes.statusText);
    throw new Error(`Broadcast failed: ${errText}`);
  }
  const txid = (await broadcastRes.text()).trim();
  return { txid, txUrl: getMempoolTxUrl(txid, network) };
};

export const extractInscriptionFromProxyWallet = async ({
  wallet,
  inscriptionUtxo,
  inscription,
  destinationAddress,
  feeRate,
  network = 'mainnet',
}) => {
  const allUtxos = await fetchUtxos(wallet.address, network);
  const feeUtxo = await pickLargestNonOrdinalFeeUtxo(allUtxos, {
    exclude: [{ txid: inscriptionUtxo.txid, vout: inscriptionUtxo.vout }],
  });

  const { psbtBase64 } = await buildInscriptionExtractionPsbtBase64({
    inscriptionUtxo: {
      ...inscriptionUtxo,
      value: inscriptionUtxo.value ?? inscriptionUtxo.satoshi,
      scriptpubkey: inscriptionUtxo.scriptpubkey ?? inscriptionUtxo.scriptPk,
    },
    inscription,
    feeUtxo: feeUtxo || null,
    destinationAddress,
    changeAddress: wallet.address,
    feeRate,
    network,
    walletPublicKeyHex: wallet.publicKey || null,
  });

  const signed = await signPsbtWithProxyWallet(
    psbtBase64,
    wallet.privateKey,
    network,
    {
      finalize: true,
      extractTx: true,
      walletAddress: wallet.address,
    }
  );

  if (!signed?.hex) throw new Error('Signing produced no tx hex');
  return await broadcastTxHex({ txHex: signed.hex, network });
};
