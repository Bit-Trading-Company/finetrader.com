/**
 * Satflow secure purchase with a proxy wallet: dummy-UTXO preparation,
 * pending-prep tracking (localStorage), prepare / complete purchase and
 * broadcast.
 */

import {
  deriveAddressFromPrivateKey,
  derivePublicKeyFromPrivateKey,
  signPsbtWithProxyWallet,
} from '../../lib/bitcoinUtils';
import { hexToBase64 } from '../../lib/encoding';
import { getMempoolBroadcastUrl } from '../../lib/mempoolProvider';
import { checkTransactionConfirmed } from '../chain';
import { getTokenId } from '../ordinals';

/** Error message returned by Satflow when buyer needs to create dummy UTXOs first */
const SATFLOW_DUMMY_UTXO_ERROR = 'Additional dummy UTXOs required to purchase';

/** localStorage key for pending secure-purchase preps (survives refresh/restart so we don't create duplicate preps) */
const PENDING_PREPS_STORAGE_KEY = 'fine-trading-pending-secure-preps';

function getPendingPrepsFromStorage() {
  try {
    const raw =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(PENDING_PREPS_STORAGE_KEY)
        : null;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function savePendingPrepsToStorage(preps) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PENDING_PREPS_STORAGE_KEY, JSON.stringify(preps));
    }
  } catch (e) {
    console.warn('Could not save pending preps to localStorage', e);
  }
}

/** Remove pending prep after successful purchase or on purpose */
export function removePendingPrep(inscriptionId, buyerAddress) {
  const preps = getPendingPrepsFromStorage().filter(
    (p) =>
      !(p.inscriptionId === inscriptionId && p.buyerAddress === buyerAddress)
  );
  savePendingPrepsToStorage(preps);
}

/**
 * Create a dummy UTXO via Satflow backend (setupUtxos), sign, broadcast, and wait for confirmation.
 * Call this when purchase intent returns "Additional dummy UTXOs required to purchase".
 * @param {string} ownerAddress - Buyer wallet address (ordinals address)
 * @param {Object} wallet - Proxy wallet object (privateKey, address)
 * @param {string} network - Network type
 * @param {Function} [addConsoleLog] - Optional logger
 * @returns {Promise<{ success: boolean, txid?: string, error?: string }>}
 */
