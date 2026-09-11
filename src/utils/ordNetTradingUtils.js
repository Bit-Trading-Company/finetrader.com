import { Signer as Bip322Signer } from 'bip322-js';
import ECPairFactory from 'ecpair';
import * as ecc from '@bitcoinerlab/secp256k1';
import { networks } from 'bitcoinjs-lib';
import {
  signPsbtWithProxyWallet,
  derivePublicKeyFromPrivateKey,
  deriveAddressFromPrivateKey,
} from './bitcoinUtils';
import { getMempoolAddressUtxoUrl, getMempoolTxUrl } from './mempoolProvider';
import { getTokenId } from './autoTradingUtils';

const ECPair = ECPairFactory(ecc);
const ORDNET_SESSION_PREFIX = 'fine-trading-ordnet-session:';
const DEFAULT_LISTING_DURATION_DAYS = 30;
const MAX_COLLECTION_SCAN_PAGES = 10;

const hexToBytes = (hex) => {
  const clean = String(hex || '').trim();
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) {
    return new Uint8Array();
  }
  return new Uint8Array(clean.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
};

const base64ToHex = (value) => {
  if (!value) return '';
  const binary = atob(value);
  return Array.from(binary)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
};

const getWalletAddressAndPublicKey = (wallet, network = 'mainnet') => {
  let address = wallet?.address;
  let publicKey = wallet?.publicKey;
  try {
    address = deriveAddressFromPrivateKey(wallet.privateKey, network);
    publicKey = derivePublicKeyFromPrivateKey(wallet.privateKey, network);
  } catch {
    // Use wallet-provided fields when derivation is unavailable.
  }
  if (!address || !publicKey) {
    throw new Error('Could not get wallet address or public key');
  }
  return { address, publicKey };
};

const privateKeyHexToWif = (privateKeyHex, network = 'mainnet') => {
  const keyPair = ECPair.fromPrivateKey(
    Buffer.from(hexToBytes(privateKeyHex)),
    {
      network:
        String(network).toLowerCase() === 'mainnet'
          ? networks.bitcoin
          : networks.testnet,
    }
  );
  return keyPair.toWIF();
};

