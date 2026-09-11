import {
  signPsbtWithProxyWallet,
  derivePublicKeyFromPrivateKey,
  deriveAddressFromPrivateKey,
  getTaprootInternalPubkeyBytes,
} from '../lib/bitcoinUtils';
import * as bitcoin from 'bitcoinjs-lib';
import {
  getMempoolTxUrl,
  getMempoolTxApiUrl,
  getMempoolTxHexUrl,
  getMempoolBroadcastUrl,
  getMempoolTxStatusUrl,
  getMempoolAddressUrl,
  getMempoolAddressUtxoUrl,
  getMempoolAddressTxsMempoolUrl,
  getMempoolFeeEstimatesUrl,
  getMempoolRecommendedFeesUrl,
} from '../lib/mempoolProvider';
import {
  calculateTradingFeeAmount,
  TRADING_FEE_RECEIVER_ADDRESS,
} from './tradingFeeUtils';
import { buildUnisatProxyUrl } from '../lib/unisatProxy';

/**
 * Get token ID from ordinal - tries multiple possible field names
 * @param {Object} ordinal - The ordinal object
 * @returns {string|null} Token ID or null
 */
export const getTokenId = (ordinal) => {
  if (!ordinal) return null;
  return (
    ordinal.tokenId ||
    // Satflow item / wallet-contents shape
    ordinal.inscriptionId ||
    ordinal.id ||
    (ordinal.inscriptionNumber
      ? `${ordinal.txid || ordinal.genesisTransaction || ''}i${ordinal.inscriptionNumber}`
      : null)
  );
};

/**
 * Get inscription ID from an ordinal (used for explorer / marketplace links)
 * @param {Object} ordinal - The ordinal object
 * @returns {string|null} Inscription ID
 */
export const getInscriptionId = (ordinal) => {
  if (!ordinal) return null;
  return (
    ordinal.inscriptionId ||
    (ordinal.inscriptionNumber
      ? `${ordinal.txid || ordinal.genesisTransaction || ''}i${ordinal.inscriptionNumber}`
      : null)
  );
};

/**
 * Fetch a specific token by ID to check ownership (no cache), via the Satflow
 * item endpoint. More reliable than wallet contents for checking purchase status.
 * @param {string} tokenId - Token inscription ID
 * @returns {Promise<Object|null>} Token object or null
 */
