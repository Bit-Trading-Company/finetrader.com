import * as bitcoin from 'bitcoinjs-lib';
import { signPsbtWithProxyWallet } from '../../lib/bitcoinUtils';
import {
  getMempoolAddressUtxoUrl,
  getMempoolBroadcastUrl,
  getMempoolTxHexUrl,
  getMempoolTxUrl,
} from '../../lib/mempoolProvider';
import { buildUnisatProxyUrl } from '../../lib/unisatProxy';

// Dust threshold - outputs below this are unspendable
const DUST_THRESHOLD = 546;

// Fee rate constants (sat/vbyte)
const DEFAULT_FEE_RATE = 10;

// Taproot tx size estimates (vbytes)
// Overhead: 10.5 vbytes, P2TR input: ~57.5 vbytes, P2TR output: ~43 vbytes
const VBYTES_OVERHEAD = 10.5;
const VBYTES_PER_P2TR_INPUT = 57.5;
const VBYTES_PER_P2TR_OUTPUT = 43;

/**
 * Estimate the fee for a consolidation transaction
 * @param {number} inputCount - Number of inputs
 * @param {number} outputCount - Number of outputs (usually 1)
 * @param {number} feeRate - Fee rate in sat/vbyte
 * @returns {number} Estimated fee in satoshis
 */
export const estimateConsolidationFee = (
  inputCount,
  outputCount = 1,
  feeRate = DEFAULT_FEE_RATE
) => {
  const vbytes =
    VBYTES_OVERHEAD +
    inputCount * VBYTES_PER_P2TR_INPUT +
    outputCount * VBYTES_PER_P2TR_OUTPUT;
  return Math.ceil(vbytes * feeRate);
};

/**
 * Fetch UTXOs for a given address from the mempool API
 * @param {string} address - Bitcoin address
 * @param {string} network - Network type
 * @returns {Promise<Array>} Array of UTXO objects
 */
