/**
 * Magic Eden API handlers.
 *
 * Two upstream hosts are used:
 *   api-mainnet.magiceden.dev  developer API, authenticated with MAGIC_EDEN_API_KEY
 *                              (runes, collection stats, tokens)
 *   api-mainnet.magiceden.us   the backend magiceden.us itself calls (PSBT sweeping,
 *                              collection offers, search). Requests carry magiceden.us
 *                              Origin/Referer headers; see docs/KNOWN_ISSUES.md.
 *
 * One handler serves every Magic Eden route, selected by `?op=`. The public URLs
 * predate this module and are kept for compatibility (MAGIC_EDEN_ROUTES).
 */
const { getMagicEdenApiKey } = require('./lib/env');
const { createTtlCache } = require('./lib/cache');
const http = require('./lib/http');

const ME_DEVELOPER_API = 'https://api-mainnet.magiceden.dev';
const ME_SITE_API = 'https://api-mainnet.magiceden.us';

const ROUTER_QUERY_KEYS = ['op'];

/** Public URL -> op served by handleMagicEden. */
const MAGIC_EDEN_ROUTES = {
  '/api/proxy': 'runes',
  '/api/magiceden-psbt': 'psbt',
  '/api/wallet-tokens': 'wallet-tokens',
  '/api/collections': 'collections',
  '/api/collection-items': 'collection-items',
  '/api/search-collections': 'search-collections',
  '/api/collection-offers': 'collection-offers',
  '/api/collection-offers-psbt': 'collection-offers-psbt',
  '/api/collection-offers-fulfill': 'collection-offers-fulfill',
  '/api/collection-offers-fulfill-submit': 'collection-offers-fulfill-submit',
};

// PSBT endpoints reachable through /api/magiceden-psbt?endpoint=<name>.
const PSBT_ENDPOINTS = [
  'get_sweeping',
  'sweeping',
  'get_batch_listing',
  'batch_listing',
];

// Magic Eden answers a sweep with a vague error when these are missing.
const SWEEPING_REQUIRED_FIELDS = [
  'buyerAddress',
  'buyerPublicKey',
  'signedFundsPreparationPSBTBase64',
  'unsignedFundsPreparationPSBTBase64',
];

const responseCache = createTtlCache({ ttlMs: 10 * 60 * 1000 });

const apiKeyHeaders = (extra = {}) => {
  const apiKey = getMagicEdenApiKey();
  return {
    'user-agent': 'Fine-Trading-App/1.0',
    accept: 'application/json',
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    ...extra,
  };
};

const siteHeaders = (extra = {}) => ({
  accept: 'application/json, text/plain, */*',
  origin: 'https://magiceden.us',
  referer: 'https://magiceden.us/',
  ...extra,
});

/** Forwardable request body, or null after answering 400 when it is empty. */
const requireBody = (req, res) => {
  const body = http.bodyToString(req.body);
  if (body) return body;
  res.status(400).json({ error: 'Request body is required' });
  return null;
};

/** GET `url`, caching successful JSON responses for 10 minutes. */
async function relayCachedJson(url, headers, res) {
  const cached = responseCache.get(url);
  if (cached !== undefined) {
    res.setHeader('X-Cache', 'HIT');
    res.status(200).json(cached);
    return;
  }

  const upstream = await fetch(url, { headers });
  if (!upstream.ok) {
    await http.relayJson(upstream, res);
    return;
  }

  const json = http.tryParseJson(await upstream.text());
  if (json === undefined) {
    res.status(502).json({ error: 'Magic Eden returned invalid JSON' });
    return;
  }
  responseCache.set(url, json);
  res.setHeader('X-Cache', 'MISS');
  res.status(200).json(json);
}

/** Runes developer API: /api/proxy?endpoint=/market/<rune>/info&... */
async function handleRunes(req, res) {
  const path = http.safeSubpath(req.query.endpoint);
  if (!path) {
    res.status(400).json({ error: 'A valid endpoint parameter is required' });
    return;
  }

  const url = http.withQuery(
    `${ME_DEVELOPER_API}/v2/ord/btc/runes/${path}`,
    req.query,
    [...ROUTER_QUERY_KEYS, 'endpoint']
  );
  const isGet = req.method === 'GET';
  const upstream = await fetch(url, {
    method: req.method,
    headers: apiKeyHeaders(isGet ? {} : { 'content-type': 'application/json' }),
    ...(isGet ? {} : { body: http.bodyToString(req.body ?? {}) }),
  });
  await http.relayJson(upstream, res);
}

/** Ordinals PSBT API: /api/magiceden-psbt?endpoint=get_sweeping|sweeping|... */
async function handlePsbt(req, res) {
  const endpoint = String(req.query.endpoint || '');
  if (!endpoint) {
    res.status(400).json({ error: 'Endpoint parameter is required' });
    return;
  }
  if (!PSBT_ENDPOINTS.includes(endpoint)) {
    res.status(400).json({ error: 'Invalid endpoint' });
    return;
  }

  const url = `${ME_SITE_API}/v2/ord/btc/psbt/${endpoint}`;

  if (req.method === 'GET') {
    const upstream = await fetch(
      http.withQuery(url, req.query, [...ROUTER_QUERY_KEYS, 'endpoint']),
      { headers: siteHeaders() }
    );
    await http.relayJson(upstream, res);
    return;
  }

  const body = requireBody(req, res);
  if (body === null) return;

  if (endpoint === 'sweeping') {
    const parsed = http.parseJsonBody(req.body);
    const missingFields = parsed
      ? SWEEPING_REQUIRED_FIELDS.filter((field) => !parsed[field])
      : [];
    if (missingFields.length > 0) {
      res.status(400).json({ error: 'Missing required fields', missingFields });
      return;
    }
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers: siteHeaders({ 'content-type': 'application/json;charset=UTF-8' }),
    body,
  });
  await http.relayJson(upstream, res);
}

