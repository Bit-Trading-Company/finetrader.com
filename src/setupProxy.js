const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const zlib = require('zlib');
const { getUnisatApiKeyFromEnv } = require('./utils/unisatApiKey');

/**
 * Forward express.json() as the proxied POST body.
 *
 * Do NOT use http-proxy-middleware's fixRequestBody(): it returns early when
 * req.readableLength !== 0 ("bodyParser failure"). After express.json() parses the body,
 * readableLength can still be non-zero while the stream is no longer readable, so nothing
 * gets written — upstream sees an empty body (tRPC: input undefined). We stringify req.body
 * whenever it exists.
 *
 * Call only after all other proxyReq headers are set — proxyReq.write() must run last.
 */
function appendParsedJsonBody(proxyReq, req) {
  const requestBody = req.body;
  if (requestBody === undefined || requestBody === null) {
    return;
  }
  if (typeof requestBody !== 'object') {
    return;
  }
  const bodyData = JSON.stringify(requestBody);
  proxyReq.setHeader(
    'Content-Type',
    req.headers['content-type'] || 'application/json'
  );
  proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
  proxyReq.write(bodyData);
}

// In-memory cache for proxy responses (10 minutes TTL)
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

// Helper function to create cache key from request
const getCacheKey = (req) => {
  // Use originalUrl which includes the full path and query string
  const url = req.originalUrl || req.url;
  // Also include parsed query params if available (for consistency)
  const queryString = req.query
    ? new URLSearchParams(req.query).toString()
    : '';
  // Combine both to ensure we catch all variations
  const fullUrl = url.includes('?')
    ? url
    : queryString
      ? `${url}?${queryString}`
      : url;
  return `${req.method}:${fullUrl}`;
};

// Helper function to check if cache entry is valid
const isCacheValid = (cacheEntry) => {
  return cacheEntry && Date.now() - cacheEntry.timestamp < CACHE_TTL;
};

// Helper function to get cached response
const getCachedResponse = (req, res) => {
  const cacheKey = getCacheKey(req);
  const cacheEntry = cache.get(cacheKey);

  if (isCacheValid(cacheEntry)) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Content-Type', cacheEntry.contentType || 'application/json');
    res.status(cacheEntry.statusCode).send(cacheEntry.data);
    return true;
  }

  // Remove expired entry
  if (cacheEntry) {
    cache.delete(cacheKey);
  }

  return false;
};

// Helper function to store response in cache
const storeCachedResponse = (req, data, statusCode, contentType) => {
  const cacheKey = getCacheKey(req);
  cache.set(cacheKey, {
    data,
    statusCode,
    contentType,
    timestamp: Date.now(),
  });
};

