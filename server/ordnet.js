/**
 * ord.net API proxy.
 *
 *   GET|POST /api/ordnet?path=/collection/<slug>/listings&...
 *   -> https://ord.net/api/v1/collection/<slug>/listings?...
 *
 * The client's Authorization header (an ord.net session token obtained via
 * BIP-322 sign-in) is forwarded. Session handling and all trading logic live in
 * src/utils/ordNetTradingUtils.js.
 */
const http = require('./lib/http');

const ORDNET_API = 'https://ord.net/api/v1';

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
    await http.relayRaw(upstream, res);
  } catch (error) {
    http.sendServerError(res, 'ord.net request', error, 502);
  }
}

module.exports = { handleOrdnet };
