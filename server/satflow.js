/**
 * Satflow marketplace API handlers: the public v1 API (https://api.satflow.com/v1,
 * spec in docs/reference/satflow-openapi.json) plus the backend.satflow.com tRPC
 * procedures satflow.com itself uses for search, bid deposits and dummy UTXOs.
 *
 * One handler serves every Satflow route, selected by `?op=`:
 *   production:  vercel.json rewrites /api/satflow-<op> -> /api/satflow?op=<op>
 *   development: src/setupProxy.js mounts /api/satflow-<op> with `op` preset
 */
const { getSatflowApiKey } = require('./lib/env');
const { createTtlCache } = require('./lib/cache');
const http = require('./lib/http');

const SATFLOW_API = 'https://api.satflow.com/v1';
const SATFLOW_TRPC = 'https://backend.satflow.com/trpc';

// Router-only query keys that must not be forwarded upstream.
const ROUTER_QUERY_KEYS = ['op'];

// Collections listed by the collection browser when no ids are requested.
const DEFAULT_TOP_COLLECTION_IDS = [
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

const topCollectionsCache = createTtlCache({
  ttlMs: 10 * 60 * 1000,
  maxEntries: 50,
});

const apiHeaders = (extra = {}) => {
  const apiKey = getSatflowApiKey();
  return {
    accept: 'application/json',
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
    ...extra,
  };
};

const trpcHeaders = (walletAddress, walletProvider) => ({
  accept: 'application/json',
  'content-type': 'application/json',
  'x-wallet-address': String(walletAddress),
  'x-wallet-provider': walletProvider || 'proxy',
  'x-trpc-source': 'nextjs-react',
});

const toNumberOrNull = (value) => (value != null ? Number(value) : null);

/** GET /v1<path>, forwarding the client's query string. */
const getPassThrough = (path) => async (req, res) => {
  const url = http.withQuery(`${SATFLOW_API}${path}`, req.query, [
    ...ROUTER_QUERY_KEYS,
  ]);
  const upstream = await fetch(url, { headers: apiHeaders() });
  await http.relayJson(upstream, res);
};

/** POST /v1<path>, forwarding the client's JSON body. */
const postPassThrough = (path) => async (req, res) => {
  const upstream = await fetch(`${SATFLOW_API}${path}`, {
    method: 'POST',
    headers: apiHeaders({ 'content-type': 'application/json' }),
    body: http.bodyToString(req.body ?? {}),
  });
  await http.relayJson(upstream, res);
};

// --- top-collections: fan out to collection-stats, cached for 10 minutes ----

const toTopCollection = (id, stats) => {
  const data = (stats && stats.data) || {};
  const meta = data.metadata || {};
  return {
    collectionId: meta.id || id,
    collectionSymbol: meta.id || id,
    name: meta.name || meta.id || id,
    image: meta.image_url || null,
    totalSupply: toNumberOrNull(meta.total_items),
    fp: toNumberOrNull(data.floor),
    listedCount: toNumberOrNull(data.listedCount),
    vol: toNumberOrNull(data.volume1d),
    totalVol:
      data.volume30d != null
        ? Number(data.volume30d)
        : toNumberOrNull(data.volume7d),
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
};

const fetchCollectionStats = async (id) => {
  const url = `${SATFLOW_API}/collection-stats?collectionId=${encodeURIComponent(
    String(id)
  )}`;
  const response = await fetch(url, { headers: apiHeaders() });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `collection-stats failed for ${id} (status ${response.status}): ${text.slice(0, 200)}`
    );
  }
  const body = http.tryParseJson(text);
  if (body === undefined) {
    throw new Error(`Invalid JSON from collection-stats for ${id}`);
  }
  return toTopCollection(id, body);
};

async function handleTopCollections(req, res) {
  const idsParam = req.query.ids || req.query.collectionIds || '';
  const collectionIds = idsParam
    ? String(idsParam)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : DEFAULT_TOP_COLLECTION_IDS;

  const cacheKey = collectionIds.slice().sort().join(',');
  const cached = topCollectionsCache.get(cacheKey);
  if (cached) {
    res.status(200).json({ collections: cached, cached: true });
    return;
  }

  const results = await Promise.allSettled(
    collectionIds.map(fetchCollectionStats)
  );
  const collections = results
    .filter((result) => result.status === 'fulfilled' && result.value)
    .map((result) => result.value);

  if (collections.length === 0) {
    const firstError = results.find((result) => result.status === 'rejected');
    res.status(502).json({
      error: 'Satflow top collections failed for all collections',
      details: firstError
        ? String(firstError.reason?.message || firstError.reason)
        : undefined,
    });
    return;
  }

  topCollectionsCache.set(cacheKey, collections);
  res.status(200).json({ collections });
}

