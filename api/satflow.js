// Consolidated Satflow serverless function router.
// This replaces multiple /api/satflow-* endpoints by routing based on ?op= query.
// Existing frontend calls like /api/satflow-item, /api/satflow-collection-floors, etc.
// are rewritten in vercel.json to /api/satflow?op=item, /api/satflow?op=collection-floors, ...

const SATFLOW_API_KEY =
  process.env.SATFLOW_API_KEY || '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q';

const TOP_COLLECTIONS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let topCollectionsCache = {
  key: null,
  data: null,
  expiresAt: 0,
};

function getTopCollectionsCacheKey(collectionIds) {
  return collectionIds.slice().sort().join(',');
}

function getCachedTopCollections(collectionIds) {
  const key = getTopCollectionsCacheKey(collectionIds);
  if (topCollectionsCache.key === key && topCollectionsCache.expiresAt > Date.now()) {
    return topCollectionsCache.data;
  }
  return null;
}

function setCachedTopCollections(collectionIds, data) {
  topCollectionsCache = {
    key: getTopCollectionsCacheKey(collectionIds),
    data,
    expiresAt: Date.now() + TOP_COLLECTIONS_CACHE_TTL_MS,
  };
}

function sendCors(res, methods) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, x-wallet-address, x-wallet-provider'
  );
}

export default async function handler(req, res) {
  // Generic CORS preflight
  if (req.method === 'OPTIONS') {
    sendCors(res, 'GET, POST, PUT, DELETE, OPTIONS');
    res.status(200).end();
    return;
  }

  const op = String(req.query.op || '').toLowerCase();

  try {
    switch (op) {
      case 'top-collections':
        return await handleTopCollections(req, res);
      case 'search':
        return await handleCollectionsSearch(req, res);
      case 'collection-floors':
        return await handleCollectionFloors(req, res);
      case 'collection-stats':
        return await handleCollectionStats(req, res);
      case 'wallet-contents':
        return await handleWalletContents(req, res);
      case 'activity-listings':
        return await handleActivityListings(req, res);
      case 'activity-bids':
        return await handleActivityBids(req, res);
      case 'create-psbt-non-custodial-bid-deposit':
        return await handleCreatePsbtNonCustodialBidDeposit(req, res);
      case 'bid-place':
        return await handleBidPlace(req, res);
      case 'item':
        return await handleItemDetails(req, res);
      case 'setup-utxos':
        return await handleSetupUtxos(req, res);
      case 'intent-secure-purchase':
        return await handleIntentSecurePurchase(req, res);
      case 'intent-satflow-purchase':
        return await handleIntentSatflowPurchase(req, res);
      case 'list':
        return await handleList(req, res);
      case 'intent-sell':
        return await handleIntentSell(req, res);
      case 'purchase-broadcast':
        return await handlePurchaseBroadcast(req, res);
      default:
        res.status(400).json({ error: 'Invalid or missing op parameter' });
    }
  } catch (error) {
    console.error('Satflow router error:', error);
    sendCors(res, 'GET, POST, PUT, DELETE, OPTIONS');
    res.status(500).json({
      error: 'Satflow router unhandled error',
      message: error.message,
    });
  }
}

// --- /api/satflow-top-collections -> op=top-collections --------------------

const DEFAULT_COLLECTION_IDS = [
  'fine_pepes',
  'nodemonkes',
  'runestone',
  'bitcoin-puppets',
  'omb',
  'motocats',
  'taproot-wizards',
  'bitcoin-frogs',
  'cents',
  'bitcoin-weirdos',
  'modal',
];