export const fetchTokenById = async (tokenId) => {
  try {
    // Log the request for debugging
    console.log(`[fetchTokenById] Fetching token: ${tokenId}`);

    // Use Satflow item endpoint (proxied) to look up inscription details
    const params = new URLSearchParams({
      inscriptionId: tokenId,
      listing: 'true',
      bid: 'false',
      metadata: 'false',
    });

    const response = await fetch(`/api/satflow-item?${params.toString()}`);

    if (!response.ok) {
      console.error(`[fetchTokenById] HTTP error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const item = data?.data || data;

    if (item && item.owner) {
      console.log(`[fetchTokenById] Found token, owner: ${item.owner}`);
      return item;
    }

    console.log(`[fetchTokenById] No token found for ID: ${tokenId}`);
    return null;
  } catch (err) {
    console.error('[fetchTokenById] Error:', err);
    return null;
  }
};

/**
 * Normalize one row from GET /v1/activity/listings into the ordinal shape used by
 * prepareSecurePurchase / listing helpers (listed + listedPrice + tokenId).
 */
function normalizeSatflowActivityListing(row, fallbackCollectionSlug) {
  if (!row || typeof row !== 'object') return null;

  const ask = row.ask && typeof row.ask === 'object' ? row.ask : null;
  // Do not use row.id — activity rows use it for listing event id, not inscription
  const inscriptionId = (ask && ask.inscriptionId) || row.inscriptionId || null;
  if (!inscriptionId || typeof inscriptionId !== 'string') return null;

  const unit = row.unitPrice ?? row.price;
  const askPrice = ask && ask.price;
  const listedPrice =
    typeof unit === 'number' && unit > 0
      ? unit
      : typeof askPrice === 'number' && askPrice > 0
        ? askPrice
        : null;
  if (!listedPrice) return null;

  if (row.cancelledAt != null || row.invalidAt != null) return null;
  if (row.fillPendingAt != null) return null;
  if (row.orderType && String(row.orderType).toLowerCase() !== 'ask') {
    return null;
  }

  const owner =
    (ask && (ask.sellerOrdAddress || ask.sellerReceiveAddress)) ||
    row.owner ||
    null;

  const mempoolTxId = ask && ask.unconfirmed === true ? 'unconfirmed' : '';

  return {
    inscriptionId,
    id: inscriptionId,
    tokenId: inscriptionId,
    inscriptionNumber: ask?.inscriptionNumber ?? row.inscriptionNumber,
    contentType: ask?.inscriptionContentType || null,
    listed: true,
    listedPrice,
    collectionSymbol:
      (ask && ask.collectionSlug) ||
      row.collectionSlug ||
      fallbackCollectionSlug,
    owner,
    mempoolTxId,
    _satflowRaw: row,
  };
}

/**
 * Satflow GET /v1/activity/listings — paginated, sorted listings for a collection slug.
 * @returns {Promise<{ items: Array, total: number }>}
 */
export const fetchSatflowActivityListings = async (
  collectionSymbol,
  bypassCache = false,
  options = {}
) => {
  const empty = { items: [], total: 0 };
  try {
    if (!collectionSymbol) {
      return empty;
    }

    const pageSize = Math.min(
      250,
      Math.max(1, Number(options.pageSize) || 100)
    );
    const page = Math.max(1, parseInt(String(options.page || '1'), 10) || 1);
    const sortDirection =
      String(options.sortDirection || 'asc').toLowerCase() === 'desc'
        ? 'desc'
        : 'asc';
    const sortBy =
      options.sortBy != null ? String(options.sortBy) : 'unitPrice';

    const queryParams = new URLSearchParams({
      collectionSlug: String(collectionSymbol).trim(),
      page: String(page),
      pageSize: String(pageSize),
      timeRange: options.timeRange != null ? String(options.timeRange) : '30d',
      includeOnlyCollectionItems: 'true',
      sortBy,
      sortDirection,
    });

    if (bypassCache) {
      queryParams.append('_t', Date.now().toString());
    }

    const response = await fetch(
      `/api/satflow-activity-listings?${queryParams.toString()}`
    );
    if (!response.ok) {
      return empty;
    }

    const data = await response.json();
    const payload = data?.data || data;
    const rawListings = Array.isArray(payload?.listings)
      ? payload.listings
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

    const normalized = rawListings
      .map((row) => normalizeSatflowActivityListing(row, collectionSymbol))
      .filter(Boolean);

    if (sortDirection === 'desc') {
      normalized.sort((a, b) => (b.listedPrice || 0) - (a.listedPrice || 0));
    } else {
      normalized.sort((a, b) => (a.listedPrice || 0) - (b.listedPrice || 0));
    }

    const total =
      typeof payload?.total === 'number' && payload.total >= 0
        ? payload.total
        : normalized.length;

    return { items: normalized, total };
  } catch (err) {
    console.error('Error fetching Satflow activity listings:', err);
    return empty;
  }
};

/**
 * Optional: merge display fields from GET /v1/item for grid thumbnails (Satflow).
 */
export const enrichSatflowListingItemForDisplay = async (item) => {
  const inscriptionId = item?.inscriptionId || item?.tokenId;
  if (!inscriptionId) return item;

  try {
    const params = new URLSearchParams({
      inscriptionId: String(inscriptionId),
      listing: 'true',
      bid: 'false',
      metadata: 'true',
    });
    const response = await fetch(`/api/satflow-item?${params.toString()}`);
    if (!response.ok) return { ...item, _satflowListing: true };

    const data = await response.json();
    const d = data?.data || data;
    if (!d || typeof d !== 'object') return { ...item, _satflowListing: true };

    const imageUrl =
      d.image_url ||
      d.imageUrl ||
      d.contentURI ||
      d.content_uri ||
      d.preview_url ||
      d.previewUrl ||
      null;
    const contentType =
      d.content_type ||
      d.contentType ||
      item._satflowRaw?.ask?.inscriptionContentType ||
      null;
    const name =
      d.name ||
      d.title ||
      (d.metadata && typeof d.metadata === 'object' && d.metadata.name) ||
      null;
    const inscriptionNumber =
      d.inscription_number != null
        ? d.inscription_number
        : d.inscriptionNumber != null
          ? d.inscriptionNumber
          : item.inscriptionNumber;

    return {
      ...item,
      inscriptionNumber,
      contentURI: imageUrl || item.contentURI,
      contentPreviewURI: imageUrl || item.contentPreviewURI,
      contentType: contentType || item.contentType,
      meta: name ? { ...(item.meta || {}), name } : item.meta,
      _satflowListing: true,
    };
  } catch {
    return { ...item, _satflowListing: true };
  }
};

/**
 * Fetch collection items sorted by price (lowest first)
 * ONLY use when listing items, not for checking confirmations
 * @param {string} collectionSymbol - Collection symbol (Satflow collection slug)
 * @param {boolean} bypassCache - Whether to bypass cache (for auto-trading)
 * @param {Object} [options]
 * @param {number} [options.pageSize] - Satflow page size (default 100)
 * @param {number} [options.page] - Page number (default 1)
 * @param {string} [options.sortDirection] - asc | desc
 * @returns {Promise<Array>} Array of items
 */
export const fetchCollectionItems = async (
  collectionSymbol,
  bypassCache = false,
  options = {}
) => {
  const { items } = await fetchSatflowActivityListings(
    collectionSymbol,
    bypassCache,
    options
  );
  return items;
};

/**
 * Satflow GET /v1/activity/bids — collection bid activity (buy offers).
 * @param {string} collectionSlug - Satflow collection slug (e.g. fine_pepes)
 * @param {Object} [options]
 * @returns {Promise<{ bids: Array, total: number }>}
 */
export const fetchSatflowCollectionBids = async (
  collectionSlug,
  options = {}
) => {
  const empty = { bids: [], total: 0 };
  try {
    const slug = collectionSlug ? String(collectionSlug).trim() : '';
    if (!slug) return empty;

    const pageSize = Math.min(
      250,
      Math.max(1, Number(options.pageSize) || 100)
    );
    const page = Math.max(1, parseInt(String(options.page || '1'), 10) || 1);
    const sortDirection =
      String(options.sortDirection || 'desc').toLowerCase() === 'asc'
        ? 'asc'
        : 'desc';
    const sortBy =
      options.sortBy != null ? String(options.sortBy) : 'unitPrice';
    const timeRange =
      options.timeRange != null ? String(options.timeRange) : '30d';

    const queryParams = new URLSearchParams({
      collectionSlug: slug,
      timeRange,
      sortBy,
      sortDirection,
      page: String(page),
      pageSize: String(pageSize),
    });

    if (options.bypassCache) {
      queryParams.append('_t', Date.now().toString());
    }

    const response = await fetch(
      `/api/satflow-activity-bids?${queryParams.toString()}`
    );
    if (!response.ok) return empty;

    const data = await response.json();
    const payload = data?.data || data;
    const bids = Array.isArray(payload?.bids) ? payload.bids : [];
    const total =
      typeof payload?.total === 'number' && payload.total >= 0
        ? payload.total
        : bids.length;

    return { bids, total };
  } catch (err) {
    console.error('Error fetching Satflow collection bids:', err);
    return empty;
  }
};

/**
 * Get floor price from collection (only use when listing)
 * Uses Satflow collection-stats/floors API: GET .../floors?type=ordinals&slugs=<slug>
 * @param {string} collectionSymbol - Collection symbol (slug), e.g. fine_pepes
 * @param {boolean} bypassCache - Bypass cache (adds cache-bust query param)
 * @returns {Promise<number|null>} Floor price in sats or null
 */
export const getFloorPrice = async (collectionSymbol, bypassCache = false) => {
  try {
    const slug = collectionSymbol ? String(collectionSymbol).trim() : '';
    if (!slug) {
      return null;
    }

    const queryParams = new URLSearchParams({
      type: 'ordinals',
      slugs: slug,
    });
    if (bypassCache) {
      queryParams.append('_t', Date.now().toString());
    }

    const response = await fetch(
      `/api/satflow-collection-floors?${queryParams.toString()}`
    );

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (response.ok && data) {
      // Response: { success: true, data: [ { slug, floor, timestamp, listedCount, ... } ] }
      const list = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];
      const slugLower = slug.toLowerCase();
      const entry =
        list.find((e) => {
          const s = (e.slug || e.collectionId || '').toLowerCase();
          return s && (s === slugLower || s === slug);
        }) || list[0];

      if (entry) {
        const floorVal = entry.floor;
        const floor =
          typeof floorVal === 'number' && floorVal > 0
            ? floorVal
            : typeof floorVal === 'string'
              ? parseInt(floorVal, 10)
              : Number(floorVal);
        if (!Number.isNaN(floor) && floor > 0) {
          return floor;
        }
      }
    }

    // Fallback: derive floor from collection items if floors API is unavailable
    const items = await fetchCollectionItems(slug, bypassCache);
    const listedItems = items
      .filter((item) => item.listed && item.listedPrice)
      .sort((a, b) => (a.listedPrice || 0) - (b.listedPrice || 0));

    if (listedItems.length > 0) {
      return listedItems[0].listedPrice;
    }

    return null;
  } catch (err) {
    console.error('Error getting floor price:', err);
    return null;
  }
};

/**
 * Fetch all tokens owned by a wallet for a specific collection
 * @param {string} ownerAddress - Wallet address
 * @param {string} collectionSymbol - Collection symbol to filter
 * @param {boolean} bypassCache - Whether to bypass cache
 * @returns {Promise<Array>} Array of ordinals
 */
export const fetchWalletOrdinals = async (
  ownerAddress,
  collectionSymbol = null,
  bypassCache = false
) => {
  try {
    if (!ownerAddress) {
      return [];
    }

    const queryParams = new URLSearchParams({
      address: ownerAddress,
      itemType: 'inscription',
      limit: '100',
    });

    if (collectionSymbol) {
      // Satflow uses collection slug under "collection" query param
      queryParams.append('collection', collectionSymbol);
    }

    if (bypassCache) {
      queryParams.append('_t', Date.now().toString());
    }

    const response = await fetch(
      `/api/satflow-wallet-contents?${queryParams.toString()}`
    );
    if (response.ok) {
      const data = await response.json();
      const payload = data?.data || data;
      const ordinals = payload?.results?.ordinals || [];

      // Normalize Satflow wallet contents into the shape expected by trading logic
      return ordinals.map((entry) => {
        const token = entry.token || {};
        const collection = entry.collection || {};
        const listing = entry.listing || null;

        const inscriptionId =
          token.inscription_id ||
          token.id ||
          (token.inscriptionNumber
            ? `${token.txid || token.genesisTransaction || ''}i${token.inscriptionNumber}`
            : null);

        const listedPrice =
          listing && typeof listing.price === 'number' ? listing.price : null;

        return {
          // Identification
          inscriptionId,
          id: inscriptionId,
          tokenId: inscriptionId,
          inscriptionNumber:
            token.inscription_number ?? token.inscriptionNumber,
          // Media / content
          contentURI: token.image_url || token.contentURI || null,
          contentPreviewURI: token.image_url || token.contentPreviewURI || null,
          contentType: token.content_type || token.contentType || null,
          // Ownership and collection
          owner: entry.owner || ownerAddress,
          collectionSymbol:
            collection.slug || collection.id || collection.collectionSlug,
          // Listing state
          listed: !!listedPrice,
          listedPrice,
          // Satflow raw data for debugging/extensibility
          _satflowRaw: entry,
        };
      });
    }
    return [];
  } catch (err) {
    console.error('Error fetching wallet ordinals:', err);
    return [];
  }
};

/**
 * Check if a purchase is confirmed by checking token ownership
 * This is more reliable than checking mempool status
 * @param {string} tokenId - Token inscription ID
 * @param {string} expectedOwner - Expected owner address
 * @returns {Promise<boolean>} True if token is owned by expectedOwner
 */
export const checkPurchaseConfirmed = async (tokenId, expectedOwner) => {
  try {
    console.log(`[checkPurchaseConfirmed] Checking tokenId: ${tokenId}`);
    console.log(`[checkPurchaseConfirmed] Expected owner: ${expectedOwner}`);

    const token = await fetchTokenById(tokenId);
    if (!token) {
      console.log(`[checkPurchaseConfirmed] Token not found`);
      return false;
    }

    console.log(`[checkPurchaseConfirmed] Token owner: ${token.owner}`);
    console.log(
      `[checkPurchaseConfirmed] Match: ${token.owner === expectedOwner}`
    );

    // Check if owner matches expected owner
    return token.owner === expectedOwner;
  } catch (err) {
    console.error('[checkPurchaseConfirmed] Error:', err);
    return false;
  }
};

/**
 * Check if an item has a pending transaction (mempool tx)
 * Items without mempoolTxId are ready to be listed/traded
 * @param {Object} item - The item/token object
 * @returns {boolean} True if item has a pending transaction
 */
export const hasPendingTransaction = (item) => {
  return !!(item.mempoolTxId && item.mempoolTxId !== '');
};

/**
 * List an ordinal for sale using proxy wallet (Satflow: intent/sell → sign → /list).
 * @param {Object} ordinal - The ordinal to list
 * @param {number} priceInSats - Price in satoshis
 * @param {Object} wallet - Proxy wallet object
 * @param {string} network - Network type
 * @returns {Promise<Object>} Result with success, txid, error
 */
export const listOrdinalWithProxyWallet = async (
  ordinal,
  priceInSats,
  wallet,
  network = 'mainnet'
) => {
  try {
    const tokenId = getTokenId(ordinal);
    if (!tokenId) {
      throw new Error('Could not determine token ID from ordinal');
    }

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

    const priceInSatsInt = Math.round(parseFloat(priceInSats) || 0);

    // Satflow create listing intent: POST /intent/sell (proxied as /api/satflow-intent-sell)
    const intentPayload = {
      price: priceInSatsInt,
      inscriptionId: tokenId,
      sellerOrdAddress: address,
      sellerReceiveAddress: address,
      tapInternalKey:
        publicKey && publicKey.length >= 64 ? publicKey : undefined,
    };

    const fetchResponse = await fetch('/api/satflow-intent-sell', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(intentPayload),
    });

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      let errorMessage = `Satflow intent/sell error: ${fetchResponse.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && typeof errorJson.error === 'string') {
          errorMessage = errorJson.error;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const fetchData = await fetchResponse.json();
    const seller = fetchData?.data?.seller;
    if (!seller) {
      throw new Error('Satflow intent/sell did not return data.seller');
    }

    // Response shape: data.seller.unsignedListingPSBTBase64, data.seller.secureListingPSBTs[]
    const unsignedListingBase64 =
      seller.unsignedListingPSBTBase64 || seller.unsignedListingPSBTHex;
    if (!unsignedListingBase64) {
      throw new Error('Satflow intent/sell missing unsignedListingPSBTBase64');
    }

    // If API returns hex, convert to base64 for signing (signPsbtWithProxyWallet expects base64)
    let unsignedListingPsbtB64 = unsignedListingBase64;
    if (
      unsignedListingBase64.length > 0 &&
      !unsignedListingBase64.includes(' ')
    ) {
      const isHex = /^[0-9a-fA-F]+$/.test(unsignedListingBase64);
      if (isHex) {
        const bytes = new Uint8Array(
          unsignedListingBase64.match(/.{1,2}/g).map((b) => parseInt(b, 16))
        );
        unsignedListingPsbtB64 = btoa(
          Array.from(bytes)
            .map((byte) => String.fromCharCode(byte))
            .join('')
        );
      }
    }

    // Step 2: Sign main listing PSBT (insecure/snipable listing)
    const signedListing = await signPsbtWithProxyWallet(
      unsignedListingPsbtB64.trim(),
      wallet.privateKey,
      network,
      {
        finalize: false,
        extractTx: false,
        expectedPublicKey: publicKey,
        walletAddress: address,
      }
    );

    if (!signedListing || !signedListing.base64) {
      throw new Error('Failed to sign listing PSBT');
    }

    // Sign each secure listing PSBT (non-snipable)
    const secureListingPsbtList = seller.secureListingPSBTs || [];
    const signedSecureListingPSBTs = [];
    for (let i = 0; i < secureListingPsbtList.length; i++) {
      const secureItem = secureListingPsbtList[i];
      const secureB64 = secureItem.base64 || secureItem.hex;
      if (!secureB64) continue;
      let secureB64ForSign = secureB64;
      if (/^[0-9a-fA-F]+$/.test(secureB64)) {
        const bytes = new Uint8Array(
          secureB64.match(/.{1,2}/g).map((b) => parseInt(b, 16))
        );
        secureB64ForSign = btoa(
          Array.from(bytes)
            .map((byte) => String.fromCharCode(byte))
            .join('')
        );
      }
      const signedSecure = await signPsbtWithProxyWallet(
        secureB64ForSign.trim(),
        wallet.privateKey,
        network,
        {
          finalize: false,
          extractTx: false,
          expectedPublicKey: publicKey,
          walletAddress: address,
        }
      );
      if (signedSecure && signedSecure.base64) {
        signedSecureListingPSBTs.push(signedSecure.base64);
      }
    }

    // Step 3: Submit to Satflow POST /list (proxied as /api/satflow-list)
    const listingEntry = {
      price: priceInSatsInt,
      inscriptionId: tokenId,
      sellerOrdAddress: address,
      sellerReceiveAddress: address,
      tapInternalKey:
        publicKey && publicKey.length >= 64 ? publicKey : undefined,
    };

    const listPayload = {
      listings: [listingEntry],
      signedListingPSBT: signedListing.base64,
      signedSecureListingPSBTs:
        signedSecureListingPSBTs.length > 0 ? signedSecureListingPSBTs : [],
      unsignedListingPSBT: unsignedListingPsbtB64,
    };

    const listResponse = await fetch('/api/satflow-list', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(listPayload),
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      let errorMessage = `Satflow /list error: ${listResponse.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && typeof errorJson.error === 'string') {
          errorMessage = errorJson.error;
        } else if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const listData = await listResponse.json();
    const success = listData?.success === true;
    const txid = listData?.data?.txid;

    return {
      success,
      listed: success ? 1 : 0,
      txid,
      failed: success ? [] : [tokenId],
      data: listData,
    };
  } catch (err) {
    console.error('Error listing ordinal:', err);
    return {
      success: false,
      error: err.message || 'Failed to list ordinal',
    };
  }
};

/** Error message returned by Satflow when buyer needs to create dummy UTXOs first */
const SATFLOW_DUMMY_UTXO_ERROR = 'Additional dummy UTXOs required to purchase';

/** localStorage key for pending secure-purchase preps (survives refresh/restart so we don't create duplicate preps) */
const PENDING_PREPS_STORAGE_KEY = 'fine-trading-pending-secure-preps';

/** Max time to wait for prep tx confirmation (60 min); Bitcoin can take longer in congestion. */
export const PREP_CONFIRM_TIMEOUT_MS = 60 * 60 * 1000;

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

/** Get pending prep for (inscriptionId, buyerAddress) if any */
export function getPendingPrep(inscriptionId, buyerAddress) {
  const key = `${(inscriptionId || '').toLowerCase()}|${(buyerAddress || '').toLowerCase()}`;
  return (
    getPendingPrepsFromStorage().find(
      (p) =>
        `${(p.inscriptionId || '').toLowerCase()}|${(p.buyerAddress || '').toLowerCase()}` ===
        key
    ) || null
  );
}

/** Add or replace pending prep (so we don't create another prep after restart) */
export function addPendingPrep(entry) {
  const preps = getPendingPrepsFromStorage().filter(
    (p) =>
      !(
        p.inscriptionId === entry.inscriptionId &&
        p.buyerAddress === entry.buyerAddress
      )
  );
  preps.push({
    inscriptionId: entry.inscriptionId,
    buyerAddress: entry.buyerAddress,
    prepTxid: entry.prepTxid,
    signedPaymentPrepPSBT: entry.signedPaymentPrepPSBT,
    intentPayload: entry.intentPayload,
    timestamp: entry.timestamp ?? Date.now(),
  });
  savePendingPrepsToStorage(preps);
}

/** Remove pending prep after successful purchase or on purpose */
export function removePendingPrep(inscriptionId, buyerAddress) {
  const preps = getPendingPrepsFromStorage().filter(
    (p) =>
      !(p.inscriptionId === inscriptionId && p.buyerAddress === buyerAddress)
  );
  savePendingPrepsToStorage(preps);
}

/** Wait until all given prep txids are confirmed or timeout. Logs periodically. */
export async function waitForPrepsToConfirm(prepTxids, options = {}) {
  const {
    timeoutMs = PREP_CONFIRM_TIMEOUT_MS,
    addConsoleLog = null,
    isStopRequested = null,
    pollIntervalMs = 5000,
  } = options;
  if (!prepTxids || prepTxids.length === 0) return;
  const set = new Set(prepTxids.filter(Boolean));
  const start = Date.now();
  let lastLog = 0;
  while (set.size > 0 && Date.now() - start < timeoutMs) {
    if (typeof isStopRequested === 'function' && isStopRequested()) return;
    for (const txid of set) {
      const confirmed = await checkTransactionConfirmed(
        txid,
        options.network || 'mainnet'
      );
      if (confirmed) set.delete(txid);
    }
    if (
      set.size > 0 &&
      typeof addConsoleLog === 'function' &&
      Date.now() - lastLog >= 30000
    ) {
      const waited = Math.round((Date.now() - start) / 1000);
      addConsoleLog(
        `  Waiting for ${set.size} prep tx(s) to confirm... (${waited}s elapsed, timeout ${timeoutMs / 1000}s)`
      );
      lastLog = Date.now();
    }
    if (set.size > 0) await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  if (set.size > 0 && typeof addConsoleLog === 'function') {
    addConsoleLog(
      `  ⚠ ${set.size} prep tx(s) did not confirm within ${timeoutMs / 1000}s. You can wait longer and complete purchases later.`
    );
  }
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

/** Helper: hex string to base64 for PSBT signing */
function hexToBase64(hexStr) {
  const bytes = new Uint8Array(
    hexStr.match(/.{1,2}/g).map((b) => parseInt(b, 16))
  );
  return btoa(
    Array.from(bytes)
      .map((byte) => String.fromCharCode(byte))
      .join('')
  );
}

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

/**
 * Buy an ordinal using proxy wallet (Satflow secure-purchase).
 * Signed payment prep PSBT is passed to the API (not broadcast by us); API returns purchase PSBTs.
 * Supports batched flow: pass skipWaitForPrep: true to only prepare, then caller calls completeSecurePurchase.
 */
export const buyOrdinalWithProxyWallet = async (
  ordinal,
  wallet,
  network = 'mainnet',
  connectedWallet = 'unisat',
  addConsoleLog = null,
  isStopRequested = null,
  opts = {}
) => {
  const skipWaitForPrep = opts.skipWaitForPrep === true;
  try {
    if (typeof addConsoleLog === 'function') {
      addConsoleLog(`Using connected wallet provider: ${connectedWallet}`);
    }
    if (typeof isStopRequested === 'function' && isStopRequested()) {
      return { success: false, error: 'Trading stopped by user' };
    }
    const tokenId = getTokenId(ordinal);
    if (!tokenId)
      return {
        success: false,
        error: 'Could not determine token ID from selected ordinal',
      };
    if (!ordinal.listed || !ordinal.listedPrice)
      return { success: false, error: 'Waiting for item listing to propagate' };

    const prepareResult = await prepareSecurePurchase(
      ordinal,
      wallet,
      network,
      addConsoleLog,
      isStopRequested
    );
    if (!prepareResult.success)
      return { success: false, error: prepareResult.error };

    if (prepareResult.noPrepNeeded && prepareResult.intentData) {
      return await completeSecurePurchase(
        ordinal,
        wallet,
        network,
        addConsoleLog,
        isStopRequested,
        {
          intentData: prepareResult.intentData,
        }
      );
    }

    if (prepareResult.prepTxid && skipWaitForPrep) {
      return {
        success: true,
        prepTxid: prepareResult.prepTxid,
        waitThenComplete: true,
        message:
          'Prep broadcast; wait for confirmation then call completeSecurePurchase',
      };
    }

    if (prepareResult.prepTxid) {
      if (typeof addConsoleLog === 'function') {
        addConsoleLog('  Waiting for prep tx to confirm (up to 60 min)...');
      }
      await waitForPrepsToConfirm([prepareResult.prepTxid], {
        timeoutMs: PREP_CONFIRM_TIMEOUT_MS,
        addConsoleLog,
        isStopRequested,
        network,
      });
      if (typeof isStopRequested === 'function' && isStopRequested()) {
        return { success: false, error: 'Trading stopped by user' };
      }
      if (typeof addConsoleLog === 'function') {
        addConsoleLog('  Waiting for backend to index prep tx (15s)...');
      }
      await new Promise((r) => setTimeout(r, 15000));
    }

    const completeOpts = {};
    if (prepareResult.signedPaymentPrepPSBT) {
      completeOpts.signedPaymentPrepPSBT = prepareResult.signedPaymentPrepPSBT;
    }

    return await completeSecurePurchase(
      ordinal,
      wallet,
      network,
      addConsoleLog,
      isStopRequested,
      completeOpts
    );
  } catch (err) {
    console.error('Error buying ordinal:', err);
    return { success: false, error: err.message || 'Failed to buy ordinal' };
  }
};

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

    const getFeeRateSatVb = async () => {
      const MIN_FEE_TX_RATE_SAT_VB = 5;
      try {
        const recoUrl = getMempoolRecommendedFeesUrl(network);
        if (recoUrl) {
          const data = await safeFetchJson(recoUrl);
          const v =
            data?.fastestFee ??
            data?.halfHourFee ??
            data?.hourFee ??
            data?.economyFee;
          const n = Number(v);
          if (Number.isFinite(n) && n > 0) {
            return Math.max(MIN_FEE_TX_RATE_SAT_VB, Math.ceil(n));
          }
        }
      } catch {
        // ignore and fall back
      }
      try {
        const est = await safeFetchJson(getMempoolFeeEstimatesUrl(network));
        const keys = ['1', '2', '3', '6', '10', '25'];
        for (const k of keys) {
          const n = Number(est?.[k]);
          if (Number.isFinite(n) && n > 0) {
            return Math.max(MIN_FEE_TX_RATE_SAT_VB, Math.ceil(n));
          }
        }
        const any = Object.values(est || {}).find(
          (v) => Number.isFinite(Number(v)) && Number(v) > 0
        );
        if (any != null) {
          return Math.max(MIN_FEE_TX_RATE_SAT_VB, Math.ceil(Number(any)));
        }
      } catch {
        // ignore
      }
      return MIN_FEE_TX_RATE_SAT_VB;
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

/**
 * Check if a transaction is confirmed (fallback method using mempool)
 * @param {string} txId - Transaction ID
 * @param {string} network - Network type
 * @returns {Promise<boolean>} True if confirmed
 */
export const checkTransactionConfirmed = async (txId, network = 'mainnet') => {
  try {
    const response = await fetch(
      getMempoolTxStatusUrl(txId, network || 'mainnet')
    );
    if (response.ok) {
      const data = await response.json();
      return data.confirmed || false;
    }
    return false;
  } catch (err) {
    console.error('Error checking transaction status:', err);
    return false;
  }
};

/**
 * Verify that a transaction has been accepted into the mempool
 * @param {string} txid - Transaction ID to verify
 * @param {string} network - Network type
 * @param {number} maxRetries - Maximum retry attempts (default: 10)
 * @param {number} retryDelay - Delay between retries in ms (default: 2000)
 * @returns {Promise<boolean>} True if tx is in mempool or confirmed
 */
export const verifyTxInMempool = async (
  txid,
  network = 'mainnet',
  maxRetries = 10,
  retryDelay = 2000
) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(getMempoolTxUrl(txid, network));
      if (response.ok) {
        // Transaction is in mempool or confirmed
        return true;
      }
      if (response.status === 404) {
        // Not yet in mempool, wait and retry
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, retryDelay));
          continue;
        }
      }
      // Other errors (500, etc.) - retry
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, retryDelay));
      }
    } catch (err) {
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, retryDelay));
      }
    }
  }
  return false; // Failed to verify after all retries
};

/**
 * Fetch wallet balance (confirmed)
 * @param {string} address - Wallet address
 * @param {string} network - Network type
 * @returns {Promise<number>} Balance in satoshis
 */
export const fetchWalletBalance = async (address, network = 'mainnet') => {
  try {
    const response = await fetch(
      getMempoolAddressUrl(address, network || 'mainnet')
    );
    if (response.ok) {
      const data = await response.json();
      const confirmedBalance = data.chain_stats?.funded_txo_sum || 0;
      const spentBalance = data.chain_stats?.spent_txo_sum || 0;
      return confirmedBalance - spentBalance;
    }
    return 0;
  } catch (err) {
    console.error('Error fetching wallet balance:', err);
    return 0;
  }
};

/**
 * Delist a Satflow listing held by a proxy wallet.
 *
 * Not implemented. The previous version called Magic Eden's delist API, which
 * the app's proxy never allowed (and Magic Eden has since shut down its
 * ordinals marketplace), so it always failed. It now reports that failure
 * directly; auto-trade only acts on successful delists, so behavior is
 * unchanged. ord.net listings are delisted by
 * ordNetTradingUtils.delistOrdinalWithProxyWallet.
 *
 * To implement: Satflow's v1 API exposes POST /cancel
 * (docs/reference/satflow-openapi.json).
 *
 * @returns {Promise<{ success: false, error: string }>}
 */
export const delistOrdinalWithProxyWallet = async () => ({
  success: false,
  error: 'Delisting Satflow listings is not supported yet',
});
