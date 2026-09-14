import { Signer as Bip322Signer } from 'bip322-js';
import ECPairFactory from 'ecpair';
import * as ecc from '@bitcoinerlab/secp256k1';
import { networks } from 'bitcoinjs-lib';
import {
  signPsbtWithProxyWallet,
  derivePublicKeyFromPrivateKey,
  deriveAddressFromPrivateKey,
} from '../../lib/bitcoinUtils';
import {
  getMempoolAddressUrl,
  getMempoolAddressUtxoUrl,
  getMempoolTxUrl,
} from '../../lib/mempoolProvider';
import { getTokenId } from '../ordinals';
import { buildUnisatProxyUrl } from '../../lib/unisatProxy';

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

const clearStoredSession = (address) => {
  try {
    window.localStorage.removeItem(`${ORDNET_SESSION_PREFIX}${address}`);
  } catch {
    // Nothing to clear.
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

/*
 * Write pacing.
 *
 * ord.net allows 8 writes per profile per 60-second window. A purchase is two
 * of them (preflight, then submit), so a run doing four buys a minute is
 * already at the ceiling — and a 429 mid-purchase is worse than a wait,
 * because the preflight is spent and the listing may be gone by the retry.
 *
 * So writes queue behind a rolling window rather than racing into a refusal.
 * Reads are not paced: their limit is far higher and the proxy caches them.
 */
const WRITE_LIMIT = 8;
const WRITE_WINDOW_MS = 60000;
/** Leaves room for the other tabs and calls sharing this profile. */
const WRITE_HEADROOM = 1;

const writeTimes = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const awaitWriteSlot = async () => {
  for (;;) {
    const cutoff = Date.now() - WRITE_WINDOW_MS;
    while (writeTimes.length > 0 && writeTimes[0] <= cutoff) writeTimes.shift();

    if (writeTimes.length < WRITE_LIMIT - WRITE_HEADROOM) {
      writeTimes.push(Date.now());
      return;
    }

    // Wait for the oldest call to age out of the window, plus a little.
    await sleep(writeTimes[0] - cutoff + 250);
  }
};

/**
 * Low-level call into the ord.net proxy.
 *
 * Exported for `ordnetCollections`, which needs the same transport and
 * session handling. Treat it as internal to this directory.
 */
export const ordNetFetch = async (
  path,
  { method = 'GET', token, query, body, retried = false } = {}
) => {
  const params = new URLSearchParams({ path });
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    });
  }

  if (method !== 'GET') await awaitWriteSlot();

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

  if (response.status === 429 && !retried) {
    /*
     * Rate limited despite the pacing — another tab or a read burst got
     * there first. The windows are 60s fixed, so waiting one out is the
     * whole remedy.
     */
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000
    );
    return ordNetFetch(path, { method, token, query, body, retried: true });
  }

  if (!response.ok) {
    const message =
      data?.error || data?.message || text || `HTTP ${response.status}`;
    const error = new Error(`ord.net ${path} failed: ${message}`);
    /*
     * Callers branch on this: 401 means re-authenticate, 403 on the auth
     * flow means the wallet is under ord.net's funding floor, 429 means back
     * off. Without the status they would all look like the same string.
     */
    error.status = response.status;
    throw error;
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

  let verified;
  try {
    verified = await ordNetFetch('/auth/verify', {
      method: 'POST',
      body: {
        authRequestId: challenge.authRequestId,
        verifications,
      },
    });
  } catch (error) {
    if (error?.status === 403) {
      throw new Error(
        `ord.net will not sign in ${address}: it needs at least 0.01 BTC confirmed to trade.`
      );
    }
    if (error?.status === 503) {
      throw new Error(
        'ord.net cannot check wallet eligibility right now. Try again shortly.'
      );
    }
    throw error;
  }

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

/**
 * ord.net will not issue a session token unless the wallet's payment address
 * holds this much, confirmed. It is a minimum balance rather than a fee — the
 * coin stays spendable — but a wallet under it cannot trade here at all.
 */
export const ORDNET_MIN_FUNDING_SATS = 1000000; // 0.01 BTC

/**
 * Which wallets ord.net will authenticate, checked before a run rather than
 * discovered as a 403 midway through one.
 *
 * @param {{address: string}[]} wallets
 * @param {string} network
 * @returns {Promise<{eligible: object[], skipped: {wallet: object, confirmed: number}[]}>}
 */
export const checkOrdNetEligibility = async (wallets, network = 'mainnet') => {
  const eligible = [];
  const skipped = [];

  for (const wallet of wallets || []) {
    let confirmed = 0;
    try {
      const response = await fetch(
        getMempoolAddressUrl(wallet.address, network)
      );
      if (response.ok) {
        const stats = await response.json();
        const chain = stats?.chain_stats;
        confirmed = chain
          ? Number(chain.funded_txo_sum || 0) - Number(chain.spent_txo_sum || 0)
          : 0;
      }
    } catch {
      // Treat an unreadable balance as ineligible rather than letting the
      // run fail later against ord.net with a 403.
      confirmed = 0;
    }

    if (confirmed >= ORDNET_MIN_FUNDING_SATS) eligible.push(wallet);
    else skipped.push({ wallet, confirmed });
  }

  return { eligible, skipped };
};

/**
 * Run an authenticated call, re-authenticating once if the token is rejected.
 *
 * Tokens last an hour and a run can outlive one. The stored session is
 * dropped and rebuilt on a 401 so a long run does not die on an expiry it
 * could simply have renewed.
 */
const withOrdNetSession = async (wallet, network, run) => {
  const session = await ensureOrdNetSession(wallet, network);
  try {
    return await run(session);
  } catch (error) {
    if (error?.status !== 401) throw error;
    clearStoredSession(session.address);
    const renewed = await ensureOrdNetSession(wallet, network);
    return run(renewed);
  }
};

/** A session for read calls. Internal to this directory; see ordNetFetch. */
export const getReadSession = async (options = {}) => {
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

/*
 * Collection membership cache.
 *
 * Which inscriptions belong to a collection barely changes, but who owns them
 * and what they cost change constantly. Reading all three together meant
 * re-scanning the whole collection every cycle, for every wallet — 10 reads
 * per wallet per tick against a 30-per-minute budget, which 429s almost
 * immediately with more than a couple of wallets.
 *
 * So membership is read once and reused, and the volatile halves come from
 * the two cheap sources below.
 */
const MEMBERSHIP_TTL_MS = 15 * 60 * 1000;
const membershipCache = new Map();

/** Every inscription id in a collection, as a Set. Cached. */
const getCollectionMembership = async (collectionSymbol, session) => {
  const cached = membershipCache.get(collectionSymbol);
  if (cached && Date.now() - cached.at < MEMBERSHIP_TTL_MS) return cached.ids;

  const ids = new Set();
  let cursor = null;

  for (let page = 0; page < MAX_COLLECTION_SCAN_PAGES; page++) {
    const data = await ordNetFetch(
      `/collection/${encodeURIComponent(collectionSymbol)}/inscriptions`,
      {
        token: session.sessionToken,
        query: { limit: 100, cursor, sort: 'oldest' },
      }
    );

    for (const row of data.items || []) {
      const id = row.inscriptionId || row.id;
      if (id) ids.add(id);
    }

    cursor = data.pagination?.nextCursor || null;
    if (!data.pagination?.hasNext || !cursor) break;
  }

  membershipCache.set(collectionSymbol, { at: Date.now(), ids });
  return ids;
};

/**
 * Inscriptions an address holds, from UniSat's owner-indexed API.
 *
 * ord.net has no holdings-by-owner endpoint, and UniSat's costs nothing
 * against ord.net's rate limit. Returns inscription ids with the outpoint
 * they sit on, so a pending move can be spotted.
 */
const fetchHeldInscriptions = async (address) => {
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
    if (!response.ok) break;

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

/**
 * What a wallet holds in a collection, and what of it is listed on ord.net.
 *
 * Assembled from three sources rather than one scan, because each answers a
 * different question at a very different price:
 *
 *   membership  — ord.net, cached, rarely changes
 *   ownership   — UniSat, owner-indexed, free of ord.net's rate limit
 *   listings    — ord.net, one exact read filtered to this seller
 *
 * That is one ord.net read per wallet per cycle instead of ten, and the
 * listed half is no longer capped at the first 1000 inscriptions of a
 * collection, which used to hide a listing in anything larger.
 */
export const fetchWalletOrdinals = async (
  ownerAddress,
  collectionSymbol = null,
  bypassCache = false,
  options = {}
) => {
  if (!ownerAddress || !collectionSymbol) return [];
  const session = await getReadSession(options);

  // The seller's live listings: exact, and the authority on price.
  const listingsResponse = await ordNetFetch('/listings', {
    token: session.sessionToken,
    query: {
      sellerAddress: ownerAddress,
      collectionSlug: collectionSymbol,
      limit: 100,
      ...(bypassCache ? { _t: Date.now() } : {}),
    },
  });

  const listed = new Map();
  for (const row of listingsResponse?.listings || []) {
    const normalized = normalizeListing(row, collectionSymbol);
    if (normalized) listed.set(normalized.inscriptionId, normalized);
  }

  const [membership, held] = await Promise.all([
    getCollectionMembership(collectionSymbol, session),
    fetchHeldInscriptions(ownerAddress),
  ]);

  const results = [];

  // Listed items first: ord.net already told us these are this wallet's.
  for (const item of listed.values()) results.push(item);

  // Then anything held in the collection that is not currently listed.
  for (const [inscriptionId, utxo] of held) {
    if (listed.has(inscriptionId)) continue;
    if (!membership.has(inscriptionId)) continue;
    results.push({
      inscriptionId,
      id: inscriptionId,
      tokenId: inscriptionId,
      listingId: null,
      inscriptionNumber: utxo.inscriptionNumber,
      contentURI: null,
      contentPreviewURI: null,
      contentType: null,
      listed: false,
      listedPrice: null,
      collectionSymbol,
      owner: ownerAddress,
      mempoolTxId: '',
      _ordNetRaw: { source: 'unisat', ...utxo },
    });
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

    const submit = await withOrdNetSession(wallet, network, (fresh) =>
      ordNetFetch(
        `/collection/${encodeURIComponent(collectionSymbol)}/listings/submit`,
        {
          method: 'POST',
          token: fresh.sessionToken,
          body: {
            ...preflightRequest,
            walletBindingId: fresh.walletBindingId,
            durationDays: DEFAULT_LISTING_DURATION_DAYS,
            anchors,
            signed: signedEntries,
            signedRecoveryPsbt: signedRecovery,
          },
        }
      )
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

/*
 * Outputs at or below this are inscription postage, not money.
 *
 * 546 is the usual postage; a little headroom covers wallets that pad it.
 * Anything this small is useless for payment anyway, so excluding it costs
 * nothing and keeps the obvious inscription UTXOs out of the candidate set.
 */
const POSTAGE_CEILING_SATS = 1000;

/** ord.net rejects more than this many candidates in one call. */
const MAX_SPENDABLE_UTXOS = 1000;

/**
 * Candidate payment UTXOs for an ord.net preflight.
 *
 * ord.net picks which of these to spend, so anything handed over is offered
 * up as payment. These wallets hold inscriptions they have bought, and an
 * inscription spent as payment is gone — so postage-sized outputs are
 * filtered out, and callers that know where an inscription sits can exclude
 * its outpoint directly.
 *
 * The filter is a value heuristic rather than a per-UTXO inscription lookup:
 * that lookup is one API call per UTXO, which is both slow on a wallet with
 * a long UTXO history and a drain on our own proxy quota. ord.net indexes
 * inscriptions and very likely filters them server-side too, but a buyer
 * should not be relying on that.
 *
 * @param {string} address
 * @param {string} network
 * @param {{ exclude?: {txid: string, vout: number}[] }} [options]
 */
const getSpendableUtxos = async (
  address,
  network = 'mainnet',
  options = {}
) => {
  const response = await fetch(getMempoolAddressUtxoUrl(address, network));
  if (!response.ok) throw new Error(`Could not fetch UTXOs for ${address}`);
  const utxos = await response.json();

  const excluded = new Set(
    (options.exclude || []).map((o) => `${o.txid}:${Number(o.vout)}`)
  );

  return (
    (Array.isArray(utxos) ? utxos : [])
      .filter(
        (u) =>
          u?.txid &&
          Number(u.value) > POSTAGE_CEILING_SATS &&
          !excluded.has(`${u.txid}:${Number(u.vout)}`)
      )
      .map((u) => ({
        txid: u.txid,
        vout: Number(u.vout),
        valueSats: Number(u.value),
      }))
      // Largest first, so the cap keeps the UTXOs actually worth spending.
      .sort((a, b) => b.valueSats - a.valueSats)
      .slice(0, MAX_SPENDABLE_UTXOS)
  );
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

    const submit = await withOrdNetSession(wallet, network, (session) =>
      ordNetFetch(
        `/collection/${encodeURIComponent(intentData.collectionSymbol)}/purchases/submit`,
        {
          method: 'POST',
          token: session.sessionToken,
          body: {
            ...intentData.preflightRequest,
            walletBindingId: session.walletBindingId,
            purchaseAnchorUtxoId: intentData.preflight.purchaseAnchorUtxoId,
            selectedPaymentUtxos: intentData.preflight.selectedPaymentUtxos,
            signedSteps: intentData.signedSteps,
          },
        }
      )
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