export const fetchUtxos = async (address, network = 'mainnet') => {
  const url = getMempoolAddressUtxoUrl(address, network);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch UTXOs for ${address}: ${response.status}`);
  }
  const utxos = await response.json();
  return Array.isArray(utxos) ? utxos : [];
};

/**
 * Query the UniSat indexer (via the /api/unisat proxy) for inscription info on
 * a specific UTXO. Returns true if the UTXO has inscriptions (i.e., is an
 * "ordinal" UTXO).
 *
 * @param {string} txid
 * @param {number} vout
 * @returns {Promise<boolean>}
 */
const utxoHasInscriptions = async (txid, vout) => {
  const url = buildUnisatProxyUrl(
    `utxo/${encodeURIComponent(String(txid))}/${encodeURIComponent(String(vout))}`
  );

  const res = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });

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

/**
 * Fetch inscription flags for all UTXOs (sequential to reduce rate-limit risk).
 *
 * @param {Array} utxos - mempool UTXOs with {txid, vout, value}
 * @returns {Promise<boolean[]>} array aligned with utxos (true => has inscriptions)
 */
const getUtxoInscriptionFlags = async (utxos) => {
  const flags = [];
  for (let i = 0; i < utxos.length; i++) {
    const u = utxos[i];
    // true => ordinal/inscription UTXO
    const has = await utxoHasInscriptions(u.txid, u.vout);
    flags.push(Boolean(has));
  }
  return flags;
};

/**
 * Detect address scriptpubkey type
 * @param {string} address
 * @returns {'p2tr'|'p2wpkh'|'p2pkh'|'p2sh'}
 */
const detectAddressFormat = (address) => {
  if (!address) return 'p2tr';
  if (address.startsWith('bc1p') || address.startsWith('tb1p')) return 'p2tr';
  if (
    (address.startsWith('bc1') && address.length === 42) ||
    (address.startsWith('tb1') && address.length === 42)
  )
    return 'p2wpkh';
  if (
    address.startsWith('1') ||
    address.startsWith('m') ||
    address.startsWith('n')
  )
    return 'p2pkh';
  if (address.startsWith('3') || address.startsWith('2')) return 'p2sh';
  return 'p2tr';
};

/**
 * Build output values for a wallet sweep: one output per UTXO, preserving each
 * UTXO's exact sat value. The entire tx fee is absorbed by a chosen (non-ordinal)
 * UTXO so that ordinals and other UTXOs pass through untouched.
 *
 * @param {Array} utxos - Array of UTXO objects with .value
 * @param {number} fee - Total fee in sats
 * @param {number} feeUtxoIdx - Index of the UTXO that will pay the fee
 * @returns {number[]|null} Output values in the same order as utxos, or null if
 *                          the chosen UTXO cannot cover the fee
 */
const buildOutputValues = (utxos, fee, feeUtxoIdx) => {
  if (feeUtxoIdx == null || feeUtxoIdx < 0 || feeUtxoIdx >= utxos.length)
    return null;
  const values = utxos.map((u) => u.value);
  values[feeUtxoIdx] -= fee;

  if (values[feeUtxoIdx] < DUST_THRESHOLD) return null;

  return values;
};

/**
 * Build output values where the fee may be distributed across a provided set of
 * indices (all of which are known to be non-ordinal).
 *
 * @param {Array} utxos
 * @param {number} fee
 * @param {number[]} nonOrdinalIndices - indices in utxos that are safe to deduct from
 * @returns {number[]|null}
 */
const buildOutputValuesFromNonOrdinalSet = (utxos, fee, nonOrdinalIndices) => {
  if (!Array.isArray(nonOrdinalIndices) || nonOrdinalIndices.length === 0)
    return null;

  const values = utxos.map((u) => u.value);
  let remaining = fee;

  const order = nonOrdinalIndices
    .map((i) => ({ i, value: utxos[i]?.value ?? 0 }))
    .sort((a, b) => b.value - a.value);

  for (const { i } of order) {
    if (remaining <= 0) break;
    const maxTake = values[i] - DUST_THRESHOLD;
    const take = Math.min(remaining, maxTake);
    if (take > 0) {
      values[i] -= take;
      remaining -= take;
    }
  }

  if (remaining > 0) return null;
  return values;
};

/**
 * Build, sign, and broadcast a sweep PSBT for a single proxy wallet.
 * Creates one output per UTXO (preserving individual UTXOs and ordinals),
 * all sent to the destination address. The tx fee is absorbed by a verified
 * non-ordinal UTXO (starting from the largest). If no non-ordinal UTXO exists,
 * we log it and do not broadcast.
 *
 * @param {Object} params
 * @param {Object} params.wallet - Proxy wallet { address, privateKey, publicKey }
 * @param {string} params.destinationAddress - Address to send all funds to
 * @param {string} params.network - 'mainnet' | 'testnet' | 'signet'
 * @param {number} params.feeRate - Satoshis per vbyte (default: 10)
 * @param {Function} params.addLog - Log callback (message, link?)
 * @returns {Promise<{txid: string|null, skipped: boolean, error: string|null}>}
 */
export const consolidateWallet = async ({
  wallet,
  destinationAddress,
  network = 'mainnet',
  feeRate = DEFAULT_FEE_RATE,
  addLog,
}) => {
  const log = (msg, link) => addLog && addLog(msg, link);
  const shortAddr = `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}`;

  try {
    log(`  Fetching UTXOs for wallet ${shortAddr}...`);

    const utxos = await fetchUtxos(wallet.address, network);

    if (utxos.length === 0) {
      log(`  Skipping ${shortAddr} — no UTXOs found`);
      return { txid: null, skipped: true, error: null };
    }

    const totalSats = utxos.reduce((sum, u) => sum + u.value, 0);
    // Fee for N inputs → N outputs (one output per UTXO)
    const estimatedFee = estimateConsolidationFee(
      utxos.length,
      utxos.length,
      feeRate
    );

    if (totalSats <= estimatedFee) {
      log(
        `  Skipping ${shortAddr} — balance (${totalSats} sats) too low to cover fees (${estimatedFee} sats)`
      );
      return { txid: null, skipped: true, error: null };
    }

    // IMPORTANT (ordinals): To preserve inscriptions, we must prevent fee deduction
    // from changing the FIFO sat flow across outputs. We do this by:
    // - ordering inputs/outputs so ALL inscription UTXOs come first
    // - emitting outputs for those inscription UTXOs first with EXACT same value
    // - paying fees ONLY from non-ordinal UTXOs that come AFTER ordinal outputs
    log(
      `  Checking UTXOs for inscriptions (to preserve ordinal value/sat ranges)...`
    );

    let hasInscriptionFlags = [];
    try {
      hasInscriptionFlags = await getUtxoInscriptionFlags(utxos);
    } catch (e) {
      const message = e?.message || String(e);
      log(`  ✗ Cannot verify ordinal status for ${shortAddr}: ${message}`);
      console.log(
        `[WalletConsolidator] Cannot verify ordinal status for ${wallet.address}. Not broadcasting. Reason: ${message}`
      );
      return { txid: null, skipped: true, error: null };
    }

    const enriched = utxos.map((u, i) => ({
      ...u,
      __hasInscriptions: Boolean(hasInscriptionFlags[i]),
      __origIndex: i,
    }));

    const ordinalUtxos = enriched.filter((u) => u.__hasInscriptions);
    const nonOrdinalUtxos = enriched.filter((u) => !u.__hasInscriptions);

    if (nonOrdinalUtxos.length === 0) {
      log(
        `  Skipping ${shortAddr} — no non-ordinal UTXOs available to pay fee (will not broadcast)`
      );
      console.log(
        `[WalletConsolidator] Address has no non-ordinal UTXOs to pay fee. Not broadcasting for ${wallet.address}`
      );
      return { txid: null, skipped: true, error: null };
    }

    // Stable ordering: ordinals first (preserve), then non-ordinals.
    // Within each group, keep mempool ordering to avoid surprising reshuffles.
    const orderedUtxos = [...ordinalUtxos, ...nonOrdinalUtxos];

    // Fee UTXO selection: start with largest NON-ordinal UTXO.
    let feeUtxoIdx = null;
    for (let i = ordinalUtxos.length; i < orderedUtxos.length; i++) {
      if (
        feeUtxoIdx == null ||
        orderedUtxos[i].value > orderedUtxos[feeUtxoIdx].value
      )
        feeUtxoIdx = i;
    }

    // Fee absorbed by chosen non-ordinal UTXO. If that would go dust, try
    // distributing across all non-ordinal UTXOs (still never touching ordinals).
    let outputValues = buildOutputValues(
      orderedUtxos,
      estimatedFee,
      feeUtxoIdx
    );
    if (!outputValues) {
      log(
        `  Largest non-ordinal UTXO can't absorb fee; distributing fee across non-ordinal UTXOs...`
      );

      const nonOrdinalIdxs = [];
      for (let i = ordinalUtxos.length; i < orderedUtxos.length; i++) {
        nonOrdinalIdxs.push(i);
      }

      outputValues = buildOutputValuesFromNonOrdinalSet(
        orderedUtxos,
        estimatedFee,
        nonOrdinalIdxs
      );

      if (!outputValues) {
        log(
          `  Skipping ${shortAddr} — no safe (non-ordinal) UTXO set can cover fee without dust (will not broadcast)`
        );
        console.log(
          `[WalletConsolidator] No safe fee-paying UTXO set for ${wallet.address}. Not broadcasting.`
        );
        return { txid: null, skipped: true, error: null };
      }
    }

    const validOutputCount = outputValues.filter(
      (v) => v >= DUST_THRESHOLD
    ).length;
    const feeUtxo = orderedUtxos[feeUtxoIdx];
    log(
      `  Fee will be paid by non-ordinal UTXO: ${feeUtxo.txid.slice(0, 8)}...:${feeUtxo.vout} (${feeUtxo.value} sats)`
    );
    log(
      `  Building PSBT: ${orderedUtxos.length} input(s) → ${validOutputCount} output(s) ` +
        `(fee: ${estimatedFee} sats, absorbed by non-ordinal UTXO)`
    );
    if (ordinalUtxos.length > 0) {
      log(
        `  Ordinal UTXOs preserved: ${ordinalUtxos.length} inscription UTXO(s) output first with exact value`
      );
    }

    // Build PSBT
    const networkConfig =
      network === 'mainnet'
        ? bitcoin.networks.bitcoin
        : bitcoin.networks.testnet;

    const psbt = new bitcoin.Psbt({ network: networkConfig });

    const addressFormat = detectAddressFormat(wallet.address);
    const pubkeyBuffer = Buffer.from(wallet.publicKey, 'hex');

    // Add all UTXOs as inputs
    for (const utxo of orderedUtxos) {
      const inputData = {
        hash: utxo.txid,
        index: utxo.vout,
        sequence: 0xffffffff,
      };

      if (utxo.scriptpubkey) {
        const scriptBuffer = Buffer.from(utxo.scriptpubkey, 'hex');
        const scriptHex = utxo.scriptpubkey;

        if (scriptHex.startsWith('5120')) {
          // P2TR (Taproot)
          inputData.witnessUtxo = {
            script: new Uint8Array(scriptBuffer),
            value: BigInt(utxo.value),
          };
          const xOnlyPubkey = pubkeyBuffer.slice(1, 33);
          inputData.tapInternalKey = xOnlyPubkey;
        } else if (scriptHex.startsWith('0014')) {
          // P2WPKH
          inputData.witnessUtxo = {
            script: new Uint8Array(scriptBuffer),
            value: BigInt(utxo.value),
          };
        } else if (scriptHex.startsWith('76')) {
          // P2PKH — needs full tx hex
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
        // No scriptpubkey — derive from public key
        if (addressFormat === 'p2tr') {
          const xOnlyPubkey = pubkeyBuffer.slice(1, 33);
          const payment = bitcoin.payments.p2tr({
            internalPubkey: xOnlyPubkey,
            network: networkConfig,
          });
          inputData.witnessUtxo = {
            script: new Uint8Array(payment.output),
            value: BigInt(utxo.value),
          };
          inputData.tapInternalKey = xOnlyPubkey;
        } else {
          const payment = bitcoin.payments.p2wpkh({
            pubkey: pubkeyBuffer,
            network: networkConfig,
          });
          inputData.witnessUtxo = {
            script: new Uint8Array(payment.output),
            value: BigInt(utxo.value),
          };
        }
      }

      psbt.addInput(inputData);
    }

    // Add one output per UTXO — skip dust outputs (their fee was still paid as inputs)
    for (let i = 0; i < orderedUtxos.length; i++) {
      const outValue = outputValues[i];
      if (outValue >= DUST_THRESHOLD) {
        psbt.addOutput({
          address: destinationAddress,
          value: BigInt(outValue),
        });
      }
    }

    const psbtBase64 = psbt.toBase64();

    log(`  Signing PSBT...`);

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

    if (!signed.hex) {
      throw new Error('Signing produced no transaction hex');
    }

    log(`  Broadcasting transaction...`);

    const broadcastUrl = getMempoolBroadcastUrl(network);
    const broadcastRes = await fetch(broadcastUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: signed.hex,
    });

    if (!broadcastRes.ok) {
      const errText = await broadcastRes
        .text()
        .catch(() => broadcastRes.statusText);
      throw new Error(`Broadcast failed: ${errText}`);
    }

    const txid = (await broadcastRes.text()).trim();
    const txUrl = getMempoolTxUrl(txid, network);

    log(`  ✓ Broadcast success! TXID: ${txid.slice(0, 16)}...`, txUrl);
    return { txid, skipped: false, error: null };
  } catch (err) {
    const message = err?.message || String(err);
    log(`  ✗ Error consolidating ${shortAddr}: ${message}`);
    return { txid: null, skipped: false, error: message };
  }
};

