/**
 * UniSat open indexer proxy (inscription UTXOs, per-UTXO inscription checks).
 * Adds UNISAT_API_KEY server-side; browsers cannot call open-api.unisat.io
 * directly because of CORS and the key requirement.
 *
 *   GET /api/unisat?path=<indexer-path>&cursor=0&size=16
 *   -> https://open-api.unisat.io/v1/indexer/<indexer-path>?cursor=0&size=16
 *
 * Examples: path=address/bc1p.../inscription-utxo-data, path=utxo/<txid>/<vout>
 * Frontend URL builder: src/lib/unisatProxy.js
 */
const { getUnisatApiKey } = require('./lib/env');
const http = require('./lib/http');

const UNISAT_INDEXER = 'https://open-api.unisat.io/v1/indexer';

// Explain 401/403 responses, which are almost always a missing or mangled key.
const withAuthHint = (text, hasKey) => {
  const hint = hasKey
    ? 'UniSat rejected the API key. In .env use only the key from https://developer.unisat.io/ (no "Bearer ", no quotes, pasted once), then restart npm start.'
    : 'UniSat requires an API key. Add UNISAT_API_KEY to .env (development) or the Vercel project settings (production). Free key: https://developer.unisat.io/';
  const parsed = http.tryParseJson(text);
  if (parsed && typeof parsed === 'object') {
    return JSON.stringify({ ...parsed, hint });
  }
  return JSON.stringify({ msg: text.slice(0, 300), hint });
};

async function handleUnisat(req, res) {
  if (http.handlePreflight(req, res, 'GET, OPTIONS')) return;
  if (http.rejectUnlessMethod(req, res, ['GET'])) return;

  if (!String(req.query.path || '').trim()) {
    res.status(400).json({ error: 'Missing path query parameter' });
    return;
  }
  const subpath = http.safeSubpath(req.query.path);
  if (!subpath) {
    res.status(400).json({ error: 'Invalid path query parameter' });
    return;
  }

  const apiKey = getUnisatApiKey();
  const url = http.withQuery(`${UNISAT_INDEXER}/${subpath}`, req.query, [
    'path',
  ]);

  try {
    const upstream = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'Fine-Trading-App/1.0',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
    });
    const text = await upstream.text();
    const isAuthError = upstream.status === 401 || upstream.status === 403;
    await http.relayRaw(
      upstream,
      res,
      isAuthError ? withAuthHint(text, Boolean(apiKey)) : text
    );
  } catch (error) {
    http.sendServerError(res, 'UniSat indexer request', error, 502);
  }
}

module.exports = { handleUnisat };