function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function extractCollectionsFromBatch(text) {
  const parsed = tryParseJson(text);
  if (Array.isArray(parsed) && parsed[0]?.result?.data?.json?.collections) {
    return parsed[0].result.data.json.collections;
  }
  if (parsed?.result?.data?.json?.collections) {
    return parsed.result.data.json.collections;
  }
  if (parsed?.collections && Array.isArray(parsed.collections)) {
    return parsed.collections;
  }

  const lines = text.trim().split('\n').filter(Boolean);
  for (const line of lines) {
    const obj = tryParseJson(line);
    if (!obj) continue;
    const json = obj.json ?? obj.result?.data?.json ?? obj;
    if (!json) continue;
    if (Array.isArray(json) && json[2]?.[0]?.[0]?.collections) {
      return json[2][0][0].collections;
    }
    if (Array.isArray(json) && json[2]?.[0]?.collections) {
      return json[2][0].collections;
    }
    if (json.collections && Array.isArray(json.collections)) {
      return json.collections;
    }
  }
  return [];
}

function normalizeCollection(c) {
  return {
    collectionSymbol: c.id ?? c.collectionId ?? c.symbol,
    collectionId: c.id ?? c.collectionId ?? c.symbol,
    name: c.name ?? c.id,
    image: c.image_url ?? c.image,
    totalSupply: c.total_items ?? c.totalSupply ?? 0,
    totalVol: c.totalVol ?? c.totalVolume ?? null,
    vol: c.vol ?? null,
    fp: c.floorPrice ?? c.fp ?? null,
    marketCap: c.marketCap ?? null,
    txns: c.txns ?? null,
    listedCount: c.listedCount ?? null,
    ownerCount: c.ownerCount ?? null,
    currency: 'BTC',
  };
}

async function handleTopCollections(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, OPTIONS');

  const idsParam = req.query.ids || req.query.collectionIds || '';
  const collectionIds = idsParam
    ? String(idsParam)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : DEFAULT_COLLECTION_IDS;

  // Check 10-minute cache keyed by the set of collection IDs
  const cached = getCachedTopCollections(collectionIds);
  if (cached) {
    res.status(200).json({ collections: cached, cached: true });
    return;
  }

  // Fan-out: query Satflow collection-stats endpoint once per collection
  const results = await Promise.allSettled(
    collectionIds.map(async (id) => {
      const url = `https://api.satflow.com/v1/collection-stats?collectionId=${encodeURIComponent(
        String(id)
      )}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-api-key': SATFLOW_API_KEY,
        },
      });

      const text = await response.text();

      if (!response.ok) {
        throw new Error(
          `collection-stats failed for ${id} (status ${response.status}): ${text.slice(
            0,
            200
          )}`
        );
      }

      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON from collection-stats for ${id}`);
      }

      const data = body?.data || {};
      const meta = data.metadata || {};

      return {
        collectionId: meta.id || id,
        collectionSymbol: meta.id || id,
        name: meta.name || meta.id || id,
        image: meta.image_url || null,
        totalSupply:
          meta.total_items != null ? Number(meta.total_items) : null,
        // Use floor and volumes from stats; UI will treat these as generic metrics
        fp: data.floor != null ? Number(data.floor) : null,
        listedCount:
          data.listedCount != null ? Number(data.listedCount) : null,
        vol: data.volume1d != null ? Number(data.volume1d) : null,
        totalVol:
          data.volume30d != null
            ? Number(data.volume30d)
            : data.volume7d != null
              ? Number(data.volume7d)
              : null,
        // Extra raw metrics (optional; UI may ignore)
        vol1d: data.volume1d ?? null,
        vol7d: data.volume7d ?? null,
        vol30d: data.volume30d ?? null,
        vol1dChange: data.volume1dChange ?? null,
        vol1dChangePercent: data.volume1dChangePercent ?? null,
        vol7dChange: data.volume7dChange ?? null,
        vol7dChangePercent: data.volume7dChangePercent ?? null,
        vol30dChange: data.volume30dChange ?? null,
        vol30dChangePercent: data.volume30dChangePercent ?? null,
        currency: 'BTC',
      };
    })
  );

  const collections = results
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value);

  if (collections.length === 0) {
    const firstError = results.find((r) => r.status === 'rejected');
    res.status(502).json({
      error: 'Satflow top collections failed for all collections',
      details:
        firstError && firstError.status === 'rejected'
          ? String(firstError.reason && firstError.reason.message
              ? firstError.reason.message
              : firstError.reason)
          : undefined,
    });
    return;
  }

  // Store in cache and return
  setCachedTopCollections(collectionIds, collections);

  res.status(200).json({ collections });
}

