/**
 * Builds, signs and broadcasts the auto-trade trading-fee transaction from a
 * proxy wallet. Fee amounts and the receiver address come from ./fees.
 */

import * as bitcoin from 'bitcoinjs-lib';
import {
  deriveAddressFromPrivateKey,
  derivePublicKeyFromPrivateKey,
  getTaprootInternalPubkeyBytes,
  signPsbtWithProxyWallet,
} from '../lib/bitcoinUtils';
import { fetchFeeRates, unattendedRate } from '../lib/feeRates';
import {
  getMempoolTxApiUrl,
  getMempoolAddressUtxoUrl,
  getMempoolAddressTxsMempoolUrl,
  getMempoolTxHexUrl,
  getMempoolBroadcastUrl,
} from '../lib/mempoolProvider';
import { buildUnisatProxyUrl } from '../lib/unisatProxy';
import {
  calculateTradingFeeAmount,
  TRADING_FEE_RECEIVER_ADDRESS,
} from './fees';

/**
 * Send trading fee (1% of purchase price, rounded up to dust if below relay threshold)
 * to fee receiver address. Uses non-ordinal UTXOs from the purchase tx and/or wallet.
 * @param {Object} wallet - Proxy wallet object
 * @param {number} purchasePrice - Purchase price in satoshis
 * @param {string} purchaseTxid - Purchase transaction ID
 * @param {string} network - Network type
 * @param {Function|null} _addConsoleLog - Unused; fee payments are silent in the trading console.
 * @returns {Promise<Object>} Result with success, txid, error
 */