// --- search: tRPC collections.search, normalized to the collection shape ----

// The tRPC response shape varies (batched array, single result, or streamed
// JSON lines); find `results.ordinals` in whichever form arrived.
const extractSearchOrdinals = (text) => {
  const fromJson = (json) => {
    if (Array.isArray(json) && json[2]?.[0]?.[0]?.results?.ordinals) {
      return json[2][0][0].results.ordinals;
    }
    return json?.results?.ordinals || null;
  };

  const parsed = http.tryParseJson(text);
  if (parsed !== undefined) {
    if (Array.isArray(parsed) && parsed[0]?.result?.data?.json?.results) {
      return parsed[0].result.data.json.results.ordinals || [];
    }
    if (parsed?.result?.data?.json?.results?.ordinals) {
      return parsed.result.data.json.results.ordinals;
    }
    for (const obj of Array.isArray(parsed) ? parsed : [parsed]) {
      const found = fromJson(obj?.json ?? obj?.result?.data?.json ?? obj);
      if (found) return found;
    }
  }

  if (text.includes('"ordinals"')) {
    for (const line of text.trim().split('\n').filter(Boolean)) {
      const obj = http.tryParseJson(line);
      const found = fromJson(obj?.json ?? obj);
      if (found) return found;
    }
  }
  return [];
};

async function handleSearch(req, res) {
  const searchQuery = req.query.q || req.query.searchQuery || '';
  const input = encodeURIComponent(
    JSON.stringify({
      0: { json: { searchQuery: String(searchQuery).trim() || ' ' } },
    })
  );
  const response = await fetch(
    `${SATFLOW_TRPC}/collections.search?batch=1&input=${input}`,
    {
      headers: { accept: 'application/json', 'x-trpc-source': 'nextjs-react' },
    }
  );
  const text = await response.text();

  if (!response.ok) {
    res.status(response.status).json({
      error: 'Satflow search failed',
      details: text.slice(0, 200),
    });
    return;
  }

  const collections = extractSearchOrdinals(text).map((c) => {
    const mem = c.memflowData || {};
    const meta = c.metadata || c;
    return {
      collectionSymbol: c.id,
      collectionId: c.id,
      name: c.name || meta.name || c.id,
      image: c.image_url || meta.image_url,
      totalSupply: c.item_count != null ? Number(c.item_count) : 0,
      totalVol: toNumberOrNull(mem.totalVolume),
      vol: null,
      fp: toNumberOrNull(mem.floorPrice),
      marketCap: null,
      txns: null,
      listedCount: null,
      ownerCount: null,
      currency: 'BTC',
    };
  });

  res.status(200).json({ collections, collectionsV2: collections });
}

// --- collection floors / stats ----------------------------------------------

async function handleCollectionFloors(req, res) {
  const type = req.query.type || 'ordinals';
  const slugs = req.query.slugs || req.query.slug || '';
  const slugParam = Array.isArray(slugs) ? slugs.join(',') : String(slugs);

  if (!slugParam.trim()) {
    res.status(400).json({ error: 'slugs query parameter required' });
    return;
  }

  const query = new URLSearchParams({ type, slugs: slugParam.trim() });
  const response = await fetch(
    `${SATFLOW_API}/collection-stats/floors?${query.toString()}`,
    { headers: apiHeaders() }
  );
  const text = await response.text();

  if (!response.ok) {
    res.status(response.status).json({
      error: 'Satflow collection floors failed',
      details: text.slice(0, 300),
    });
    return;
  }

  res.status(200).json(http.tryParseJson(text) ?? { success: false, data: [] });
}

async function handleCollectionStats(req, res) {
  const collectionId = req.query.collectionId || 'nodemonkes';
  const upstream = await fetch(
    `${SATFLOW_API}/collection-stats?collectionId=${encodeURIComponent(
      String(collectionId)
    )}`,
    { headers: apiHeaders() }
  );
  await http.relayJson(upstream, res);
}

// --- tRPC PSBT builders (bid deposit, dummy UTXO setup) -----------------------

