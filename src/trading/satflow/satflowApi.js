/**
 * Satflow marketplace reads: tokens, collection listings and activity, bids,
 * floor price, wallet contents and purchase confirmation.
 */

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