// --- /api/satflow-search -> op=search --------------------------------------

async function handleCollectionsSearch(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, OPTIONS');

  const searchQuery = req.query.q || req.query.searchQuery || '';
  const input = encodeURIComponent(
    JSON.stringify({ '0': { json: { searchQuery: String(searchQuery).trim() || ' ' } } })
  );

  const url = `https://backend.satflow.com/trpc/collections.search?batch=1&input=${input}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-trpc-source': 'nextjs-react',
    },
  });

  const text = await response.text();

  if (!response.ok) {
    res.status(response.status).json({
      error: 'Satflow search failed',
      details: text.slice(0, 200),
    });
    return;
  }

  let ordinals = [];
  const parsed = tryParseJson(text);

  if (parsed) {
    if (Array.isArray(parsed) && parsed[0]?.result?.data?.json?.results?.ordinals) {
      ordinals = parsed[0].result.data.json.results.ordinals;
    } else if (parsed?.result?.data?.json?.results?.ordinals) {
      ordinals = parsed.result.data.json.results.ordinals;
    } else {
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const obj of arr) {
        const json = obj.json ?? obj.result?.data?.json ?? obj;
        if (Array.isArray(json) && json[2]?.[0]?.[0]?.results?.ordinals) {
          ordinals = json[2][0][0].results.ordinals;
          break;
        }
        if (json?.results?.ordinals) {
          ordinals = json.results.ordinals;
          break;
        }
      }
    }
  }

  if (ordinals.length === 0 && text.includes('"ordinals"')) {
    const lines = text.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const obj = tryParseJson(line);
      const json = obj?.json ?? obj;
      if (Array.isArray(json) && json[2]?.[0]?.[0]?.results?.ordinals) {
        ordinals = json[2][0][0].results.ordinals;
        break;
      }
      if (json?.results?.ordinals) {
        ordinals = json.results.ordinals;
        break;
      }
    }
  }

  const collections = ordinals.map((c) => {
    const mem = c.memflowData || {};
    const meta = c.metadata || c;
    return {
      collectionSymbol: c.id,
      collectionId: c.id,
      name: c.name || meta.name || c.id,
      image: c.image_url || meta.image_url,
      totalSupply:
        c.item_count != null ? Number(c.item_count) : 0,
      totalVol:
        mem.totalVolume != null ? Number(mem.totalVolume) : null,
      vol: null,
      fp: mem.floorPrice != null ? Number(mem.floorPrice) : null,
      marketCap: null,
      txns: null,
      listedCount: null,
      ownerCount: null,
      currency: 'BTC',
    };
  });

  res.status(200).json({ collections, collectionsV2: collections });
}

// --- /api/satflow-collection-floors -> op=collection-floors ----------------

async function handleCollectionFloors(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, OPTIONS');

  const type = req.query.type || 'ordinals';
  const slugs = req.query.slugs || req.query.slug || '';
  const slugParam =
    typeof slugs === 'string'
      ? slugs
      : Array.isArray(slugs)
        ? slugs.join(',')
        : '';

  if (!slugParam.trim()) {
    res.status(400).json({ error: 'slugs query parameter required' });
    return;
  }

  const query = new URLSearchParams({ type, slugs: slugParam.trim() });
  const url = `https://api.satflow.com/v1/collection-stats/floors?${query.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-api-key': SATFLOW_API_KEY,
    },
  });

  const text = await response.text();

  if (!response.ok) {
    res.status(response.status).json({
      error: 'Satflow collection floors failed',
      details: text.slice(0, 300),
    });
    return;
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { success: false, data: [] };
  }

  res.status(200).json(body);
}