/**
 * Consolidate funds from multiple proxy wallets to a single destination address.
 *
 * @param {Object} params
 * @param {Array} params.wallets - Array of proxy wallet objects
 * @param {string} params.destinationAddress - Destination Bitcoin address
 * @param {string} params.network - Network type
 * @param {number} params.feeRate - Fee rate in sat/vbyte
 * @param {Function} params.addLog - Log callback
 * @param {Function} params.onWalletComplete - Called after each wallet with result
 * @param {Function} params.isStopRequested - Returns true if user requested stop
 * @returns {Promise<Object>} Summary of results
 */
export const consolidateAllWallets = async ({
  wallets,
  destinationAddress,
  network = 'mainnet',
  feeRate = DEFAULT_FEE_RATE,
  addLog,
  onWalletComplete,
  isStopRequested = () => false,
}) => {
  const log = (msg, link) => addLog && addLog(msg, link);
  const results = { success: 0, skipped: 0, failed: 0, txids: [] };

  for (let i = 0; i < wallets.length; i++) {
    if (isStopRequested()) {
      log('\n⏹ Consolidation stopped by user');
      break;
    }

    const wallet = wallets[i];
    log(
      `\nProcessing wallet ${i + 1}/${wallets.length}: ${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}`
    );

    const result = await consolidateWallet({
      wallet,
      destinationAddress,
      network,
      feeRate,
      addLog: addLog,
    });

    if (result.skipped) {
      results.skipped++;
    } else if (result.error) {
      results.failed++;
    } else {
      results.success++;
      results.txids.push(result.txid);
    }

    if (onWalletComplete) {
      onWalletComplete(i, result);
    }

    // Small delay between wallets to avoid rate limiting
    if (i < wallets.length - 1 && !isStopRequested()) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  log(
    `\n✓ Consolidation complete: ${results.success} sent, ${results.skipped} skipped, ${results.failed} failed`
  );
  return results;
};

/**
 * Validate a Bitcoin address format
 * @param {string} address
 * @param {string} network
 * @returns {boolean}
 */
export const isValidBitcoinAddress = (address, network = 'mainnet') => {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  if (trimmed.length < 26 || trimmed.length > 62) return false;

  if (network === 'mainnet') {
    // Mainnet: P2PKH (1...), P2SH (3...), P2WPKH/P2WSH (bc1q...), P2TR (bc1p...)
    return /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{6,87})$/.test(
      trimmed
    );
  } else {
    // Testnet/signet
    return /^(m[a-km-zA-HJ-NP-Z1-9]{25,34}|n[a-km-zA-HJ-NP-Z1-9]{25,34}|2[a-km-zA-HJ-NP-Z1-9]{25,34}|tb1[a-z0-9]{6,87})$/.test(
      trimmed
    );
  }
};