const getStoredSession = (address) => {
  try {
    const raw = window.localStorage.getItem(
      `${ORDNET_SESSION_PREFIX}${address}`
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.sessionToken || !parsed?.walletBindingId) return null;
    if (parsed.expiresAt && Date.parse(parsed.expiresAt) - Date.now() < 60000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const setStoredSession = (address, session) => {
  try {
    window.localStorage.setItem(
      `${ORDNET_SESSION_PREFIX}${address}`,
      JSON.stringify(session)
    );
  } catch {
    // Ignore storage failures; the session can be recreated.
  }
};

const ordNetFetch = async (
  path,
  { method = 'GET', token, query, body } = {}
) => {
  const params = new URLSearchParams({ path });
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    });
  }

  const response = await fetch(`/api/ordnet?${params.toString()}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(method === 'GET' ? {} : { 'content-type': 'application/json' }),
    },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }),
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error || data?.message || text || `HTTP ${response.status}`;
    throw new Error(`ord.net ${path} failed: ${message}`);
  }

  return data;
};

export const ensureOrdNetSession = async (wallet, network = 'mainnet') => {
  const { address } = getWalletAddressAndPublicKey(wallet, network);
  const cached = getStoredSession(address);
  if (cached) return cached;

  const challenge = await ordNetFetch('/auth/challenge', {
    method: 'POST',
    body: {
      ordinalsAddress: address,
      paymentAddress: address,
    },
  });

  const wif = privateKeyHexToWif(wallet.privateKey, network);
  const verifications = (challenge.challenges || []).map((entry) => {
    const signatureBase64 = Bip322Signer.sign(
      wif,
      entry.address,
      entry.message
    );
    return {
      challengeId: entry.challengeId,
      address: entry.address,
      signature: base64ToHex(signatureBase64),
    };
  });

  const verified = await ordNetFetch('/auth/verify', {
    method: 'POST',
    body: {
      authRequestId: challenge.authRequestId,
      verifications,
    },
  });

  const binding =
    (verified.walletBindings || []).find(
      (b) =>
        String(b.ordinalsAddress).toLowerCase() === address.toLowerCase() ||
        String(b.paymentAddress).toLowerCase() === address.toLowerCase()
    ) || verified.walletBindings?.[0];

  if (!verified.sessionToken || !binding?.walletBindingId) {
    throw new Error(
      'ord.net auth did not return a session token and wallet binding'
    );
  }

  const session = {
    sessionToken: verified.sessionToken,
    expiresAt: verified.expiresAt,
    walletBindingId: binding.walletBindingId,
    address,
  };
  setStoredSession(address, session);
  return session;
};

const getReadSession = async (options = {}) => {
  const wallet = options.wallet || options.wallets?.[0];
  if (!wallet) {
    throw new Error(
      'ord.net reads require a proxy wallet for API authentication'
    );
  }
  return ensureOrdNetSession(wallet, options.network || 'mainnet');
};

const normalizeListing = (row, fallbackCollectionSlug) => {
  if (!row?.inscriptionId || !row?.listingId || !row?.priceSats) return null;
  return {
    inscriptionId: row.inscriptionId,
    id: row.inscriptionId,
    tokenId: row.inscriptionId,
    listingId: row.listingId,
    inscriptionNumber: row.inscriptionNumber,
    contentURI: row.image || null,
    contentPreviewURI: row.image || null,
    contentType: row.contentType || row.rawContentType || null,
    listed: true,
    listedPrice: Number(row.priceSats),
    collectionSymbol: row.collection?.slug || fallbackCollectionSlug,
    owner: row.sellerAddress || row.owner || null,
    mempoolTxId: '',
    _ordNetRaw: row,
  };
};

const normalizeCollectionInscription = (row, fallbackCollectionSlug) => {
  if (!row?.inscriptionId && !row?.id) return null;
  const inscriptionId = row.inscriptionId || row.id;
  return {
    inscriptionId,
    id: inscriptionId,
    tokenId: inscriptionId,
    listingId: row.listingId || null,
    inscriptionNumber: row.inscription || row.inscriptionNumber,
    contentURI: row.image || null,
    contentPreviewURI: row.image || null,
    contentType: row.contentType || row.rawContentType || null,
    listed: row.listingState === 'buyable' && !!row.priceSats,
    listedPrice: row.priceSats ? Number(row.priceSats) : null,
    collectionSymbol: row.collection || fallbackCollectionSlug,
    owner: row.owner || null,
    mempoolTxId: '',
    meta: row.name ? { name: row.name } : undefined,
    _ordNetRaw: row,
  };
};

export const fetchCollectionItems = async (
  collectionSymbol,
  bypassCache = false,
  options = {}
) => {
  const session = await getReadSession(options);
  const limit = Math.min(100, Math.max(1, Number(options.pageSize) || 100));
  let cursor = options.cursor || null;
  const targetPage = Math.max(1, Number(options.page) || 1);

  for (let page = 1; page < targetPage; page++) {
    const skipped = await ordNetFetch('/listings', {
      token: session.sessionToken,
      query: {
        collectionSlug: collectionSymbol,
        sort: 'price',
        limit,
        cursor,
        ...(bypassCache ? { _t: Date.now() } : {}),
      },
    });
    cursor = skipped?.pagination?.nextCursor || null;
    if (!cursor) return [];
  }

  const data = await ordNetFetch('/listings', {
    token: session.sessionToken,
    query: {
      collectionSlug: collectionSymbol,
      sort: 'price',
      limit,
      cursor,
      ...(bypassCache ? { _t: Date.now() } : {}),
    },
  });

  return (data.listings || [])
    .map((row) => normalizeListing(row, collectionSymbol))
    .filter(Boolean)
    .sort((a, b) => (a.listedPrice || 0) - (b.listedPrice || 0));
};

export const getFloorPrice = async (
  collectionSymbol,
  bypassCache = false,
  options = {}
) => {
  const session = await getReadSession(options);
  const data = await ordNetFetch('/collection-stats/floors', {
    token: session.sessionToken,
    query: {
      slugs: collectionSymbol,
      ...(bypassCache ? { _t: Date.now() } : {}),
    },
  });
  const entry = (data.data || []).find(
    (item) => item.slug === collectionSymbol
  );
  return entry?.floor ? Number(entry.floor) : null;
};

export const fetchWalletOrdinals = async (
  ownerAddress,
  collectionSymbol = null,
  bypassCache = false,
  options = {}
) => {
  if (!ownerAddress || !collectionSymbol) return [];
  const session = await getReadSession(options);
  const owner = String(ownerAddress).toLowerCase();
  const results = [];
  let cursor = null;

  for (let page = 0; page < MAX_COLLECTION_SCAN_PAGES; page++) {
    const data = await ordNetFetch(
      `/collection/${encodeURIComponent(collectionSymbol)}/inscriptions`,
      {
        token: session.sessionToken,
        query: {
          limit: 100,
          cursor,
          sort: 'newest',
          ...(bypassCache ? { _t: Date.now() } : {}),
        },
      }
    );

    for (const row of data.items || []) {
      const normalized = normalizeCollectionInscription(row, collectionSymbol);
      if (
        normalized?.owner &&
        String(normalized.owner).toLowerCase() === owner
      ) {
        results.push(normalized);
      }
    }

    cursor = data.pagination?.nextCursor || null;
    if (!data.pagination?.hasNext || !cursor) break;
  }

  return results;
};

export const fetchTokenById = async (tokenId, options = {}) => {
  const collectionSymbol = options.collectionSymbol;
  if (!tokenId || !collectionSymbol) return null;
  const session = await getReadSession(options);
  let cursor = null;

  for (let page = 0; page < MAX_COLLECTION_SCAN_PAGES; page++) {
    const data = await ordNetFetch(
      `/collection/${encodeURIComponent(collectionSymbol)}/inscriptions`,
      {
        token: session.sessionToken,
        query: { limit: 100, cursor, sort: 'newest' },
      }
    );
    const match = (data.items || []).find(
      (row) => (row.inscriptionId || row.id) === tokenId
    );
    if (match) return normalizeCollectionInscription(match, collectionSymbol);
    cursor = data.pagination?.nextCursor || null;
    if (!data.pagination?.hasNext || !cursor) break;
  }
  return null;
};

export const checkPurchaseConfirmed = async (
  tokenId,
  expectedOwner,
  options = {}
) => {
  const token = await fetchTokenById(tokenId, options);
  return !!(
    token?.owner &&
    expectedOwner &&
    String(token.owner).toLowerCase() === String(expectedOwner).toLowerCase()
  );
};

const fetchListingForItem = async (item, collectionSymbol, wallet, network) => {
  if (item?.listingId) {
    return { listingId: item.listingId, inscriptionId: getTokenId(item) };
  }
  const tokenId = getTokenId(item);
  if (!tokenId) return null;
  const session = await ensureOrdNetSession(wallet, network);
  const data = await ordNetFetch('/listings', {
    token: session.sessionToken,
    query: { inscriptionId: tokenId, limit: 1 },
  });
  const listing = data.listings?.[0];
  if (!listing?.listingId) return null;
  return {
    listingId: listing.listingId,
    inscriptionId: listing.inscriptionId || tokenId,
  };
};

const signOrdNetStep = async (step, wallet, network, finalize = false) => {
  const signed = await signPsbtWithProxyWallet(
    step.psbtBase64,
    wallet.privateKey,
    network,
    {
      finalize,
      extractTx: false,
      walletAddress: step.signerAddress || wallet.address,
      inputSigningInstructions: step.inputsToSign || [],
    }
  );
  return {
    ...step,
    psbtBase64: signed.base64,
  };
};

export const listOrdinalWithProxyWallet = async (
  ordinal,
  priceInSats,
  wallet,
  network = 'mainnet',
  options = {}
) => {
  try {
    const inscriptionId = getTokenId(ordinal);
    const collectionSymbol =
      options.collectionSymbol ||
      ordinal.collectionSymbol ||
      options.selectedCollection?.collectionSymbol;
    if (!inscriptionId)
      throw new Error('Could not determine token ID from ordinal');
    if (!collectionSymbol)
      throw new Error('ord.net listing requires a collection slug');

    const { publicKey } = getWalletAddressAndPublicKey(wallet, network);
    const session = await ensureOrdNetSession(wallet, network);
    const items = [
      {
        inscriptionId,
        priceSats: Math.round(Number(priceInSats) || 0),
      },
    ];
    const preflightRequest = {
      walletBindingId: session.walletBindingId,
      ordinalsPublicKey: publicKey,
      items,
    };

    const preflight = await ordNetFetch(
      `/collection/${encodeURIComponent(collectionSymbol)}/listings/preflight`,
      {
        method: 'POST',
        token: session.sessionToken,
        body: preflightRequest,
      }
    );

    const signedEntries = [];
    const anchors = [];
    for (const entry of preflight.listings || []) {
      anchors.push({
        inscriptionId: entry.inscriptionId,
        anchorUtxoId: entry.anchorUtxoId,
      });
      const signedSteps = [];
      for (const step of entry.psbts || []) {
        signedSteps.push(await signOrdNetStep(step, wallet, network, false));
      }
      signedEntries.push({
        inscriptionId: entry.inscriptionId,
        psbts: signedSteps,
      });
    }

    const signedRecovery = await signOrdNetStep(
      preflight.recoveryPsbt,
      wallet,
      network,
      false
    );

    const submit = await ordNetFetch(
      `/collection/${encodeURIComponent(collectionSymbol)}/listings/submit`,
      {
        method: 'POST',
        token: session.sessionToken,
        body: {
          ...preflightRequest,
          durationDays: DEFAULT_LISTING_DURATION_DAYS,
          anchors,
          signed: signedEntries,
          signedRecoveryPsbt: signedRecovery,
        },
      }
    );

    return {
      success: true,
      data: submit,
      listingId: submit.listings?.[0]?.listingId,
    };
  } catch (error) {
    console.error('ord.net list error:', error);
    return {
      success: false,
      error: error.message || 'Unknown ord.net list error',
    };
  }
};

const getSpendableUtxos = async (address, network = 'mainnet') => {
  const response = await fetch(getMempoolAddressUtxoUrl(address, network));
  if (!response.ok) throw new Error(`Could not fetch UTXOs for ${address}`);
  const utxos = await response.json();
  return (Array.isArray(utxos) ? utxos : [])
    .filter((u) => u?.txid && Number(u.value) > 0)
    .map((u) => ({
      txid: u.txid,
      vout: Number(u.vout),
      valueSats: Number(u.value),
    }));
};

export const prepareSecurePurchase = async (
  ordinal,
  wallet,
  network = 'mainnet',
  addConsoleLog = null,
  isStopRequested = null,
  options = {}
) => {
  try {
    if (typeof isStopRequested === 'function' && isStopRequested()) {
      return { success: false, error: 'Trading stopped by user' };
    }
    const collectionSymbol =
      options.collectionSymbol ||
      ordinal.collectionSymbol ||
      options.selectedCollection?.collectionSymbol;
    if (!collectionSymbol)
      throw new Error('ord.net purchase requires a collection slug');
    const listing = await fetchListingForItem(
      ordinal,
      collectionSymbol,
      wallet,
      network
    );
    if (!listing?.listingId) throw new Error('ord.net listing ID not found');

    const { address, publicKey } = getWalletAddressAndPublicKey(
      wallet,
      network
    );
    const session = await ensureOrdNetSession(wallet, network);
    const spendableUtxos = await getSpendableUtxos(address, network);
    const preflightRequest = {
      walletBindingId: session.walletBindingId,
      paymentPublicKey: publicKey,
      listings: [listing],
      spendableUtxos,
    };

    const preflight = await ordNetFetch(
      `/collection/${encodeURIComponent(collectionSymbol)}/purchases/preflight`,
      {
        method: 'POST',
        token: session.sessionToken,
        body: preflightRequest,
      }
    );

    const signedSteps = [];
    for (const step of preflight.steps || []) {
      signedSteps.push(await signOrdNetStep(step, wallet, network, false));
    }

    if (typeof addConsoleLog === 'function') {
      addConsoleLog(
        `  ord.net purchase ready: total ${(Number(preflight.totalBuyerCostSats || 0) / 100000000).toFixed(8)} BTC`
      );
    }

    return {
      success: true,
      noPrepNeeded: true,
      intentData: {
        session,
        collectionSymbol,
        preflightRequest,
        preflight,
        signedSteps,
      },
    };
  } catch (error) {
    const message = error.message || 'Unknown ord.net purchase preflight error';
    return { success: false, error: message };
  }
};

export const completeSecurePurchase = async (
  ordinal,
  wallet,
  network = 'mainnet',
  addConsoleLog = null,
  isStopRequested = null,
  options = {}
) => {
  try {
    if (typeof isStopRequested === 'function' && isStopRequested()) {
      return { success: false, error: 'Trading stopped by user' };
    }

    let intentData = options.intentData;
    if (!intentData) {
      const prepared = await prepareSecurePurchase(
        ordinal,
        wallet,
        network,
        addConsoleLog,
        isStopRequested,
        options
      );
      if (!prepared.success) return prepared;
      intentData = prepared.intentData;
    }

    const submit = await ordNetFetch(
      `/collection/${encodeURIComponent(intentData.collectionSymbol)}/purchases/submit`,
      {
        method: 'POST',
        token: intentData.session.sessionToken,
        body: {
          ...intentData.preflightRequest,
          purchaseAnchorUtxoId: intentData.preflight.purchaseAnchorUtxoId,
          selectedPaymentUtxos: intentData.preflight.selectedPaymentUtxos,
          signedSteps: intentData.signedSteps,
        },
      }
    );

    const txid =
      submit.settlementTxid ||
      submit.listingTransferTxids?.[0] ||
      intentData.preflight.expectedSettlementTxid;

    if (typeof addConsoleLog === 'function' && txid) {
      addConsoleLog(
        '  ord.net purchase submitted.',
        getMempoolTxUrl(txid, network)
      );
    }

    return { success: true, txid, data: submit };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown ord.net purchase submit error',
    };
  }
};

export const delistOrdinalWithProxyWallet = async (
  ordinal,
  wallet,
  network = 'mainnet',
  options = {}
) => {
  try {
    const collectionSymbol =
      options.collectionSymbol ||
      ordinal.collectionSymbol ||
      options.selectedCollection?.collectionSymbol;
    if (!collectionSymbol)
      throw new Error('ord.net delist requires a collection slug');
    const listing = await fetchListingForItem(
      ordinal,
      collectionSymbol,
      wallet,
      network
    );
    if (!listing?.listingId) throw new Error('ord.net listing ID not found');

    const session = await ensureOrdNetSession(wallet, network);
    const data = await ordNetFetch(
      `/collection/${encodeURIComponent(collectionSymbol)}/listings/delist`,
      {
        method: 'POST',
        token: session.sessionToken,
        body: {
          walletBindingId: session.walletBindingId,
          listings: [listing],
        },
      }
    );
    return { success: true, data };
  } catch (error) {
    console.error('ord.net delist error:', error);
    return {
      success: false,
      error: error.message || 'Unknown ord.net delist error',
    };
  }
};
