/**
 * Builds, signs and broadcasts an app-fee payment from a proxy wallet: one
 * output of `amountSats` to the fee receiver, plus change. Called by
 * ./feeSettlement with everything a wallet owes; the receiver address comes
 * from ./fees.
 */

import * as bitcoin from 'bitcoinjs-lib';
import {
  deriveAddressFromPrivateKey,
  derivePublicKeyFromPrivateKey,
  getTaprootInternalPubkeyBytes,
  signPsbtWithProxyWallet,
} from '../lib/bitcoinUtils';
import {
  fetchFeeRates,
  rateForTier,
  UNATTENDED_MIN_FEE_RATE,
} from '../lib/feeRates';
import {
  getMempoolTxApiUrl,
  getMempoolAddressUtxoUrl,
  getMempoolAddressTxsMempoolUrl,
  getMempoolTxHexUrl,
  getMempoolBroadcastUrl,
} from '../lib/mempoolProvider';
import { buildUnisatProxyUrl } from '../lib/unisatProxy';
import {
  MIN_TRADING_FEE_OUTPUT_SATS,
  TRADING_FEE_RECEIVER_ADDRESS,
} from './fees';

/**
 * Pay `amountSats` of app fees from a proxy wallet, in one transaction.
 *
 * Spends confirmed outputs only. A settlement is never urgent, and an
 * unconfirmed output may be an inscription bought moments ago that no index
 * has seen yet; a wallet whose funds are all unconfirmed simply settles on a
 * later attempt.
 *
 * @param {Object} params
 * @param {Object} params.wallet - Proxy wallet ({ address, publicKey, privateKey })
 * @param {number} params.amountSats - Fee output value
 * @param {string} [params.network]
 * @param {Function|null} [params.addConsoleLog]
 * @param {(txid: string) => void} [params.onSigned] - Called with the txid
 *   after signing and before broadcast, so the caller can record the payment
 *   before it can happen.
 * @returns {Promise<{ success: boolean, txid?: string, feeAmount?: number,
 *   error?: string, broadcastRejected?: boolean }>} broadcastRejected is true
 *   only when the explorer answered and refused the transaction — a network
 *   failure mid-broadcast leaves it unknown.
 */
export const sendFeePayment = async ({
  wallet,
  amountSats,
  network = 'mainnet',
  addConsoleLog = null,
  onSigned = null,
}) => {
  const log = (message) => {
    if (typeof addConsoleLog === 'function') addConsoleLog(message);
  };
  let signedTxid = null;

  try {
    const feeAmount = Math.floor(Number(amountSats) || 0);
    if (feeAmount < MIN_TRADING_FEE_OUTPUT_SATS) {
      return {
        success: false,
        error: `Fee payment of ${feeAmount} sats is below the ${MIN_TRADING_FEE_OUTPUT_SATS}-sat minimum output`,
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
     * The low tier. Nobody waits on a settlement and it carries no deadline,
     * so there is no reason to pay for speed. An unreachable explorer keeps
     * the unattended floor rather than the 1 sat/vB on-screen fallback.
     */
    const getFeeRateSatVb = async () => {
      const rates = await fetchFeeRates(network);
      return rates ? rateForTier(rates, 'low') : UNATTENDED_MIN_FEE_RATE;
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

    const selectedUtxos = [];
    const selectedOutpoints = new Set();

    const addUtxo = (u) => {
      const key = normalizeOutpointKey(u.txid, u.vout);
      if (!key) return;
      if (selectedOutpoints.has(key)) return;
      selectedOutpoints.add(key);
      selectedUtxos.push(u);
    };

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

    const mempoolSpentOutpoints = await loadMempoolSpentOutpoints();

    const addSpendableWalletUtxos = async (list) => {
      const sorted = Array.isArray(list) ? [...list] : [];
      sorted.sort((a, b) => (b.value || 0) - (a.value || 0));
      for (const u of sorted) {
        const key = normalizeOutpointKey(u.txid, u.vout);
        if (!key) continue;
        if (selectedOutpoints.has(key)) continue;
        if (mempoolSpentOutpoints.has(key)) continue;
        if (u?.value == null || u.value <= 0) continue;
        // Confirmed only: see sendFeePayment.
        if (u.status?.confirmed !== true) continue;

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
    const totals = calcTotals(feeAmount, selectedUtxos);

    if (selectedUtxos.length === 0) {
      if (inscriptionSetUnavailableError) {
        throw new Error(
          `Could not verify fee UTXO ordinal safety (${inscriptionSetUnavailableError})`
        );
      }
      throw new Error(
        'No confirmed, inscription-free UTXOs available for the fee payment yet'
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

    // Known before broadcast, so the caller can record it first.
    signedTxid = bitcoin.Transaction.fromHex(signResult.hex).getId();
    if (typeof onSigned === 'function') onSigned(signedTxid);

    const broadcastResponse = await fetch(getMempoolBroadcastUrl(network), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: signResult.hex,
    });
    if (!broadcastResponse.ok) {
      const errorText = await broadcastResponse.text().catch(() => '');
      return {
        success: false,
        txid: signedTxid,
        broadcastRejected: true,
        error:
          `Fee payment was refused: ${broadcastResponse.status} ${errorText}`.trim(),
      };
    }

    const txId = (await broadcastResponse.text()).trim() || signedTxid;
    return {
      success: true,
      txid: txId,
      feeAmount,
      feeReceiver: TRADING_FEE_RECEIVER_ADDRESS,
    };
  } catch (err) {
    const errorMsg = err.message || 'Failed to send the app fee payment';
    console.error('Error sending app fee payment:', err);
    log(`  Fee payment not sent: ${errorMsg}`);
    return {
      success: false,
      txid: signedTxid || undefined,
      error: errorMsg,
    };
  }
};