export const createDummyUtxoAndWait = async (
  ownerAddress,
  wallet,
  network = 'mainnet',
  addConsoleLog = null
) => {
  const log = (msg) => {
    if (typeof addConsoleLog === 'function') addConsoleLog(msg);
    else console.log('[createDummyUtxoAndWait]', msg);
  };

  try {
    const res = await fetch('/api/satflow-setup-utxos', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-wallet-address': ownerAddress,
      },
      body: JSON.stringify({ 0: { json: {} } }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Setup UTXOs request failed: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const json = data?.result?.data?.json ?? data?.data?.json ?? data?.json;
    const unsignedB64 = json?.unsignedPSBTBase64 ?? json?.unsignedPSBTHex;
    if (!unsignedB64) {
      throw new Error('Setup UTXOs response missing unsigned PSBT');
    }

    let psbtB64 = unsignedB64;
    if (/^[0-9a-fA-F]+$/.test(unsignedB64)) {
      const bytes = new Uint8Array(
        unsignedB64.match(/.{1,2}/g).map((b) => parseInt(b, 16))
      );
      psbtB64 = btoa(
        Array.from(bytes)
          .map((byte) => String.fromCharCode(byte))
          .join('')
      );
    }

    let address, publicKey;
    try {
      address = deriveAddressFromPrivateKey(wallet.privateKey, network);
      publicKey = derivePublicKeyFromPrivateKey(wallet.privateKey, network);
    } catch (e) {
      address = wallet.address;
      publicKey = wallet.publicKey;
    }

    const signResult = await signPsbtWithProxyWallet(
      psbtB64.trim(),
      wallet.privateKey,
      network,
      {
        finalize: true,
        extractTx: true,
        expectedPublicKey: publicKey,
        walletAddress: address,
      }
    );

    if (!signResult?.hex) {
      throw new Error('Failed to sign dummy UTXO PSBT');
    }

    const broadcastRes = await fetch(getMempoolBroadcastUrl(network), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: signResult.hex,
    });

    if (!broadcastRes.ok) {
      const errText = await broadcastRes.text();
      throw new Error(`Broadcast failed: ${broadcastRes.status} ${errText}`);
    }

    const txid = (await broadcastRes.text()).trim();
    log(`Dummy UTXO tx broadcasted: ${txid.slice(0, 16)}...`);

    const timeoutMs = 120000;
    const pollIntervalMs = 3000;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const confirmed = await checkTransactionConfirmed(txid, network);
      if (confirmed) {
        log(`Dummy UTXO tx confirmed: ${txid.slice(0, 16)}...`);
        return { success: true, txid };
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    throw new Error(
      `Dummy UTXO tx not confirmed within ${timeoutMs / 1000}s: ${txid}`
    );
  } catch (err) {
    log(`Dummy UTXO error: ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  }
};

/** Helper: base64 string to hex (broadcast API may expect hex for PSBTs) */
function base64ToHex(base64Str) {
  if (!base64Str || typeof base64Str !== 'string') return '';
  try {
    let b64 = base64Str.replace(/\s/g, '');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const binary = atob(b64);
    return Array.from(binary)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return '';
  }
}

const SATFLOW_REFERRAL_ADDRESS = 'bc1q7dhu5ys8mp74re0zq0r7djjgpy4lw2q0u5049m';

/** Ensure PSBT string is in hex for broadcast (Satflow website sends hex). Pass-through if already hex. */
function toPsbtHexForBroadcast(psbtStr) {
  if (!psbtStr || typeof psbtStr !== 'string') return '';
  const s = psbtStr.trim();
  if (/^[0-9a-fA-F]+$/.test(s)) return s;
  return base64ToHex(s);
}

/** Helper: normalize PSBT string (hex or base64) to base64 */
function toPsbtBase64(psbtStr) {
  if (!psbtStr) return null;
  if (/^[0-9a-fA-F]+$/.test(psbtStr)) return hexToBase64(psbtStr);
  return psbtStr;
}

const SECURE_CONTEXT_MSG =
  'PSBT signing requires a secure context (HTTPS or localhost). Open the app via https:// or http://localhost (not plain HTTP on a remote host).';

/** Normalize errors that indicate missing secure context (browser or API). */
function normalizeSecureContextError(msg) {
  if (!msg || typeof msg !== 'string') return msg;
  const s = String(msg);
  if (/secure\s*context|crypto\.subtle|verifying\s*PSBT.*secure/i.test(s))
    return SECURE_CONTEXT_MSG;
  return msg;
}

/**
 * Secure purchase flow: do not broadcast until all 3 PSBTs are signed.
 * 1. GET PREP:       POST /v1/intent/secure-purchase (no signed prep) → paymentPrepPsbts
 * 2. SIGN PREP:      Sign prep PSBT (no broadcast)
 * 3. GET PURCHASE:   POST /v1/intent/secure-purchase with signedPaymentPrepPSBT → purchasePsbts
 * 4. SIGN PURCHASE:  Sign purchase PSBT(s)
 * 5. GET TRANSFER:   POST /v1/intent/secure-purchase with signed prep + signedPurchasePSBTs → transferPsbt
 * 6. SIGN TRANSFER:  Sign transfer PSBT
 * 7. BROADCAST:      POST /v1/purchase/broadcast once with all 3 (signed prep + signed purchase + signed transfer)
 *
 * prepareSecurePurchase = 1–2 (returns signedPaymentPrepPSBT only). completeSecurePurchase = 3–7.
 */

/**
 * Phase 1: Steps 1–2 — Get prep PSBT from intent/secure-purchase, then sign it (no broadcast). Store for complete step.
 * @returns {Promise<{ success: boolean, prepTxid?: string, noPrepNeeded?: boolean, intentData?: object, alreadyPrepared?: boolean, error?: string }>}
 */
export const prepareSecurePurchase = async (
  ordinal,
  wallet,
  network = 'mainnet',
  addConsoleLog = null,
  isStopRequested = null
) => {
  const tokenId = getTokenId(ordinal);
  if (!tokenId)
    return { success: false, error: 'Could not determine token ID' };
  if (!ordinal.listed || !ordinal.listedPrice)
    return { success: false, error: 'Waiting for item listing to propagate' };

  if (typeof isStopRequested === 'function' && isStopRequested()) {
    return { success: false, error: 'Trading stopped by user' };
  }

  let address, publicKey;
  try {
    address = deriveAddressFromPrivateKey(wallet.privateKey, network);
    publicKey = derivePublicKeyFromPrivateKey(wallet.privateKey, network);
  } catch (err) {
    address = wallet.address;
    publicKey = wallet.publicKey;
  }
  if (!address || !publicKey)
    return {
      success: false,
      error: 'Could not get wallet address or public key',
    };

  const intentPayload = {
    buyerAddress: address,
    buyerTokenReceiveAddress: address,
    buyerTokenReceivePublicKey: publicKey,
    buyerPublicKey: publicKey,
    inscriptionIds: [tokenId],
    feeRate: 4,
    referralAddress: SATFLOW_REFERRAL_ADDRESS,
    runesOutputs: [],
    disableCompactPurchase: true,
  };

  const runSecureIntent = async (signedPaymentPrepPSBTs = null) => {
    const body = { ...intentPayload };
    // Match working Satflow website: always send signedPaymentPrepPSBTs and signedPurchasePSBTs
    let prepsHex = [];
    if (signedPaymentPrepPSBTs && signedPaymentPrepPSBTs.length > 0) {
      prepsHex = signedPaymentPrepPSBTs
        .map((p) =>
          typeof p === 'string' ? p.trim() : String(p?.base64 ?? p?.hex ?? '')
        )
        .map((s) => toPsbtHexForBroadcast(s) || s)
        .filter((s) => s && typeof s === 'string');
    }
    body.signedPaymentPrepPSBTs = prepsHex;
    body.signedPurchasePSBTs = [];
    const res = await fetch('/api/satflow-intent-secure-purchase', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok)
      return {
        ok: false,
        error: data?.error ?? data?.message ?? `HTTP ${res.status}`,
        data,
      };
    if (data?.success === false && data?.error)
      return { ok: false, error: data.error, data };
    return { ok: true, data };
  };

  // Do not use cached/stored prep — always get fresh prep PSBT from API (per user flow).
  // Step 1: Get prep PSBT from /v1/intent/secure-purchase (no signed prep in body)
  let intentResult = await runSecureIntent();
  if (
    !intentResult.ok &&
    String(intentResult.error || '').includes(SATFLOW_DUMMY_UTXO_ERROR)
  ) {
    if (typeof addConsoleLog === 'function')
      addConsoleLog('Additional dummy UTXOs required; creating dummy UTXO...');
    const dummyResult = await createDummyUtxoAndWait(
      address,
      wallet,
      network,
      addConsoleLog
    );
    if (!dummyResult.success)
      return {
        success: false,
        error: `Dummy UTXO failed: ${dummyResult.error}`,
      };
    intentResult = await runSecureIntent();
  }
  if (!intentResult.ok)
    return {
      success: false,
      error: intentResult.error || 'Secure purchase intent failed',
    };

  const intentData = intentResult.data?.data ?? intentResult.data;
  const paymentPrepPsbts = intentData?.paymentPrepPsbts ?? [];
  const purchasePsbts = intentData?.purchasePsbts ?? [];

  if (purchasePsbts.length > 0) {
    return { success: true, noPrepNeeded: true, intentData, intentPayload };
  }

  if (paymentPrepPsbts.length === 0) {
    return { success: false, error: 'No prep or purchase PSBTs returned' };
  }

  const prep = paymentPrepPsbts[0];
  const prepB64 = toPsbtBase64(prep.base64 ?? prep.hex);
  if (!prepB64)
    return { success: false, error: 'Payment prep PSBT missing base64/hex' };

  // Step 2: Sign the purchase prep PSBT (do not broadcast; pass signed prep to API in step 3)
  const prepSignResult = await signPsbtWithProxyWallet(
    prepB64.trim(),
    wallet.privateKey,
    network,
    {
      finalize: true,
      extractTx: true,
      expectedPublicKey: publicKey,
      walletAddress: address,
    }
  );
  if (!prepSignResult?.hex)
    return { success: false, error: 'Failed to sign payment prep PSBT' };
  const signedPaymentPrepPSBT =
    prepSignResult.base64 ?? toPsbtBase64(prepSignResult.hex);
  console.log(
    '[Satflow] signed payment prep PSBT (base64):',
    signedPaymentPrepPSBT
  );

  // Do not broadcast prep; broadcast only once with all 3 PSBTs (prep + purchase + transfer) via purchase/broadcast
  if (typeof addConsoleLog === 'function') {
    addConsoleLog(
      `Payment prep PSBT signed (no broadcast); pass to complete to get purchase + transfer, then broadcast all.`
    );
  }
  return { success: true, signedPaymentPrepPSBT };
};

/**
 * Complete secure purchase. Flow (no cached PSBTs):
 * 1. Get prep PSBT (intent, no signed prep) — or use options.signedPaymentPrepPSBT from same-run prepare
 * 2. Sign prep PSBT (if not from options)
 * 3. Get purchase PSBT (intent with signed prep)
 * 4. Sign purchase PSBT(s)
 * 5. Get transfer PSBT (intent with signed prep + signed purchase)
 * 6. Sign transfer PSBT, then broadcast via /v1/purchase/broadcast
 * @param {Object} options.intentData - Optional: if intent already returned purchasePsbts (no-prep path)
 * @param {string} options.signedPaymentPrepPSBT - Optional: same-run signed prep (do not use cached/stored)
 */
export const completeSecurePurchase = async (
  ordinal,
  wallet,
  network = 'mainnet',
  addConsoleLog = null,
  isStopRequested = null,
  options = {}
) => {
  const tokenId = getTokenId(ordinal);
  if (!tokenId)
    return { success: false, error: 'Could not determine token ID' };
  const tokenIdShort = tokenId.slice(0, 8);
  if (typeof addConsoleLog === 'function')
    addConsoleLog(`  Complete purchase for item ${tokenIdShort}...`);

  let address, publicKey;
  try {
    address = deriveAddressFromPrivateKey(wallet.privateKey, network);
    publicKey = derivePublicKeyFromPrivateKey(wallet.privateKey, network);
  } catch (err) {
    address = wallet.address;
    publicKey = wallet.publicKey;
  }
  if (!address || !publicKey)
    return {
      success: false,
      error: 'Could not get wallet address or public key',
    };

  const intentPayload = {
    buyerAddress: address,
    buyerTokenReceiveAddress: address,
    buyerTokenReceivePublicKey: publicKey,
    buyerPublicKey: publicKey,
    inscriptionIds: [tokenId],
    feeRate: 4,
    referralAddress: SATFLOW_REFERRAL_ADDRESS,
    runesOutputs: [],
    disableCompactPurchase: true,
  };

  const runSecureIntent = async (
    signedPaymentPrepPSBTs = null,
    signedPurchasePSBTs = null
  ) => {
    const body = { ...intentPayload };
    // Match working Satflow website: always send signedPaymentPrepPSBTs and signedPurchasePSBTs (arrays of hex strings)
    let prepsHex = [];
    if (
      signedPaymentPrepPSBTs &&
      Array.isArray(signedPaymentPrepPSBTs) &&
      signedPaymentPrepPSBTs.length > 0
    ) {
      prepsHex = signedPaymentPrepPSBTs
        .map((p) =>
          typeof p === 'string' ? p.trim() : String(p?.base64 ?? p?.hex ?? '')
        )
        .map((s) => toPsbtHexForBroadcast(s) || s)
        .filter((s) => s && typeof s === 'string');
    }
    body.signedPaymentPrepPSBTs = prepsHex;

    let purchasesHex = [];
    if (
      signedPurchasePSBTs &&
      Array.isArray(signedPurchasePSBTs) &&
      signedPurchasePSBTs.length > 0
    ) {
      purchasesHex = signedPurchasePSBTs
        .map((p) =>
          typeof p === 'string' ? p.trim() : String(p?.base64 ?? p?.hex ?? '')
        )
        .map((s) => toPsbtHexForBroadcast(s) || s)
        .filter((s) => s && typeof s === 'string');
    }
    body.signedPurchasePSBTs = purchasesHex;

    const res = await fetch('/api/satflow-intent-secure-purchase', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok)
      return { ok: false, error: data?.error ?? data?.message, data };
    if (data?.success === false && data?.error)
      return { ok: false, error: data.error, data };
    return { ok: true, data };
  };

  // Flow: Get prep → Sign prep → Get purchase → Sign purchase → Get transfer → Sign transfer → Broadcast.
  // Do not use cached/stored PSBTs; use only same-run signed prep (options.signedPaymentPrepPSBT) or fetch fresh.
  let signedPaymentPrepPSBT = options.signedPaymentPrepPSBT ?? null;
  let purchaseList = [];

  if (
    options.intentData &&
    (options.intentData.purchasePsbts ?? []).length > 0
  ) {
    purchaseList = options.intentData.purchasePsbts ?? [];
  } else {
    // Need signed prep: use same-run prep from options, or get prep + sign fresh (no cache).
    if (!signedPaymentPrepPSBT) {
      if (typeof addConsoleLog === 'function')
        addConsoleLog('  Get prep PSBT (intent, no signed prep)...');
      const prepIntentResult = await runSecureIntent();
      if (!prepIntentResult.ok)
        return {
          success: false,
          error:
            normalizeSecureContextError(prepIntentResult.error) ||
            prepIntentResult.error ||
            'Secure purchase (get prep) failed',
        };
      const prepIntentData =
        prepIntentResult.data?.data ?? prepIntentResult.data;
      const paymentPrepPsbts = prepIntentData?.paymentPrepPsbts ?? [];
      const prep = paymentPrepPsbts[0];
      if (!prep) {
        const purchaseFromPrep =
          prepIntentData?.purchasePsbts ?? prepIntentData?.purchasepsbts ?? [];
        if (purchaseFromPrep.length > 0) {
          purchaseList = purchaseFromPrep;
        }
        if (purchaseList.length === 0)
          return {
            success: false,
            error: 'No prep or purchase PSBTs returned from intent',
          };
      } else {
        const prepB64 = toPsbtBase64(prep.base64 ?? prep.hex);
        if (!prepB64)
          return {
            success: false,
            error: 'Payment prep PSBT missing base64/hex',
          };
        if (typeof addConsoleLog === 'function')
          addConsoleLog('  Sign prep PSBT...');
        const prepSignResult = await signPsbtWithProxyWallet(
          prepB64.trim(),
          wallet.privateKey,
          network,
          {
            finalize: true,
            extractTx: true,
            expectedPublicKey: publicKey,
            walletAddress: address,
          }
        );
        if (!prepSignResult?.hex)
          return { success: false, error: 'Failed to sign payment prep PSBT' };
        signedPaymentPrepPSBT =
          prepSignResult.base64 ?? toPsbtBase64(prepSignResult.hex);
        console.log(
          '[Satflow] signed payment prep PSBT (base64):',
          signedPaymentPrepPSBT
        );
      }
    }
    if (purchaseList.length === 0 && signedPaymentPrepPSBT) {
      const extractPurchaseList = (raw) => {
        const d = raw?.data ?? raw;
        return (
          d?.purchasePsbts ??
          d?.purchasepsbts ??
          (Array.isArray(d?.purchasePsbt) ? d.purchasePsbt : null) ??
          []
        );
      };
      const retryDelays = [0, 10000, 20000];
      for (let attempt = 0; attempt < retryDelays.length; attempt++) {
        if (typeof isStopRequested === 'function' && isStopRequested())
          return { success: false, error: 'Trading stopped by user' };
        if (retryDelays[attempt] > 0 && typeof addConsoleLog === 'function') {
          addConsoleLog(
            `  Get purchase PSBT retry ${attempt + 1}/${retryDelays.length} in ${retryDelays[attempt] / 1000}s (backend may need time after prep confirm)...`
          );
          await new Promise((r) => setTimeout(r, retryDelays[attempt]));
        }
        if (typeof addConsoleLog === 'function')
          addConsoleLog('  Get purchase PSBT (intent with signed prep)...');
        const purchaseIntentResult = await runSecureIntent([
          signedPaymentPrepPSBT,
        ]);
        if (!purchaseIntentResult.ok)
          return {
            success: false,
            error:
              normalizeSecureContextError(purchaseIntentResult.error) ||
              purchaseIntentResult.error ||
              'Secure purchase (get purchase PSBT) failed',
          };
        const purchaseData =
          purchaseIntentResult.data?.data ?? purchaseIntentResult.data;
        purchaseList = extractPurchaseList(purchaseIntentResult.data);
        if (!Array.isArray(purchaseList)) purchaseList = [];
        if (purchaseList.length > 0) {
          console.log(
            '[Satflow] received purchase PSBTs from API:',
            purchaseList.length
          );
          // Log all top-level keys from intent response (helps debug "Mismatched compact txs" – look for compactPurchasePsbts etc.)
          const dataObj =
            purchaseIntentResult.data?.data ?? purchaseIntentResult.data ?? {};
          console.log('[Satflow] intent response keys:', Object.keys(dataObj));
          break;
        }
        if (
          attempt < retryDelays.length - 1 &&
          typeof addConsoleLog === 'function'
        )
          addConsoleLog(
            `  No purchase PSBTs in response (keys: ${Object.keys(purchaseData || {}).join(', ')})`
          );
      }
    }
    if (purchaseList.length === 0)
      return {
        success: false,
        error:
          'No purchase PSBTs returned from intent after retries (ensure prep tx confirmed and same-run signed prep used)',
      };
  }

  // Step 4: Sign the purchase PSBT(s). Do not finalize — broadcast API expects signed PSBTs and finalizes server-side (finalize: true causes "unknown input" for some purchase PSBTs).
  const signedPurchasePSBTs = [];
  try {
    for (let i = 0; i < purchaseList.length; i++) {
      const p = purchaseList[i];
      const pB64 = toPsbtBase64(p.base64 ?? p.hex);
      if (!pB64) continue;
      const signP = await signPsbtWithProxyWallet(
        pB64.trim(),
        wallet.privateKey,
        network,
        {
          finalize: false,
          extractTx: false,
          expectedPublicKey: publicKey,
          walletAddress: address,
        }
      );
      if (signP?.base64) signedPurchasePSBTs.push(signP.base64);
    }
  } catch (signErr) {
    const msg = signErr && signErr.message ? String(signErr.message) : '';
    return {
      success: false,
      error:
        normalizeSecureContextError(msg) ||
        msg ||
        'Failed to sign purchase PSBTs',
    };
  }

  if (signedPurchasePSBTs.length === 0) {
    return {
      success: false,
      error:
        'No purchase PSBTs to sign; secure purchase flow may be incomplete',
    };
  }

  console.log(
    '[Satflow] signed purchase PSBT(s) (base64):',
    signedPurchasePSBTs.length === 1
      ? signedPurchasePSBTs[0]
      : signedPurchasePSBTs
  );

  // Step 3b: Get transfer PSBT from /v1/intent/secure-purchase with signedPaymentPrepPSBTs + signedPurchasePSBTs
  const signedPaymentPrepPSBTsForIntent = signedPaymentPrepPSBT
    ? [signedPaymentPrepPSBT]
    : [];
  const transferIntentResult = await runSecureIntent(
    signedPaymentPrepPSBTsForIntent,
    signedPurchasePSBTs
  );
  let signedSecureTransferPSBT = null;
  if (transferIntentResult.ok) {
    const transferData =
      transferIntentResult.data?.data ?? transferIntentResult.data;
    const transferPsbtObj =
      transferData?.transferPsbt ?? transferData?.transferPsbts?.[0];
    const tB64 = transferPsbtObj
      ? toPsbtBase64(
          transferPsbtObj.base64 ?? transferPsbtObj.hex ?? transferPsbtObj
        )
      : null;
    if (tB64) {
      if (typeof addConsoleLog === 'function')
        addConsoleLog('  Signing transfer PSBT...');
      try {
        const signT = await signPsbtWithProxyWallet(
          tB64.trim(),
          wallet.privateKey,
          network,
          { finalize: false, extractTx: false, walletAddress: address }
        );
        if (signT?.base64) {
          signedSecureTransferPSBT = signT.base64;
          if (typeof addConsoleLog === 'function')
            addConsoleLog('  Transfer PSBT signed.');
        }
      } catch (e) {
        console.warn('[Satflow] transfer PSBT sign failed:', e?.message);
        if (typeof addConsoleLog === 'function')
          addConsoleLog(`  ⚠ Transfer sign failed: ${e?.message}`);
      }
    }
  } else if (typeof addConsoleLog === 'function') {
    addConsoleLog(
      `  ⚠ Could not get transfer PSBT: ${transferIntentResult.error || 'unknown'}`
    );
  }

  // Build broadcast payload per POST /v1/purchase/broadcast. Strict 1:1 to avoid "Mismatched compact txs":
  // inscriptionIds.length === signedSecurePaymentPrepPSBTs.length === signedSecurePurchasePSBTs.length (all arrays of strings).
  const inscriptionIds = [tokenId];
  const n = inscriptionIds.length;

  const prepStr =
    signedPaymentPrepPSBT != null
      ? typeof signedPaymentPrepPSBT === 'string'
        ? signedPaymentPrepPSBT.trim()
        : String(
            signedPaymentPrepPSBT?.base64 ?? signedPaymentPrepPSBT?.hex ?? ''
          ).trim()
      : '';
  const prepList = prepStr.length > 0 ? [prepStr] : [];
  const purchaseListForBroadcast = (
    Array.isArray(signedPurchasePSBTs)
      ? signedPurchasePSBTs
      : [signedPurchasePSBTs].filter(Boolean)
  )
    .slice(0, n)
    .map((p) =>
      (typeof p === 'string' ? p : String(p?.base64 ?? p?.hex ?? '')).trim()
    )
    .filter((s) => s.length > 0);

  if (purchaseListForBroadcast.length !== n) {
    return {
      success: false,
      error: `PSBT/inscription count mismatch: ${purchaseListForBroadcast.length} purchase PSBT(s) for ${n} inscription(s). Each ordinal must have one prep and one purchase PSBT.`,
    };
  }
  if (prepList.length > 0 && prepList.length !== n) {
    return {
      success: false,
      error: `Prep PSBT count (${prepList.length}) must match inscription count (${n}).`,
    };
  }
  if (
    signedSecureTransferPSBT &&
    (prepList.length !== n || purchaseListForBroadcast.length !== n)
  ) {
    return {
      success: false,
      error: `For full secure flow (with transfer), prep and purchase counts must equal inscription count (${n}). Got prep: ${prepList.length}, purchase: ${purchaseListForBroadcast.length}.`,
    };
  }
  if (signedSecureTransferPSBT && prepList.length === 0) {
    return {
      success: false,
      error:
        'Broadcast requires a signed payment prep PSBT for secure purchase (same run as purchase/transfer). Missing prep.',
    };
  }

  const transferStr =
    signedSecureTransferPSBT != null
      ? typeof signedSecureTransferPSBT === 'string'
        ? signedSecureTransferPSBT.trim()
        : String(
            signedSecureTransferPSBT?.base64 ??
              signedSecureTransferPSBT?.hex ??
              ''
          ).trim()
      : '';

  // Match working Satflow website payload: all three PSBTs in HEX, prep included (same format as their proxy).
  const prepTrimmed =
    prepList.length === n
      ? prepList.map((p) =>
          typeof p === 'string' ? p.trim() : String(p ?? '')
        )
      : [];
  const purchaseTrimmed = purchaseListForBroadcast.map((p) =>
    typeof p === 'string' ? p.trim() : String(p ?? '')
  );
  const transferTrimmed = transferStr
    ? typeof transferStr === 'string'
      ? transferStr.trim()
      : String(transferStr ?? '')
    : '';

  const prepHex =
    prepTrimmed.length > 0
      ? prepTrimmed.map((p) => toPsbtHexForBroadcast(p) || p)
      : [];
  const purchaseHex = purchaseTrimmed.map((p) => toPsbtHexForBroadcast(p) || p);
  const transferHex = transferTrimmed
    ? toPsbtHexForBroadcast(transferTrimmed) || transferTrimmed
    : '';

  const broadcastPayload = {
    buyerAddress: address,
    buyerTokenReceiveAddress: address,
    buyerTokenReceivePublicKey: publicKey,
    buyerPublicKey: publicKey,
    feeRate: 4,
    referralAddress: SATFLOW_REFERRAL_ADDRESS,
    inscriptionIds,
    runesOutputs: [],
    extractionFeeRate: 0,
    signedSecurePaymentPrepPSBTs: prepHex,
    signedSecurePurchasePSBTs: purchaseHex,
    splitQuantity: 0,
    securePurchase: true,
    skipBroadcast: false,
  };
  if (transferHex) {
    broadcastPayload.signedSecureTransferPSBT = transferHex;
  }

  console.log('[Satflow] broadcast payload (hex PSBTs, prep included):', {
    inscriptionIds: inscriptionIds.length,
    signedSecurePaymentPrepPSBTs:
      broadcastPayload.signedSecurePaymentPrepPSBTs?.length ?? 0,
    signedSecurePurchasePSBTs:
      broadcastPayload.signedSecurePurchasePSBTs?.length ?? 0,
    hasTransfer: Boolean(broadcastPayload.signedSecureTransferPSBT),
  });

  // Step 5: Broadcast via POST /v1/purchase/broadcast (retry on 500 "Missing secure context" in case it's transient)
  const BROADCAST_RETRIES = 3;
  const BROADCAST_RETRY_DELAY_MS = 2500;
  let broadcastRes;
  let rawText;
  let broadcastData;
  for (let attempt = 1; attempt <= BROADCAST_RETRIES; attempt++) {
    if (attempt > 1 && typeof addConsoleLog === 'function')
      addConsoleLog(`  Broadcast retry ${attempt}/${BROADCAST_RETRIES}...`);
    broadcastRes = await fetch('/api/satflow-purchase-broadcast', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(broadcastPayload),
    });
    rawText = await broadcastRes.text();
    try {
      broadcastData = rawText ? JSON.parse(rawText) : {};
    } catch (parseErr) {
      console.error(
        '[Satflow] purchase/broadcast response not JSON:',
        broadcastRes.status,
        rawText?.slice(0, 500)
      );
      return {
        success: false,
        error: `Broadcast failed (${broadcastRes.status}): ${rawText?.slice(0, 200) || 'Invalid response'}`,
      };
    }
    const fillTx = broadcastData?.data?.fillTx ?? broadcastData?.fillTx;
    if (broadcastRes.ok && (broadcastData?.success === true || fillTx)) {
      removePendingPrep(tokenId, address);
      return { success: true, txid: fillTx || null, data: broadcastData };
    }
    const apiError =
      broadcastData?.error ??
      broadcastData?.message ??
      (typeof broadcastData?.data === 'string' ? broadcastData.data : null) ??
      `HTTP ${broadcastRes.status}`;
    const isRetryable500 =
      broadcastRes.status === 500 &&
      /verifying PSBT|Missing secure context/i.test(String(apiError));
    if (!isRetryable500 || attempt === BROADCAST_RETRIES) break;
    await new Promise((r) => setTimeout(r, BROADCAST_RETRY_DELAY_MS));
  }

  const fillTx = broadcastData?.data?.fillTx ?? broadcastData?.fillTx;
  if (broadcastRes.ok && (broadcastData?.success === true || fillTx)) {
    removePendingPrep(tokenId, address);
    return { success: true, txid: fillTx || null, data: broadcastData };
  }

  const apiError =
    broadcastData?.error ??
    broadcastData?.message ??
    (typeof broadcastData?.data === 'string' ? broadcastData.data : null) ??
    `HTTP ${broadcastRes.status}`;
  console.error(
    '[Satflow] purchase/broadcast failed (step 5):',
    broadcastRes.status,
    apiError,
    broadcastData
  );
  const isSatflowServerSecureContext =
    broadcastRes.status === 500 &&
    /verifying PSBT|Missing secure context/i.test(String(apiError));
  if (isSatflowServerSecureContext) {
    console.warn(
      '[Satflow] Broadcast API 500 "Missing secure context" — Satflow server-side bug. Report to Satflow Discord: POST /v1/purchase/broadcast returns 500 with this error.'
    );
  }
  const displayError = isSatflowServerSecureContext
    ? "Satflow's broadcast API is returning a server error (500 - Missing secure context). This is a bug on Satflow's side, not your app. Please report to Satflow support (Discord) and retry later."
    : apiError;
  return {
    success: false,
    error: displayError,
    _broadcastFailed: true,
  };
};
