/**
 * ord.net API proxy.
 *
 *   GET|POST /api/ordnet?path=/collection/<slug>/listings&...
 *   -> https://ord.net/api/v1/collection/<slug>/listings?...
 *
 * The client's Authorization header (an ord.net session token obtained via
 * BIP-322 sign-in) is forwarded. Session handling and all trading logic live in
 * src/trading/ordnet/ordnetTrading.js.
 */
const http = require('./lib/http');
const { createTtlCache } = require('./lib/cache');

const ORDNET_API = 'https://ord.net/api/v1';

/*
 * Read cache.
 *
 * The auto-trader re-reads the same order book every cycle, and each read is
 * both a Vercel invocation and one of ord.net's 30-per-minute per-profile
 * reads. A short TTL collapses a run's repeated polling without hiding price
 * movement for long. Writes are never cached.
 *
 * Keyed by path + query + caller, so one wallet's session cannot read another
 * wallet's response. Per process, like the Satflow cache.
 */
const readCache = createTtlCache({ ttlMs: 15000, maxEntries: 300 });

/** Reads that are worth caching; everything else goes straight upstream. */
const CACHEABLE = new Set(['listings', 'collection-stats/floors', 'sales']);

const isCacheable = (subpath) =>
  CACHEABLE.has(subpath) || /^collection\/[^/]+\/inscriptions$/.test(subpath);

async function handleOrdnet(req, res) {
  if (http.handlePreflight(req, res, 'GET, POST, OPTIONS')) return;
  if (http.rejectUnlessMethod(req, res, ['GET', 'POST'])) return;

  const subpath = http.safeSubpath(req.query.path);
  if (!subpath) {
    res.status(400).json({ error: 'Invalid or missing ord.net path' });
    return;
  }

  const url = http.withQuery(`${ORDNET_API}/${subpath}`, req.query, ['path']);
  const isGet = req.method === 'GET';

  /*
   * The bearer token is part of the key rather than the payload: responses
   * are per-profile, and a shared key would serve one wallet's data to
   * another. A cache-buster in the query naturally misses.
   */
  const cacheKey =
    isGet && isCacheable(subpath)
      ? `${url}|${req.headers.authorization || 'anon'}`
      : null;

  if (cacheKey) {
    const hit = readCache.get(cacheKey);
    if (hit) {
      res.status(200).json(hit);
      return;
    }
  }

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        accept: 'application/json',
        ...(req.headers.authorization
          ? { authorization: req.headers.authorization }
          : {}),
        ...(isGet ? {} : { 'content-type': 'application/json' }),
      },
      ...(isGet ? {} : { body: http.bodyToString(req.body ?? {}) }),
    });
    if (cacheKey && upstream.ok) {
      const body = await upstream.json();
      readCache.set(cacheKey, body);
      res.status(200).json(body);
      return;
    }

    await http.relayRaw(upstream, res);
  } catch (error) {
    http.sendServerError(res, 'ord.net request', error, 502);
  }
}

module.exports = { handleOrdnet };