// Clean up expired cache entries periodically (every 5 minutes)
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp >= CACHE_TTL) {
        cache.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

module.exports = function (app) {
  // Webpack dev server does not parse JSON POST bodies by default — attach express.json so
  // appendParsedJsonBody() can forward JSON.stringify(req.body) to the target.
  const devJsonBody = express.json({ limit: '2mb' });
  [
    '/api/satflow-create-psbt-non-custodial-bid-deposit',
    '/api/satflow-bid-place',
    '/api/satflow-intent-secure-purchase',
    '/api/satflow-purchase-broadcast',
  ].forEach((p) => app.use(p, devJsonBody));

  // UniSat indexer (Ordinal Extractor: inscription-utxo-data, utxo inscription checks)
  app.use('/api/unisat', async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );
      res.status(204).end();
      return;
    }
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const full = String(req.originalUrl || req.url || '/');
    const u = new URL(
      full.startsWith('http')
        ? full
        : `http://localhost${full.startsWith('/') ? '' : '/'}${full}`
    );
    const subpath = (u.searchParams.get('path') || '')
      .trim()
      .replace(/^\/+/, '');
    if (!subpath) {
      res.status(400).json({ error: 'Missing path query parameter' });
      return;
    }

    const upstreamParams = new URLSearchParams();
    u.searchParams.forEach((value, key) => {
      if (key !== 'path' && value != null && value !== '') {
        upstreamParams.set(key, value);
      }
    });
    const qs = upstreamParams.toString();
    const upstreamUrl = `https://open-api.unisat.io/v1/indexer/${subpath}${qs ? `?${qs}` : ''}`;

    const unisatKey = getUnisatApiKeyFromEnv();
    const headers = {
      accept: 'application/json',
      'user-agent': 'Fine-Trading-App/1.0',
    };
    if (unisatKey) {
      headers.authorization = `Bearer ${unisatKey}`;
    }

    try {
      const upstream = await fetch(upstreamUrl, { method: 'GET', headers });
      let text = await upstream.text();
      const ct = upstream.headers.get('content-type') || 'application/json';
      if (
        !upstream.ok &&
        (upstream.status === 403 || upstream.status === 401)
      ) {
        const hint = unisatKey
          ? 'UniSat rejected the API key. Use only the key from https://developer.unisat.io/ (no Bearer prefix, no quotes, paste once). Restart npm start.'
          : 'Add UNISAT_API_KEY to frontend/.env (https://developer.unisat.io/) and restart npm start.';
        try {
          const parsed = JSON.parse(text);
          text = JSON.stringify({ ...parsed, hint });
        } catch {
          text = JSON.stringify({ msg: text.slice(0, 300), hint });
        }
      }
      res
        .status(upstream.status)
        .setHeader(
          'Content-Type',
          ct.includes('json') ? 'application/json' : ct
        );
      res.send(text);
    } catch (err) {
      console.error('UniSat proxy error:', err);
      res.status(502).json({
        error: 'Failed to fetch UniSat indexer',
        message: err && err.message ? err.message : String(err),
      });
    }
  });

  // Ordinals.com output API (browser CORS blocks direct calls; fee logic needs inscription checks)
  app.use(
    '/api/ordinals-output',
    createProxyMiddleware({
      target: 'https://ordinals.com',
      changeOrigin: true,
      pathRewrite: (path, req) => {
        const full = String(req.originalUrl || req.url || '/');
        const u = new URL(
          full.startsWith('http')
            ? full
            : `http://localhost${full.startsWith('/') ? '' : '/'}${full}`
        );
        const txid = (u.searchParams.get('txid') || '').trim();
        const vout = u.searchParams.get('vout');
        if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
          return path;
        }
        const v =
          vout != null && vout !== '' ? String(parseInt(String(vout), 10)) : '';
        if (v === '' || Number.isNaN(Number(v))) {
          return path;
        }
        return `/api/output/${txid}:${v}`;
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader('user-agent', 'Fine-Trading-App/1.0');
      },
      onError: (err, req, res) => {
        console.error('Ordinals output proxy error:', err);
        res.status(500).json({ error: 'Ordinals output proxy request failed' });
      },
    })
  );

  // Proxy MagicEden Runes API requests to avoid CORS issues in development
  app.use(
    '/api/magiceden',
    (req, res, next) => {
      // Check cache first
      if (req.method === 'GET' && getCachedResponse(req, res)) {
        return;
      }
      next();
    },
    createProxyMiddleware({
      target: 'https://api-mainnet.magiceden.dev',
      changeOrigin: true,
      pathRewrite: {
        '^/api/magiceden': '/v2/ord/btc/runes', // Replace /api/magiceden with correct API path
      },
      onProxyReq: (proxyReq) => {
        // Add API key header
        proxyReq.setHeader(
          'Authorization',
          'Bearer 93d5a8eb-be8e-4c68-9bdf-12655672928d'
        );
        proxyReq.setHeader('User-Agent', 'Fine-Trading-App/1.0');
        proxyReq.setHeader('Accept', 'application/json');
      },
      selfHandleResponse: true,
      onProxyRes: (proxyRes, req, res) => {
        // Cache successful GET responses
        if (req.method === 'GET' && proxyRes.statusCode === 200) {
          const chunks = [];
          const contentEncoding = proxyRes.headers['content-encoding'];

          // Determine if response is compressed and create appropriate stream
          let stream;
          if (contentEncoding === 'gzip') {
            stream = zlib.createGunzip();
            proxyRes.pipe(stream);
          } else if (contentEncoding === 'deflate') {
            stream = zlib.createInflate();
            proxyRes.pipe(stream);
          } else if (contentEncoding === 'br') {
            stream = zlib.createBrotliDecompress();
            proxyRes.pipe(stream);
          } else {
            // Uncompressed - use proxyRes directly
            stream = proxyRes;
          }

          stream.on('data', (chunk) => {
            chunks.push(chunk);
          });

          stream.on('end', () => {
            try {
              const body = Buffer.concat(chunks);
              const contentType =
                proxyRes.headers['content-type'] || 'application/json';
              const bodyString = body.toString('utf8');

              // Store in cache
              storeCachedResponse(
                req,
                bodyString,
                proxyRes.statusCode,
                contentType
              );

              // Copy headers (but remove content-encoding and content-length since we decompressed)
              Object.keys(proxyRes.headers).forEach((key) => {
                const lowerKey = key.toLowerCase();
                if (
                  lowerKey !== 'content-encoding' &&
                  lowerKey !== 'content-length' &&
                  lowerKey !== 'transfer-encoding'
                ) {
                  res.setHeader(key, proxyRes.headers[key]);
                }
              });
              res.setHeader('X-Cache', 'MISS');
              res.setHeader('Content-Length', Buffer.byteLength(bodyString));
              res.status(proxyRes.statusCode);
              res.send(bodyString);
            } catch (error) {
              console.error('Error processing cached response:', error);
              res.status(500).json({ error: 'Failed to process response' });
            }
          });

          stream.on('error', (error) => {
            console.error('Stream error:', error);
            res.status(500).json({ error: 'Failed to process response' });
          });
        } else {
          // For non-cacheable responses, pipe directly
          proxyRes.pipe(res);
        }
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).json({ error: 'Proxy request failed' });
      },
    })
  );

  // Proxy MagicEden Collections API requests to avoid CORS issues in development
  app.use(
    '/api/collections',
    (req, res, next) => {
      // Check cache first
      if (req.method === 'GET' && getCachedResponse(req, res)) {
        return;
      }
      next();
    },
    createProxyMiddleware({
      target: 'https://api-mainnet.magiceden.dev',
      changeOrigin: true,
      pathRewrite: {
        '^/api/collections': '/collection_stats/search/bitcoin',
      },
      onProxyReq: (proxyReq) => {
        // Add API key header
        proxyReq.setHeader(
          'Authorization',
          'Bearer 93d5a8eb-be8e-4c68-9bdf-12655672928d'
        );
        proxyReq.setHeader('User-Agent', 'Fine-Trading-App/1.0');
        proxyReq.setHeader('Accept', 'application/json');
      },
      selfHandleResponse: true,
      onProxyRes: (proxyRes, req, res) => {
        // Cache successful GET responses
        if (req.method === 'GET' && proxyRes.statusCode === 200) {
          const chunks = [];
          const contentEncoding = proxyRes.headers['content-encoding'];

          // Determine if response is compressed and create appropriate stream
          let stream;
          if (contentEncoding === 'gzip') {
            stream = zlib.createGunzip();
            proxyRes.pipe(stream);
          } else if (contentEncoding === 'deflate') {
            stream = zlib.createInflate();
            proxyRes.pipe(stream);
          } else if (contentEncoding === 'br') {
            stream = zlib.createBrotliDecompress();
            proxyRes.pipe(stream);
          } else {
            // Uncompressed - use proxyRes directly
            stream = proxyRes;
          }

          stream.on('data', (chunk) => {
            chunks.push(chunk);
          });

          stream.on('end', () => {
            try {
              const body = Buffer.concat(chunks);
              const contentType =
                proxyRes.headers['content-type'] || 'application/json';
              const bodyString = body.toString('utf8');

              // Store in cache
              storeCachedResponse(
                req,
                bodyString,
                proxyRes.statusCode,
                contentType
              );

              // Copy headers (but remove content-encoding and content-length since we decompressed)
              Object.keys(proxyRes.headers).forEach((key) => {
                const lowerKey = key.toLowerCase();
                if (
                  lowerKey !== 'content-encoding' &&
                  lowerKey !== 'content-length' &&
                  lowerKey !== 'transfer-encoding'
                ) {
                  res.setHeader(key, proxyRes.headers[key]);
                }
              });
              res.setHeader('X-Cache', 'MISS');
              res.setHeader('Content-Length', Buffer.byteLength(bodyString));
              res.status(proxyRes.statusCode);
              res.send(bodyString);
            } catch (error) {
              console.error('Error processing cached response:', error);
              res.status(500).json({ error: 'Failed to process response' });
            }
          });

          stream.on('error', (error) => {
            console.error('Stream error:', error);
            res.status(500).json({ error: 'Failed to process response' });
          });
        } else {
          // For non-cacheable responses, pipe directly
          proxyRes.pipe(res);
        }
      },
      onError: (err, req, res) => {
        console.error('Collections proxy error:', err);
        res.status(500).json({ error: 'Collections proxy request failed' });
      },
    })
  );

  // Proxy MagicEden Collection Listings API requests to avoid CORS issues in development
  app.use(
    '/api/collection-items',
    (req, res, next) => {
      // Check cache first
      if (req.method === 'GET' && getCachedResponse(req, res)) {
        return;
      }
      next();
    },
    createProxyMiddleware({
      target: 'https://api-mainnet.magiceden.dev',
      changeOrigin: true,
      pathRewrite: {
        '^/api/collection-items': '/v2/ord/btc/tokens',
      },
      onProxyReq: (proxyReq) => {
        // Add API key header
        proxyReq.setHeader(
          'Authorization',
          'Bearer 93d5a8eb-be8e-4c68-9bdf-12655672928d'
        );
        proxyReq.setHeader('User-Agent', 'Fine-Trading-App/1.0');
        proxyReq.setHeader('Accept', 'application/json');
      },
      selfHandleResponse: true,
      onProxyRes: (proxyRes, req, res) => {
        // Cache successful GET responses
        if (req.method === 'GET' && proxyRes.statusCode === 200) {
          const chunks = [];
          const contentEncoding = proxyRes.headers['content-encoding'];

          // Determine if response is compressed and create appropriate stream
          let stream;
          if (contentEncoding === 'gzip') {
            stream = zlib.createGunzip();
            proxyRes.pipe(stream);
          } else if (contentEncoding === 'deflate') {
            stream = zlib.createInflate();
            proxyRes.pipe(stream);
          } else if (contentEncoding === 'br') {
            stream = zlib.createBrotliDecompress();
            proxyRes.pipe(stream);
          } else {
            // Uncompressed - use proxyRes directly
            stream = proxyRes;
          }

          stream.on('data', (chunk) => {
            chunks.push(chunk);
          });

          stream.on('end', () => {
            try {
              const body = Buffer.concat(chunks);
              const contentType =
                proxyRes.headers['content-type'] || 'application/json';
              const bodyString = body.toString('utf8');

              // Store in cache
              storeCachedResponse(
                req,
                bodyString,
                proxyRes.statusCode,
                contentType
              );

              // Copy headers (but remove content-encoding and content-length since we decompressed)
              Object.keys(proxyRes.headers).forEach((key) => {
                const lowerKey = key.toLowerCase();
                if (
                  lowerKey !== 'content-encoding' &&
                  lowerKey !== 'content-length' &&
                  lowerKey !== 'transfer-encoding'
                ) {
                  res.setHeader(key, proxyRes.headers[key]);
                }
              });
              res.setHeader('X-Cache', 'MISS');
              res.setHeader('Content-Length', Buffer.byteLength(bodyString));
              res.status(proxyRes.statusCode);
              res.send(bodyString);
            } catch (error) {
              console.error('Error processing cached response:', error);
              res.status(500).json({ error: 'Failed to process response' });
            }
          });

          stream.on('error', (error) => {
            console.error('Stream error:', error);
            res.status(500).json({ error: 'Failed to process response' });
          });
        } else {
          // For non-cacheable responses, pipe directly
          proxyRes.pipe(res);
        }
      },
      onError: (err, req, res) => {
        console.error('Collection items proxy error:', err);
        res
          .status(500)
          .json({ error: 'Collection items proxy request failed' });
      },
    })
  );

  // Proxy MagicEden Tokens API (for checking ownership/status)
  app.use(
    '/api/tokens',
    (req, res, next) => {
      // Don't cache tokens endpoint - always get fresh data for ownership checks
      next();
    },
    createProxyMiddleware({
      target: 'https://api-mainnet.magiceden.dev',
      changeOrigin: true,
      pathRewrite: {
        '^/api/tokens': '/v2/ord/btc/tokens',
      },
      onProxyReq: (proxyReq) => {
        // Add API key header
        proxyReq.setHeader(
          'Authorization',
          'Bearer 93d5a8eb-be8e-4c68-9bdf-12655672928d'
        );
        proxyReq.setHeader('User-Agent', 'Fine-Trading-App/1.0');
        proxyReq.setHeader('Accept', 'application/json');
      },
      onError: (err, req, res) => {
        console.error('Tokens proxy error:', err);
        res.status(500).json({ error: 'Tokens proxy request failed' });
      },
    })
  );

  // Proxy MagicEden Wallet Tokens API requests to avoid CORS issues in development
  // NO CACHE - we need real-time ownership data for auto-trading
  app.use(
    '/api/wallet-tokens',
    createProxyMiddleware({
      target: 'https://api-mainnet.magiceden.dev',
      changeOrigin: true,
      pathRewrite: {
        '^/api/wallet-tokens': '/v2/ord/btc/tokens',
      },
      onProxyReq: (proxyReq) => {
        // Add API key header
        proxyReq.setHeader(
          'Authorization',
          'Bearer 93d5a8eb-be8e-4c68-9bdf-12655672928d'
        );
        proxyReq.setHeader('User-Agent', 'Fine-Trading-App/1.0');
        proxyReq.setHeader('Accept', 'application/json');
      },
      onError: (err, req, res) => {
        console.error('Wallet tokens proxy error:', err);
        res.status(500).json({ error: 'Wallet tokens proxy request failed' });
      },
    })
  );

  // Proxy Magic Eden PSBT API requests
  app.use(
    '/api/magiceden-psbt',
    createProxyMiddleware({
      target: 'https://api-mainnet.magiceden.us',
      changeOrigin: true,
      router: (req) => {
        // Route based on endpoint query parameter
        const endpoint = req.query.endpoint || '';
        if (endpoint.includes('listing') || endpoint.includes('sweeping')) {
          return 'https://api-mainnet.magiceden.us';
        }
        return 'https://api-mainnet.magiceden.us';
      },
      pathRewrite: (path, req) => {
        const endpoint = req.query.endpoint || '';
        // Remove the query param and use it in the path
        return `/v2/ord/btc/psbt/${endpoint}`;
      },
      onProxyReq: (proxyReq) => {
        // Add headers for Magic Eden API
        proxyReq.setHeader(
          'Authorization',
          'Bearer 93d5a8eb-be8e-4c68-9bdf-12655672928d'
        );
        proxyReq.setHeader('User-Agent', 'Fine-Trading-App/1.0');
        proxyReq.setHeader('Accept', 'application/json');
      },
      onError: (err, req, res) => {
        console.error('PSBT proxy error:', err);
        res.status(500).json({ error: 'PSBT proxy request failed' });
      },
    })
  );

  // Proxy Magic Eden Search API requests to avoid CORS issues in development
  app.use(
    '/api/search-collections',
    createProxyMiddleware({
      target: 'https://api-mainnet.magiceden.us',
      changeOrigin: true,
      pathRewrite: {
        '^/api/search-collections': '/v4/search/search',
      },
      onProxyReq: (proxyReq) => {
        // Add headers for Magic Eden API (matching the expected headers)
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Accept', 'application/json, text/plain, */*');
        proxyReq.setHeader('Origin', 'https://magiceden.us');
        proxyReq.setHeader('Referer', 'https://magiceden.us/');
        proxyReq.setHeader(
          'User-Agent',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
        );
      },
      onError: (err, req, res) => {
        console.error('Search collections proxy error:', err);
        res
          .status(500)
          .json({ error: 'Search collections proxy request failed' });
      },
    })
  );

  // Proxy Satflow collection stats API requests to avoid CORS issues in development
  app.use(
    '/api/satflow-collection-stats',
    createProxyMiddleware({
      target: 'https://api.satflow.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/satflow-collection-stats': '/v1/collection-stats',
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader(
          'x-api-key',
          '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q'
        );
      },
      onError: (err, req, res) => {
        console.error('Satflow proxy error:', err);
        res.status(500).json({ error: 'Satflow proxy request failed' });
      },
    })
  );

  // Proxy Satflow collection-stats/floors (floor price for ordinals)
  app.use(
    '/api/satflow-collection-floors',
    createProxyMiddleware({
      target: 'https://api.satflow.com',
      changeOrigin: true,
      pathRewrite: (path, req) => {
        const q =
          req.url && req.url.includes('?')
            ? req.url.slice(req.url.indexOf('?'))
            : '';
        return `/v1/collection-stats/floors${q}`;
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader(
          'x-api-key',
          '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q'
        );
      },
      onError: (err, req, res) => {
        console.error('Satflow collection-floors proxy error:', err);
        res.status(500).json({
          error: 'Satflow collection-floors proxy request failed',
        });
      },
    })
  );

  // Proxy Satflow wallet contents endpoint for wallet ordinals/runes
  app.use(
    '/api/satflow-wallet-contents',
    createProxyMiddleware({
      target: 'https://api.satflow.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/satflow-wallet-contents': '/v1/address/wallet-contents',
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader(
          'x-api-key',
          '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q'
        );
      },
      onError: (err, req, res) => {
        console.error('Satflow wallet-contents proxy error:', err);
        res
          .status(500)
          .json({ error: 'Satflow wallet-contents proxy request failed' });
      },
    })
  );

  // Satflow GET /v1/activity/listings (cheapest listings: collectionSlug, sortBy=unitPrice, timeRange, etc.)
  // Same path is rewritten on Vercel: /api/satflow-activity-listings → /api/satflow?op=activity-listings
  app.use(
    '/api/satflow-activity-listings',
    createProxyMiddleware({
      target: 'https://api.satflow.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/satflow-activity-listings': '/v1/activity/listings',
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader(
          'x-api-key',
          '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q'
        );
      },
      onError: (err, req, res) => {
        console.error('Satflow activity listings proxy error:', err);
        res
          .status(500)
          .json({ error: 'Satflow activity listings proxy request failed' });
      },
    })
  );

  // Satflow GET /v1/activity/bids (collection bids; collectionSlug, timeRange, sortBy, sortDirection)
  app.use(
    '/api/satflow-activity-bids',
    createProxyMiddleware({
      target: 'https://api.satflow.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/satflow-activity-bids': '/v1/activity/bids',
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader(
          'x-api-key',
          '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q'
        );
      },
      onError: (err, req, res) => {
        console.error('Satflow activity bids proxy error:', err);
        res.status(500).json({
          error: 'Satflow activity bids proxy request failed',
        });
      },
    })
  );

  // backend.satflow.com tRPC: createPsbt.nonCustodialBidDeposit (unsigned bid deposit PSBT)
  app.use(
    '/api/satflow-create-psbt-non-custodial-bid-deposit',
    createProxyMiddleware({
      target: 'https://backend.satflow.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/satflow-create-psbt-non-custodial-bid-deposit':
          '/trpc/createPsbt.nonCustodialBidDeposit',
      },
      onProxyReq: (proxyReq, req) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader('x-trpc-source', 'nextjs-react');
        const addr = req.headers['x-wallet-address'];
        if (addr) proxyReq.setHeader('x-wallet-address', addr);
        proxyReq.setHeader('x-wallet-provider', 'proxy');
        appendParsedJsonBody(proxyReq, req);
      },
      onError: (err, req, res) => {
        console.error('Satflow nonCustodialBidDeposit proxy error:', err);
        res.status(500).json({
          error: 'Satflow nonCustodialBidDeposit proxy request failed',
        });
      },
    })
  );

  // POST /v1/bid/place (signed collection bid)
  app.use(
    '/api/satflow-bid-place',
    createProxyMiddleware({
      target: 'https://api.satflow.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/satflow-bid-place': '/v1/bid/place',
      },
      onProxyReq: (proxyReq, req) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader(
          'x-api-key',
          '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q'
        );
        appendParsedJsonBody(proxyReq, req);
      },
      onError: (err, req, res) => {
        console.error('Satflow bid-place proxy error:', err);
        res.status(500).json({
          error: 'Satflow bid-place proxy request failed',
        });
      },
    })
  );

  // Proxy Satflow item details endpoint
  app.use(
    '/api/satflow-item',
    createProxyMiddleware({
      target: 'https://api.satflow.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/satflow-item': '/v1/item',
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader(
          'x-api-key',
          '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q'
        );
      },
      onError: (err, req, res) => {
        console.error('Satflow item proxy error:', err);
        res.status(500).json({ error: 'Satflow item proxy request failed' });
      },
    })
  );

  // Proxy Satflow sell intent (unsigned PSBT for listing)
  app.use(
    '/api/satflow-intent-sell',
    createProxyMiddleware({
      target: 'https://api.satflow.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/satflow-intent-sell': '/v1/intent/sell',
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader('content-type', 'application/json');
        proxyReq.setHeader(
          'x-api-key',
          '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q'
        );
      },
      onError: (err, req, res) => {
        console.error('Satflow intent-sell proxy error:', err);
        res
          .status(500)
          .json({ error: 'Satflow intent-sell proxy request failed' });
      },
    })
  );

  // Proxy Satflow list endpoint (submit signed listing PSBTs)
  app.use(
    '/api/satflow-list',
    createProxyMiddleware({
      target: 'https://api.satflow.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/satflow-list': '/v1/list',
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader('content-type', 'application/json');
        proxyReq.setHeader(
          'x-api-key',
          '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q'
        );
      },
      onError: (err, req, res) => {
        console.error('Satflow list proxy error:', err);
        res.status(500).json({ error: 'Satflow list proxy request failed' });
      },
    })
  );

  // Proxy Satflow satflow-purchase intent (unsigned PSBT for buying)
  app.use(
    '/api/satflow-intent-satflow-purchase',
    createProxyMiddleware({
      target: 'https://api.satflow.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/satflow-intent-satflow-purchase': '/v1/intent/satflow-purchase',
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader('content-type', 'application/json');
        proxyReq.setHeader(
          'x-api-key',
          '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q'
        );
      },
      onError: (err, req, res) => {
        console.error('Satflow intent-satflow-purchase proxy error:', err);
        res.status(500).json({
          error: 'Satflow intent-satflow-purchase proxy request failed',
        });
      },
    })
  );

  // Proxy Satflow secure-purchase intent (multi-step: prepare → purchase → transfer)
  app.use(
    '/api/satflow-intent-secure-purchase',
    createProxyMiddleware({
      target: 'https://api.satflow.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/satflow-intent-secure-purchase': '/v1/intent/secure-purchase',
      },
      onProxyReq: (proxyReq, req) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader(
          'x-api-key',
          '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q'
        );
        appendParsedJsonBody(proxyReq, req);
      },
      onError: (err, req, res) => {
        console.error('Satflow intent-secure-purchase proxy error:', err);
        res.status(500).json({
          error: 'Satflow intent-secure-purchase proxy request failed',
        });
      },
    })
  );

  // Proxy Satflow purchase broadcast (submit signed purchase PSBTs)
  app.use(
    '/api/satflow-purchase-broadcast',
    createProxyMiddleware({
      target: 'https://api.satflow.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/satflow-purchase-broadcast': '/v1/purchase/broadcast',
      },
      onProxyReq: (proxyReq, req) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader(
          'x-api-key',
          '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q'
        );
        appendParsedJsonBody(proxyReq, req);
      },
      onError: (err, req, res) => {
        console.error('Satflow purchase-broadcast proxy error:', err);
        res.status(500).json({
          error: 'Satflow purchase-broadcast proxy request failed',
          message: err && err.message ? err.message : undefined,
        });
      },
    })
  );

  // Satflow top collections (development): fan-out to collection-stats with 10m cache
  const defaultTopIds = [
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

  const TOP_COLLECTIONS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  let topCollectionsCache = {
    key: null,
    data: null,
    expiresAt: 0,
  };

  const getTopCollectionsCacheKey = (collectionIds) =>
    collectionIds.slice().sort().join(',');

  const getCachedTopCollections = (collectionIds) => {
    const key = getTopCollectionsCacheKey(collectionIds);
    if (
      topCollectionsCache.key === key &&
      topCollectionsCache.expiresAt > Date.now()
    ) {
      return topCollectionsCache.data;
    }
    return null;
  };

  const setCachedTopCollections = (collectionIds, data) => {
    topCollectionsCache = {
      key: getTopCollectionsCacheKey(collectionIds),
      data,
      expiresAt: Date.now() + TOP_COLLECTIONS_CACHE_TTL_MS,
    };
  };

  app.use('/api/satflow-top-collections', async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Parse query params from URL
    const url = new URL(
      req.originalUrl || req.url,
      'http://localhost' // base is ignored for path/query parsing
    );
    const idsParam =
      url.searchParams.get('ids') ||
      url.searchParams.get('collectionIds') ||
      '';

    const collectionIds = idsParam
      ? idsParam
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : defaultTopIds;

    // 10-minute cache keyed by set of collection IDs
    const cached = getCachedTopCollections(collectionIds);
    if (cached) {
      res.status(200).json({ collections: cached, cached: true });
      return;
    }

    try {
      const results = await Promise.allSettled(
        collectionIds.map(async (id) => {
          const statsUrl = `https://api.satflow.com/v1/collection-stats?collectionId=${encodeURIComponent(
            String(id)
          )}`;

          const response = await fetch(statsUrl, {
            method: 'GET',
            headers: {
              accept: 'application/json',
              'x-api-key': '0Q5KQ1xKaT8qhghPnXPHjaK5fUJo1EsM54NFEo8q',
            },
          });

          const text = await response.text();

          if (!response.ok) {
            throw new Error(
              `collection-stats failed for ${id} (status ${
                response.status
              }): ${text.slice(0, 200)}`
            );
          }

          let body;
          try {
            body = JSON.parse(text);
          } catch {
            throw new Error(`Invalid JSON from collection-stats for ${id}`);
          }

          const data = body && body.data ? body.data : {};
          const meta = data.metadata || {};

          return {
            collectionId: meta.id || id,
            collectionSymbol: meta.id || id,
            name: meta.name || meta.id || id,
            image: meta.image_url || null,
            totalSupply:
              meta.total_items != null ? Number(meta.total_items) : null,
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
              ? String(
                  firstError.reason && firstError.reason.message
                    ? firstError.reason.message
                    : firstError.reason
                )
              : undefined,
        });
        return;
      }

      setCachedTopCollections(collectionIds, collections);
      res.status(200).json({ collections });
    } catch (err) {
      console.error('Satflow top-collections handler error:', err);
      res.status(500).json({
        error: 'Satflow top-collections handler failed',
        message: err && err.message ? err.message : String(err),
      });
    }
  });

  // Proxy Satflow backend tRPC: collections.search (collection search)
  app.use(
    '/api/satflow-search',
    createProxyMiddleware({
      target: 'https://backend.satflow.com',
      changeOrigin: true,
      pathRewrite: (path, req) => {
        let q = (req.query && (req.query.q || req.query.searchQuery)) || '';
        if (!q && req.url) {
          const match = req.url.match(/[?&]q=([^&]*)|[?&]searchQuery=([^&]*)/);
          q = (match && (match[1] || match[2] || '')) || '';
        }
        const input = encodeURIComponent(
          JSON.stringify({
            0: { json: { searchQuery: String(q || ' ').trim() || ' ' } },
          })
        );
        return `/trpc/collections.search?batch=1&input=${input}`;
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader('x-trpc-source', 'nextjs-react');
      },
      onError: (err, req, res) => {
        console.error('Satflow search proxy error:', err);
        res.status(500).json({ error: 'Satflow search proxy request failed' });
      },
    })
  );

  // Proxy Satflow backend tRPC: createPsbt.setupUtxos (dummy UTXO for purchases)
  app.use(
    '/api/satflow-setup-utxos',
    createProxyMiddleware({
      target: 'https://backend.satflow.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api/satflow-setup-utxos': '/trpc/createPsbt.setupUtxos',
      },
      onProxyReq: (proxyReq, req) => {
        proxyReq.setHeader('accept', 'application/json');
        proxyReq.setHeader('content-type', 'application/json');
        proxyReq.setHeader('x-trpc-source', 'nextjs-react');
        const addr = req.headers['x-wallet-address'];
        if (addr) proxyReq.setHeader('x-wallet-address', addr);
        proxyReq.setHeader('x-wallet-provider', 'proxy');
      },
      onError: (err, req, res) => {
        console.error('Satflow setup-utxos proxy error:', err);
        res.status(500).json({
          error: 'Satflow setup-utxos proxy request failed',
        });
      },
    })
  );
};