export const sendTradingFee = async (
  wallet,
  purchasePrice,
  purchaseTxid,
  network = 'mainnet',
  addConsoleLog = null
) => {
  const log = (message) => {
    if (typeof addConsoleLog === 'function') addConsoleLog(message);
  };

  try {
    // Nominal fee: 1% of purchase (sats). If below dust, send the minimum relay-safe output.
    const feeAmount = calculateTradingFeeAmount(purchasePrice);

    if (feeAmount <= 0) {
      const errorMsg = 'Fee amount is zero or negative';
      return {
        success: false,
        error: errorMsg,
      };
    }

    if (!purchaseTxid) {
      const errorMsg = 'Purchase transaction ID is required';
      return {
        success: false,
        error: errorMsg,
      };
    }

    // Derive wallet address and public key
    let address, publicKey;
    try {
      address = deriveAddressFromPrivateKey(wallet.privateKey, network);
      publicKey = derivePublicKeyFromPrivateKey(wallet.privateKey, network);
    } catch (err) {
      console.error('Error deriving address from private key:', err);
      address = wallet.address;
      publicKey = wallet.publicKey;
    }

    if (!address || !publicKey) {
      throw new Error('Could not get wallet address or public key');
    }

    // Drop legacy fee keys from older builds. Fee UTXO ordinal checks are now always enforced.
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('fine-trading-fee-ordinal-check-strict');
        localStorage.removeItem(
          `fine-trading-fee-accrual-v1:${String(address).toLowerCase()}`
        );
      }
    } catch {
      // ignore
    }

    /**
     * Taproot (key-path) signing uses the BIP340 "x-only" internal key with an even Y.
     * `derivePublicKeyFromPrivateKey()` returns a compressed SEC pubkey which may have an odd Y;
     * slicing it to x-only can mismatch the even-Y representation used by BIP340, causing
     * "No inputs could be signed".
     *
     * We derive the internal key the same way the signer does (BIP340 schnorr pubkey).
     */
    const internalPubkey = getTaprootInternalPubkeyBytes(wallet.privateKey); // Uint8Array(32)

    const safeFetchJson = async (url) => {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`HTTP ${res.status}${text ? `: ${text}` : ''}`);
        err.status = res.status;
        throw err;
      }
      return await res.json();
    };

    const safeFetchText = async (url) => {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`HTTP ${res.status}${text ? `: ${text}` : ''}`);
        err.status = res.status;
        throw err;
      }
      return await res.text();
    };

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const normalizeOutpointKey = (txid, vout) => {
      const tx = txid == null ? '' : String(txid).trim();
      const idx = Number(vout);
      if (!/^[0-9a-fA-F]{64}$/.test(tx)) return null;
      if (!Number.isInteger(idx) || idx < 0) return null;
      return `${tx.toLowerCase()}:${idx}`;
    };

    const parseOutpointKeyFromString = (value) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      const match = trimmed.match(/^([0-9a-fA-F]{64}):(\d+)(?::\d+)?$/);
      if (!match) return null;
      return normalizeOutpointKey(match[1], match[2]);
    };

    const getObjectOutpointKey = (obj) => {
      if (!obj || typeof obj !== 'object') return null;
      const txid =
        obj.txid ||
        obj.txId ||
        obj.tx_hash ||
        obj.txHash ||
        obj.transactionId ||
        obj.transaction_id ||
        obj.outpoint?.txid ||
        obj.outpoint?.txId ||
        obj.utxo?.txid ||
        obj.utxo?.txId;
      const vout =
        obj.vout ??
        obj.outputIndex ??
        obj.output_index ??
        obj.output ??
        obj.index ??
        obj.n ??
        obj.outpoint?.vout ??
        obj.outpoint?.index ??
        obj.utxo?.vout ??
        obj.utxo?.index;

      return normalizeOutpointKey(txid, vout);
    };

    const addOutpointFromObject = (outpoints, obj) => {
      if (!obj || typeof obj !== 'object') return;

      const directKey = getObjectOutpointKey(obj);
      if (directKey) outpoints.add(directKey);

      const stringFields = [
        obj.satpoint,
        obj.location,
        obj.output,
        obj.outputId,
        obj.output_id,
        obj.outpoint,
        obj.utxo,
      ];
      for (const field of stringFields) {
        const parsed = parseOutpointKeyFromString(field);
        if (parsed) outpoints.add(parsed);
      }
    };

    const getArrayPayload = (...values) => {
      for (const value of values) {
        if (Array.isArray(value)) return value;
      }
      return [];
    };

    const fetchUnisatInscriptionOutpointSet = async () => {
      const outpoints = new Set();
      let cursor = 0;
      const pageSize = 100;

      for (let page = 0; page < 20; page++) {
        const url = buildUnisatProxyUrl(
          `address/${encodeURIComponent(address)}/inscription-utxo-data`,
          { cursor: String(cursor), size: String(pageSize) }
        );
        const res = await fetch(url, {
          headers: { accept: 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`UniSat inscription lookup failed (${res.status})`);
        }
        const body = await res.json();
        const data = body && body.data ? body.data : {};
        const rows = getArrayPayload(
          data.utxo,
          data.utxos,
          data.list,
          data.result,
          data.items,
          Array.isArray(data) ? data : null
        );
        const beforeSize = outpoints.size;

        for (const row of rows) {
          addOutpointFromObject(outpoints, row);
        }

        if (rows.length > 0 && outpoints.size === beforeSize) {
          throw new Error(
            'UniSat returned inscription UTXOs without outpoints'
          );
        }

        const total = Number(data.total);
        cursor = Number(data.cursor ?? cursor) + rows.length;
        if (rows.length === 0) break;
        if (Number.isFinite(total) && outpoints.size >= total) break;
      }

      return outpoints;
    };

    const fetchSatflowInscriptionOutpointSet = async () => {
      const outpoints = new Set();
      const params = new URLSearchParams({
        address,
        itemType: 'inscription',
        limit: '100',
      });

      const res = await fetch(
        `/api/satflow-wallet-contents?${params.toString()}`
      );
      if (!res.ok) {
        throw new Error(`Satflow wallet contents failed (${res.status})`);
      }
      const body = await res.json();
      const payload = body?.data || body;
      const ordinals =
        payload?.results?.ordinals ||
        payload?.ordinals ||
        payload?.items ||
        payload?.tokens ||
        [];

      for (const entry of Array.isArray(ordinals) ? ordinals : []) {
        addOutpointFromObject(outpoints, entry);
        addOutpointFromObject(outpoints, entry.token);
        addOutpointFromObject(outpoints, entry.inscription);
        addOutpointFromObject(outpoints, entry.utxo);
      }

      if (
        Array.isArray(ordinals) &&
        ordinals.length > 0 &&
        outpoints.size === 0
      ) {
        throw new Error('Satflow returned ordinals without outpoint locations');
      }

      return outpoints;
    };

    let inscriptionOutpointSet = null;
    let inscriptionSetUnavailableError = null;
    const getInscriptionOutpointSet = async () => {
      if (inscriptionOutpointSet) return inscriptionOutpointSet;
      if (inscriptionSetUnavailableError) return null;

      const errors = [];

      try {
        inscriptionOutpointSet = await fetchUnisatInscriptionOutpointSet();
        return inscriptionOutpointSet;
      } catch (err) {
        errors.push(`UniSat: ${err?.message || String(err)}`);
      }

      try {
        inscriptionOutpointSet = await fetchSatflowInscriptionOutpointSet();
        return inscriptionOutpointSet;
      } catch (err) {
        errors.push(`Satflow: ${err?.message || String(err)}`);
      }

      inscriptionSetUnavailableError = errors.join('; ');
      console.warn(
        '[fee] inscription exclusion unavailable:',
        inscriptionSetUnavailableError
      );
      return null;
    };

    const fetchUnisatOutpointJson = async (txid, vout) => {
      const url = buildUnisatProxyUrl(
        `utxo/${encodeURIComponent(String(txid))}/${encodeURIComponent(String(vout))}`
      );
      const retries = 3;
      const delaysMs = [0, 2500, 7500];

      for (let attempt = 0; attempt < retries; attempt++) {
        if (delaysMs[attempt] > 0) await sleep(delaysMs[attempt]);
        const res = await fetch(url, {
          headers: { accept: 'application/json' },
        });
        if (res.status === 404 || res.status === 502 || res.status === 503) {
          if (attempt < retries - 1) continue;
          return null;
        }
        if (!res.ok) {
          await res.text().catch(() => '');
          return null;
        }
        try {
          return await res.json();
        } catch {
          return null;
        }
      }

      return null;
    };

    /*
     * This used to ask for `fastestFee` first, which on a busy day is 40+
     * sat/vB — the fee transaction then cost several times what the user had
     * been quoted anywhere else in the app. It takes the same middle tier
     * every other flow defaults to.
     *
     * Not the same fallback, though. Nobody sees this transaction or can
     * raise its rate after the fact, so an unreachable explorer keeps the
     * floor this function has always had rather than dropping to the 1 sat/vB
     * the on-screen controls fall back to.
     */
    const getFeeRateSatVb = async () => {
      const rates = await fetchFeeRates(network);
      return unattendedRate(rates);
    };

    const estimateFee = (inputsCount, outputsCount, feeRateSatVb) => {
      // Rough vsize estimates (Taproot key-path):
      // - p2tr input ~58 vB
      // - p2tr output ~43 vB
      const TX_BASE = 10;
      const P2TR_IN_VB = 58;
      const P2TR_OUT_VB = 43;
      const vbytes =
        TX_BASE + inputsCount * P2TR_IN_VB + outputsCount * P2TR_OUT_VB;
      return Math.ceil(Math.max(1, feeRateSatVb) * vbytes);
    };

    const isOutpointSafeNonOrdinal = async (
      txid,
      vout,
      { allowAddressExclusion = true } = {}
    ) => {
      const inscriptionSet = allowAddressExclusion
        ? await getInscriptionOutpointSet()
        : null;
      const outpointKey = normalizeOutpointKey(txid, vout);
      if (!outpointKey) return false;

      if (inscriptionSet && !inscriptionSet.has(outpointKey)) {
        return true;
      }

      // Fail closed: only spend when UniSat confirms no inscription-like payload.
      const body = await fetchUnisatOutpointJson(txid, vout);
      const data = body && body.data ? body.data : null;
      if (!data || typeof data !== 'object') {
        return false;
      }
      const inscriptions = Array.isArray(data.inscriptions)
        ? data.inscriptions
        : [];
      const inscriptionsCount = Number(data.inscriptionsCount ?? 0);
      if (
        (Number.isFinite(inscriptionsCount) && inscriptionsCount > 0) ||
        inscriptions.length > 0
      ) {
        return false;
      }
      const runeFields = [
        data.runes,
        data.rune,
        data.rune_balances,
        data.runeBalances,
      ];
      const hasRunePayload = runeFields.some((field) => {
        if (Array.isArray(field)) return field.length > 0;
        if (field && typeof field === 'object')
          return Object.keys(field).length > 0;
        return Boolean(field);
      });
      if (hasRunePayload) return false;

      return true;
    };

    const feeRate = await getFeeRateSatVb();

    const btcJsNetwork =
      network === 'mainnet'
        ? bitcoin.networks.bitcoin
        : bitcoin.networks.testnet;

    /** True iff vout pays exactly to our wallet address (decode script; do not trust labels alone). */
    const outputPaysToOurAddress = (v) => {
      const spkHex = v?.scriptpubkey;
      if (!spkHex || typeof spkHex !== 'string') return false;
      try {
        const script = Buffer.from(spkHex, 'hex');
        const decoded = bitcoin.address.fromOutputScript(script, btcJsNetwork);
        return (
          decoded &&
          String(decoded).toLowerCase() === String(address).toLowerCase()
        );
      } catch {
        return false;
      }
    };

    const selectedUtxos = [];
    const selectedOutpoints = new Set();

    const addUtxo = (u) => {
      const key = normalizeOutpointKey(u.txid, u.vout);
      if (!key) return;
      if (selectedOutpoints.has(key)) return;
      selectedOutpoints.add(key);
      selectedUtxos.push(u);
    };

    const fetchPurchaseTxWithBackoff = async () => {
      if (!purchaseTxid) return null;
      const delaysMs = [0, 10000, 30000];

      for (let attempt = 0; attempt < delaysMs.length; attempt++) {
        if (delaysMs[attempt] > 0) await sleep(delaysMs[attempt]);
        try {
          return await safeFetchJson(getMempoolTxApiUrl(purchaseTxid, network));
        } catch (e) {
          if (e?.status === 404 && attempt < delaysMs.length - 1) continue;
          if (e?.status === 404) return null;
          throw new Error(
            `Failed to fetch purchase tx from mempool explorer: ${e?.message || e}`
          );
        }
      }
      return null;
    };

    const tryAddPurchaseOutput = async () => {
      const purchaseTx = await fetchPurchaseTxWithBackoff();
      if (
        !purchaseTx ||
        !Array.isArray(purchaseTx.vout) ||
        purchaseTx.vout.length === 0
      ) {
        return false;
      }

      // Candidate UTXOs from purchase tx: ONLY outputs that decode to our address.
      // Never fall back to "largest vout" — vout :1 is often seller/marketplace, not buyer change.
      const purchaseCandidates = purchaseTx.vout
        .map((v, idx) => ({ ...v, _vout: idx }))
        .filter(outputPaysToOurAddress)
        .sort((a, b) => (b.value || 0) - (a.value || 0));

      for (const out of purchaseCandidates) {
        const vout = out._vout;
        const isSafe = await isOutpointSafeNonOrdinal(purchaseTxid, vout, {
          allowAddressExclusion: false,
        });
        if (!isSafe) continue;
        addUtxo({
          txid: purchaseTxid,
          vout,
          value: out.value,
          scriptpubkey: out.scriptpubkey,
          scriptpubkey_address: out.scriptpubkey_address,
          status: purchaseTx.status || { confirmed: false },
        });
        return true;
      }
      return false;
    };

    // Prefer existing confirmed wallet UTXOs. Only fall back to purchase change if needed,
    // because purchase txs can take time to appear in public explorers/indexers.
    const loadWalletUtxos = async () => {
      const list = await safeFetchJson(
        getMempoolAddressUtxoUrl(address, network)
      );
      return Array.isArray(list) ? list : [];
    };

    const loadMempoolSpentOutpoints = async () => {
      const spent = new Set();
      try {
        const txs = await safeFetchJson(
          getMempoolAddressTxsMempoolUrl(address, network)
        );
        if (!Array.isArray(txs)) return spent;

        for (const tx of txs) {
          const vin = Array.isArray(tx?.vin) ? tx.vin : [];
          for (const input of vin) {
            const prevoutAddress = input?.prevout?.scriptpubkey_address;
            if (
              prevoutAddress &&
              String(prevoutAddress).toLowerCase() !==
                String(address).toLowerCase()
            ) {
              continue;
            }
            const key = normalizeOutpointKey(input?.txid, input?.vout);
            if (key) spent.add(key);
          }
        }
      } catch (err) {
        console.warn('[fee] could not load mempool spent outpoints:', err);
      }
      return spent;
    };

    const DUST_THRESHOLD = 330;
    const MIN_CHANGE_OUTPUTS = 1;
    const calcTotals = (feeSat, inputs) => {
      const totalIn = inputs.reduce((sum, u) => sum + (u.value || 0), 0);
      // Assume 2 outputs (fee + change). If change would be dust, drop change output.
      const feeWith2Out = estimateFee(inputs.length, 2, feeRate);
      const change2 = totalIn - feeSat - feeWith2Out;
      if (change2 >= DUST_THRESHOLD) {
        return { totalIn, feeEst: feeWith2Out, change: change2, outputs: 2 };
      }
      const feeWith1Out = estimateFee(inputs.length, 1, feeRate);
      const change1 = totalIn - feeSat - feeWith1Out;
      return { totalIn, feeEst: feeWith1Out, change: change1, outputs: 1 };
    };

    let mempoolSpentOutpoints = await loadMempoolSpentOutpoints();

    const addSpendableWalletUtxos = async (list) => {
      const sorted = Array.isArray(list) ? [...list] : [];
      sorted.sort((a, b) => (b.value || 0) - (a.value || 0));
      for (const u of sorted) {
        const key = normalizeOutpointKey(u.txid, u.vout);
        if (!key) continue;
        if (selectedOutpoints.has(key)) continue;
        if (mempoolSpentOutpoints.has(key)) continue;
        if (u?.value == null || u.value <= 0) continue;

        const safe = await isOutpointSafeNonOrdinal(u.txid, u.vout);
        if (!safe) continue;

        addUtxo({
          txid: u.txid,
          vout: u.vout,
          value: u.value,
          scriptpubkey: null,
          scriptpubkey_address: address,
          status: u.status || { confirmed: false },
        });

        const t = calcTotals(feeAmount, selectedUtxos);
        if (t.change >= 0) break;
      }
    };

    await addSpendableWalletUtxos(await loadWalletUtxos());

    let totals = calcTotals(feeAmount, selectedUtxos);
    const UTXO_REFRESH_ROUNDS = 2;
    const UTXO_REFRESH_MS = 5000;
    for (let r = 0; r < UTXO_REFRESH_ROUNDS && totals.change < 0; r++) {
      await sleep(UTXO_REFRESH_MS);
      mempoolSpentOutpoints = await loadMempoolSpentOutpoints();
      await addSpendableWalletUtxos(await loadWalletUtxos());
      totals = calcTotals(feeAmount, selectedUtxos);
    }

    if (totals.change < 0) {
      log('  Waiting for purchase change to become indexer-safe for fee...');
      await tryAddPurchaseOutput();
      totals = calcTotals(feeAmount, selectedUtxos);
    }

    if (selectedUtxos.length === 0) {
      if (inscriptionSetUnavailableError) {
        throw new Error(
          `Could not verify fee UTXO ordinal safety (${inscriptionSetUnavailableError})`
        );
      }
      throw new Error(
        'No spendable non-ordinal UTXOs available for fee payment'
      );
    }
    if (totals.change < 0) {
      throw new Error(
        `Insufficient spendable BTC for fee tx. Need ${(Math.abs(totals.change) / 100000000).toFixed(8)} BTC more (after miner fees).`
      );
    }

    // 3) Build PSBT spending selected UTXOs.
    const { Psbt, networks, payments } = bitcoin;
    const networkConfig =
      network === 'mainnet' ? networks.bitcoin : networks.testnet;
    const psbt = new Psbt({ network: networkConfig });

    const detectAddressFormat = (addr) => {
      if (!addr || typeof addr !== 'string') return 'p2tr';
      if (addr.startsWith('bc1p') || addr.startsWith('tb1p')) return 'p2tr';
      if (
        (addr.startsWith('bc1') && addr.length === 42) ||
        (addr.startsWith('tb1') && addr.length === 42)
      )
        return 'p2wpkh';
      if (addr.startsWith('1') || addr.startsWith('m') || addr.startsWith('n'))
        return 'p2pkh';
      if (addr.startsWith('3') || addr.startsWith('2')) return 'p2sh';
      return 'p2tr';
    };

    const walletAddrFormat = detectAddressFormat(address);

    const fetchVoutScriptpubkey = async (txid, vout) => {
      // Use tx JSON (cheaper than hex) to get scriptPubKey for witnessUtxo.
      const tx = await safeFetchJson(getMempoolTxApiUrl(txid, network));
      const out = Array.isArray(tx?.vout) ? tx.vout[vout] : null;
      const spk = out?.scriptpubkey;
      if (!spk) throw new Error(`Missing scriptpubkey for ${txid}:${vout}`);
      return spk;
    };

    for (const utxo of selectedUtxos) {
      const inputData = {
        hash: utxo.txid,
        index: utxo.vout,
        sequence: 0xffffffff,
      };

      let scriptHex = utxo.scriptpubkey;
      if (!scriptHex) {
        scriptHex = await fetchVoutScriptpubkey(utxo.txid, utxo.vout);
      }

      const scriptBuffer = Buffer.from(scriptHex, 'hex');
      const valueBn = BigInt(utxo.value);

      if (scriptHex.toLowerCase().startsWith('76')) {
        // Legacy P2PKH: requires full prev tx
        const txHex = await safeFetchText(
          getMempoolTxHexUrl(utxo.txid, network)
        );
        inputData.nonWitnessUtxo = Buffer.from(txHex, 'hex');
      } else if (walletAddrFormat === 'p2tr') {
        // BIP86 Taproot fee spends: witness script must match our derived output;
        // use canonical Buffer script + tapInternalKey so bitcoinjs can sign & finalize.
        const xOnlyPubkey = Buffer.from(internalPubkey);
        const payment = payments.p2tr({
          internalPubkey: xOnlyPubkey,
          network: networkConfig,
        });
        if (!payment.output) {
          throw new Error(
            'Could not derive Taproot output script for fee UTXO'
          );
        }
        // bitcoinjs-lib may return output as Uint8Array; Buffer.equals is Node-only.
        const expectedSpk = Buffer.from(payment.output);
        const isP2trSpk =
          scriptBuffer.length === 34 &&
          scriptBuffer[0] === 0x51 &&
          scriptBuffer[1] === 0x20;
        if (!isP2trSpk) {
          throw new Error(
            `Fee UTXO ${utxo.txid}:${utxo.vout} is not native Taproot (P2TR). This wallet only spends Taproot UTXOs for fees.`
          );
        }
        if (
          expectedSpk.length !== scriptBuffer.length ||
          Buffer.compare(expectedSpk, scriptBuffer) !== 0
        ) {
          throw new Error(
            `Fee UTXO ${utxo.txid}:${utxo.vout} does not pay to this wallet's Taproot address. Refusing to sign.`
          );
        }
        inputData.witnessUtxo = {
          script: expectedSpk,
          value: valueBn,
        };
        inputData.tapInternalKey = xOnlyPubkey;
      } else {
        inputData.witnessUtxo = {
          script: scriptBuffer,
          value: valueBn,
        };
        if (scriptHex.toLowerCase().startsWith('5120')) {
          inputData.tapInternalKey = Buffer.from(internalPubkey);
        }
      }

      // If scriptpubkey missing/odd, fall back to deriving from pubkey.
      if (!inputData.witnessUtxo && !inputData.nonWitnessUtxo) {
        const pubkeyBuffer = Buffer.from(publicKey, 'hex');
        let payment;
        if (walletAddrFormat === 'p2tr') {
          const xOnlyPubkey = Buffer.from(internalPubkey);
          payment = payments.p2tr({
            internalPubkey: xOnlyPubkey,
            network: networkConfig,
          });
        } else if (walletAddrFormat === 'p2pkh') {
          const txHex = await safeFetchText(
            getMempoolTxHexUrl(utxo.txid, network)
          );
          inputData.nonWitnessUtxo = Buffer.from(txHex, 'hex');
        } else {
          payment = payments.p2wpkh({
            pubkey: pubkeyBuffer,
            network: networkConfig,
          });
        }
        if (payment?.output) {
          inputData.witnessUtxo = {
            script: Buffer.from(payment.output),
            value: valueBn,
          };
          if (walletAddrFormat === 'p2tr') {
            inputData.tapInternalKey = Buffer.from(internalPubkey);
          }
        }
      }

      psbt.addInput(inputData);
    }

    // Fee output
    psbt.addOutput({
      address: TRADING_FEE_RECEIVER_ADDRESS,
      value: BigInt(feeAmount),
    });

    // Change output (if not dust)
    if (
      totals.outputs >= MIN_CHANGE_OUTPUTS &&
      totals.change >= DUST_THRESHOLD
    ) {
      psbt.addOutput({
        address,
        value: BigInt(totals.change),
      });
    }

    const signResult = await signPsbtWithProxyWallet(
      psbt.toBase64(),
      wallet.privateKey,
      network,
      {
        finalize: true,
        extractTx: true,
        // expectedPublicKey can be misleading for Taproot because compressed pubkeys can be odd-Y;
        // the signer uses the BIP340 even-Y internal key. Leave unset.
        walletAddress: address,
      }
    );

    if (!signResult?.hex) {
      throw new Error('Failed to sign fee transaction PSBT');
    }

    const broadcastResponse = await fetch(getMempoolBroadcastUrl(network), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: signResult.hex,
    });
    if (!broadcastResponse.ok) {
      const errorText = await broadcastResponse.text();
      throw new Error(
        `Failed to broadcast fee transaction: ${broadcastResponse.status} - ${errorText}`
      );
    }

    const txId = (await broadcastResponse.text()).trim();
    log(`  Fee sent: ${feeAmount} sats (${txId.slice(0, 16)}...)`);

    return {
      success: true,
      txid: txId,
      feeAmount,
      purchasePrice,
      feeReceiver: TRADING_FEE_RECEIVER_ADDRESS,
    };
  } catch (err) {
    const errorMsg = err.message || 'Failed to send trading fee';
    console.error('Error sending trading fee:', err);
    log(`  Fee pending: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  }
};