async function handleWalletTokens(req, res) {
  const url = http.withQuery(
    `${ME_SITE_API}/v2/ord/btc/wallets/tokens`,
    req.query,
    ROUTER_QUERY_KEYS
  );
  await relayCachedJson(url, apiKeyHeaders(), res);
}

async function handleCollections(req, res) {
  const url = http.withQuery(
    `${ME_DEVELOPER_API}/collection_stats/search/bitcoin`,
    req.query,
    [...ROUTER_QUERY_KEYS, 'endpoint']
  );
  await relayCachedJson(url, apiKeyHeaders(), res);
}

async function handleCollectionItems(req, res) {
  const url = http.withQuery(
    `${ME_DEVELOPER_API}/v2/ord/btc/tokens`,
    req.query,
    ROUTER_QUERY_KEYS
  );
  await relayCachedJson(url, apiKeyHeaders(), res);
}

async function handleSearchCollections(req, res) {
  const body = http.parseJsonBody(req.body);
  const pattern =
    body && typeof body.pattern === 'string' ? body.pattern.trim() : '';
  if (!pattern) {
    res.status(400).json({ error: 'Pattern parameter is required' });
    return;
  }

  const { chains = ['bitcoin'], limit = 50, offset = 0 } = body;
  const upstream = await fetch(`${ME_SITE_API}/v4/search/search`, {
    method: 'POST',
    headers: siteHeaders({
      'content-type': 'application/json',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    }),
    body: JSON.stringify({
      pattern,
      chains: Array.isArray(chains) ? chains : [chains],
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
    }),
  });
  await http.relayJson(upstream, res);
}

async function handleCollectionOffers(req, res) {
  const { collectionSymbol, sort } = req.query;
  if (!collectionSymbol) {
    res.status(400).json({ error: 'collectionSymbol parameter is required' });
    return;
  }

  // Vercel parses `status[]=valid` as query['status[]']; Express as query.status.
  const status = req.query['status[]'] || req.query.status || 'valid';
  const offset = req.query.offset || '0';
  const params = [
    ...(sort ? [`sort=${encodeURIComponent(sort)}`] : []),
    `status[]=${encodeURIComponent(status)}`,
    `offset=${encodeURIComponent(offset)}`,
  ];

  const upstream = await fetch(
    `${ME_SITE_API}/v2/ord/btc/collection-offers/collection/${encodeURIComponent(
      collectionSymbol
    )}?${params.join('&')}`,
    { headers: siteHeaders() }
  );
  await http.relayJson(upstream, res);
}

async function handleCollectionOffersPsbt(req, res) {
  const url = `${ME_SITE_API}/v2/ord/btc/collection-offers/psbt/create`;

  if (req.method === 'GET') {
    const upstream = await fetch(
      http.withQuery(url, req.query, ROUTER_QUERY_KEYS),
      { headers: siteHeaders() }
    );
    await http.relayJson(upstream, res);
    return;
  }

  const body = requireBody(req, res);
  if (body === null) return;
  const upstream = await fetch(url, {
    method: 'POST',
    headers: siteHeaders({ 'content-type': 'application/json' }),
    body,
  });
  await http.relayJson(upstream, res);
}

/** POST the client's body to a magiceden.us site API path. */
const postToSite = (path) => async (req, res) => {
  const body = requireBody(req, res);
  if (body === null) return;
  const upstream = await fetch(`${ME_SITE_API}${path}`, {
    method: 'POST',
    headers: siteHeaders({ 'content-type': 'application/json' }),
    body,
  });
  await http.relayJson(upstream, res);
};

const OPERATIONS = {
  runes: { methods: ['GET', 'POST'], handle: handleRunes },
  psbt: { methods: ['GET', 'POST'], handle: handlePsbt },
  'wallet-tokens': { methods: ['GET'], handle: handleWalletTokens },
  collections: { methods: ['GET'], handle: handleCollections },
  'collection-items': { methods: ['GET'], handle: handleCollectionItems },
  'search-collections': { methods: ['POST'], handle: handleSearchCollections },
  'collection-offers': { methods: ['GET'], handle: handleCollectionOffers },
  'collection-offers-psbt': {
    methods: ['GET', 'POST'],
    handle: handleCollectionOffersPsbt,
  },
  'collection-offers-fulfill': {
    methods: ['POST'],
    handle: postToSite('/v2/ord/btc/collection-offers/psbt/fulfill'),
  },
  'collection-offers-fulfill-submit': {
    methods: ['POST'],
    handle: postToSite('/v2/ord/btc/collection-offers/psbt/fulfill/submit'),
  },
};

/** Entry point for every Magic Eden route; dispatches on `req.query.op`. */
async function handleMagicEden(req, res) {
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
    http.sendServerError(res, `Magic Eden ${op}`, error);
  }
}

module.exports = { handleMagicEden, MAGIC_EDEN_ROUTES };