async function handleBidDepositPsbt(req, res) {
  const body = http.parseJsonBody(req.body);
  if (!body) {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }

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

  // tRPC expects the procedure input under `json`; a bare flat object is read
  // as undefined input. Accept the legacy batch form ({ "0": { json } }), the
  // single form ({ json }), or flat sender fields.
  let forwardBody;
  if (body['0'] !== undefined) {
    forwardBody = body;
  } else {
    let input = null;
    if (body.json && typeof body.json === 'object') {
      input = body.json;
    } else if (body.senderAddress != null || body.senderPublicKey != null) {
      input = {
        senderAddress: body.senderAddress,
        senderPublicKey: body.senderPublicKey,
        receiveAddress: body.receiveAddress,
        amount: body.amount,
        allowedPaymentOutpoints: Array.isArray(body.allowedPaymentOutpoints)
          ? body.allowedPaymentOutpoints
          : [],
      };
    }

    if (!input) {
      res.status(400).json({
        error:
          'Body must include { json: { senderAddress, ... } } or flat senderAddress/senderPublicKey fields, or legacy { "0": { json } }',
      });
      return;
    }
    forwardBody = { json: input };
  }

  const upstream = await fetch(
    `${SATFLOW_TRPC}/createPsbt.nonCustodialBidDeposit`,
    {
      method: 'POST',
      headers: trpcHeaders(
        walletAddress,
        body.walletProvider || body.wallet_provider
      ),
      body: JSON.stringify(forwardBody),
    }
  );
  await http.relayJson(upstream, res);
}

async function handleSetupUtxos(req, res) {
  const body = http.parseJsonBody(req.body);
  if (!body) {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }

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

  const trpcBody =
    body['0'] !== undefined
      ? body
      : { 0: { json: typeof body.json === 'object' ? body.json : {} } };

  const upstream = await fetch(`${SATFLOW_TRPC}/createPsbt.setupUtxos`, {
    method: 'POST',
    headers: trpcHeaders(
      walletAddress,
      body.walletProvider || body.wallet_provider
    ),
    body: JSON.stringify(trpcBody),
  });
  await http.relayJson(upstream, res);
}

// --- router -------------------------------------------------------------------

const OPERATIONS = {
  'top-collections': { methods: ['GET'], handle: handleTopCollections },
  search: { methods: ['GET'], handle: handleSearch },
  'collection-floors': { methods: ['GET'], handle: handleCollectionFloors },
  'collection-stats': { methods: ['GET'], handle: handleCollectionStats },
  'wallet-contents': {
    methods: ['GET'],
    handle: getPassThrough('/address/wallet-contents'),
  },
  'activity-listings': {
    methods: ['GET'],
    handle: getPassThrough('/activity/listings'),
  },
  'activity-bids': {
    methods: ['GET'],
    handle: getPassThrough('/activity/bids'),
  },
  item: { methods: ['GET'], handle: getPassThrough('/item') },
  'create-psbt-non-custodial-bid-deposit': {
    methods: ['POST'],
    handle: handleBidDepositPsbt,
  },
  'setup-utxos': { methods: ['POST'], handle: handleSetupUtxos },
  'bid-place': { methods: ['POST'], handle: postPassThrough('/bid/place') },
  'intent-secure-purchase': {
    methods: ['POST'],
    handle: postPassThrough('/intent/secure-purchase'),
  },
  'intent-satflow-purchase': {
    methods: ['POST'],
    handle: postPassThrough('/intent/satflow-purchase'),
  },
  'intent-sell': { methods: ['POST'], handle: postPassThrough('/intent/sell') },
  list: { methods: ['POST'], handle: postPassThrough('/list') },
  'purchase-broadcast': {
    methods: ['POST'],
    handle: postPassThrough('/purchase/broadcast'),
  },
};

/** Entry point for every Satflow route; dispatches on `req.query.op`. */
async function handleSatflow(req, res) {
  if (http.handlePreflight(req, res, 'GET, POST, OPTIONS')) return;

  const op = String(req.query.op || '').toLowerCase();
  const operation = OPERATIONS[op];
  if (!operation) {
    res.status(400).json({ error: 'Invalid or missing op parameter' });
    return;
  }
  if (http.rejectUnlessMethod(req, res, operation.methods)) return;

  try {
    await operation.handle(req, res);
  } catch (error) {
    http.sendServerError(res, `Satflow ${op}`, error);
  }
}

module.exports = {
  handleSatflow,
  SATFLOW_OPERATIONS: Object.keys(OPERATIONS),
};