// --- /api/satflow-collection-stats -> op=collection-stats -------------------

async function handleCollectionStats(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { collectionId = 'nodemonkes' } = req.query;

  const url = `https://api.satflow.com/v1/collection-stats?collectionId=${encodeURIComponent(
    String(collectionId)
  )}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-api-key': SATFLOW_API_KEY,
    },
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  res.status(response.status).json(body);
}

// --- /api/satflow-wallet-contents -> op=wallet-contents ---------------------

async function handleWalletContents(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, OPTIONS');

  const baseUrl = 'https://api.satflow.com/v1/address/wallet-contents';

  const query = new URLSearchParams();
  Object.entries(req.query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });

  const url = query.toString() ? `${baseUrl}?${query.toString()}` : baseUrl;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-api-key': SATFLOW_API_KEY,
    },
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  res.status(response.status).json(body);
}

// --- /api/satflow-activity-listings -> op=activity-listings -----------------

async function handleActivityListings(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, OPTIONS');

  const baseUrl = 'https://api.satflow.com/v1/activity/listings';

  const query = new URLSearchParams();
  Object.entries(req.query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });

  const url = query.toString() ? `${baseUrl}?${query.toString()}` : baseUrl;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-api-key': SATFLOW_API_KEY,
    },
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  res.status(response.status).json(body);
}

// --- /api/satflow-activity-bids -> op=activity-bids -------------------------

async function handleActivityBids(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, OPTIONS');

  const baseUrl = 'https://api.satflow.com/v1/activity/bids';

  const query = new URLSearchParams();
  Object.entries(req.query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });

  const url = query.toString() ? `${baseUrl}?${query.toString()}` : baseUrl;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-api-key': SATFLOW_API_KEY,
    },
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  res.status(response.status).json(body);
}

// --- /api/satflow-create-psbt-non-custodial-bid-deposit -> op=create-psbt-non-custodial-bid-deposit

async function handleCreatePsbtNonCustodialBidDeposit(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, POST, PUT, DELETE, OPTIONS');

  const body =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  const walletAddress =
    req.headers['x-wallet-address'] ||
    body.walletAddress ||
    body.senderAddress ||
    body['0']?.json?.senderAddress ||
    body.json?.senderAddress;

  if (!walletAddress) {
    res.status(400).json({
      error:
        'x-wallet-address header or senderAddress (or legacy body[0].json.senderAddress) is required',
    });
    return;
  }

  const backendUrl =
    'https://backend.satflow.com/trpc/createPsbt.nonCustodialBidDeposit';

  // tRPC HTTP expects the procedure input under `json` (see notes/make_bid.txt). A bare flat object
  // is parsed as undefined input and fails validation ("expected object, received undefined").
  // Legacy batch: { "0": { "json": ... } }; single call: { "json": { ... } }.
  let forwardSerialized;
  if (body['0'] !== undefined) {
    forwardSerialized = JSON.stringify(body);
  } else {
    const inner =
      body.json && typeof body.json === 'object'
        ? body.json
        : body.senderAddress != null || body.senderPublicKey != null
          ? {
              senderAddress: body.senderAddress,
              senderPublicKey: body.senderPublicKey,
              receiveAddress: body.receiveAddress,
              amount: body.amount,
              allowedPaymentOutpoints: Array.isArray(body.allowedPaymentOutpoints)
                ? body.allowedPaymentOutpoints
                : [],
            }
          : null;

    if (!inner || typeof inner !== 'object') {
      res.status(400).json({
        error:
          'Body must include { json: { senderAddress, ... } } or flat senderAddress/senderPublicKey fields, or legacy { "0": { json } }',
      });
      return;
    }

    forwardSerialized = JSON.stringify({ json: inner });
  }

  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-wallet-address': String(walletAddress),
      'x-wallet-provider': body.walletProvider || body.wallet_provider || 'proxy',
      'x-trpc-source': 'nextjs-react',
    },
    body: forwardSerialized,
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  res.status(response.status).json(data);
}

// --- /api/satflow-bid-place -> op=bid-place ---------------------------------

async function handleBidPlace(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, POST, PUT, DELETE, OPTIONS');

  const baseUrl = 'https://api.satflow.com/v1/bid/place';

  const bodyString =
    typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body ?? {});

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': SATFLOW_API_KEY,
    },
    body: bodyString,
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  res.status(response.status).json(body);
}

// --- /api/satflow-item -> op=item -------------------------------------------

async function handleItemDetails(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, OPTIONS');

  const baseUrl = 'https://api.satflow.com/v1/item';

  const query = new URLSearchParams();
  Object.entries(req.query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });

  const url = query.toString() ? `${baseUrl}?${query.toString()}` : baseUrl;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-api-key': SATFLOW_API_KEY,
    },
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  res.status(response.status).json(body);
}

// --- /api/satflow-setup-utxos -> op=setup-utxos -----------------------------

async function handleSetupUtxos(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, POST, PUT, DELETE, OPTIONS');

  const body =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

  const walletAddress =
    req.headers['x-wallet-address'] ||
    body.walletAddress ||
    body.wallet_address;

  if (!walletAddress) {
    res.status(400).json({
      error: 'x-wallet-address header or body.walletAddress required',
    });
    return;
  }

  const backendUrl = 'https://backend.satflow.com/trpc/createPsbt.setupUtxos';

  const tRpcBody =
    body['0'] !== undefined
      ? body
      : { '0': { json: typeof body.json === 'object' ? body.json : {} } };

  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-wallet-address': String(walletAddress),
      'x-wallet-provider': body.walletProvider || body.wallet_provider || 'proxy',
      'x-trpc-source': 'nextjs-react',
    },
    body: JSON.stringify(tRpcBody),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  res.status(response.status).json(data);
}

// --- /api/satflow-intent-secure-purchase -> op=intent-secure-purchase -------

async function handleIntentSecurePurchase(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, POST, PUT, DELETE, OPTIONS');

  const baseUrl = 'https://api.satflow.com/v1/intent/secure-purchase';

  const bodyString =
    typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body ?? {});

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': SATFLOW_API_KEY,
    },
    body: bodyString,
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  res.status(response.status).json(body);
}

// --- /api/satflow-intent-satflow-purchase -> op=intent-satflow-purchase -----

async function handleIntentSatflowPurchase(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, POST, PUT, DELETE, OPTIONS');

  const baseUrl = 'https://api.satflow.com/v1/intent/satflow-purchase';

  const bodyString =
    typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body ?? {});

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': SATFLOW_API_KEY,
    },
    body: bodyString,
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  res.status(response.status).json(body);
}

// --- /api/satflow-list -> op=list -------------------------------------------

async function handleList(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, POST, PUT, DELETE, OPTIONS');

  const baseUrl = 'https://api.satflow.com/v1/list';

  const bodyString =
    typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body ?? {});

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': SATFLOW_API_KEY,
    },
    body: bodyString,
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  res.status(response.status).json(body);
}

// --- /api/satflow-intent-sell -> op=intent-sell -----------------------------

async function handleIntentSell(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, POST, PUT, DELETE, OPTIONS');

  const baseUrl = 'https://api.satflow.com/v1/intent/sell';

  const bodyString =
    typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body ?? {});

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': SATFLOW_API_KEY,
    },
    body: bodyString,
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  res.status(response.status).json(body);
}

// --- /api/satflow-purchase-broadcast -> op=purchase-broadcast ---------------

async function handlePurchaseBroadcast(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  sendCors(res, 'GET, POST, PUT, DELETE, OPTIONS');

  const baseUrl = 'https://api.satflow.com/v1/purchase/broadcast';

  const bodyString =
    typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body ?? {});

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': SATFLOW_API_KEY,
    },
    body: bodyString,
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  res.status(response.status).json(body);
}

