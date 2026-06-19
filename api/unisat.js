/**
 * Server-side proxy for UniSat open indexer API (inscription UTXOs, utxo metadata).
 * Browsers cannot call open-api.unisat.io directly due to CORS.
 *
 * GET /api/unisat?path=<indexer-path>&cursor=0&size=16
 * → https://open-api.unisat.io/v1/indexer/<indexer-path>?cursor=0&size=16
 *
 * Examples:
 *   path=address/bc1p.../inscription-utxo-data
 *   path=utxo/<txid>/<vout>
 */
const UNISAT_INDEXER_BASE = 'https://open-api.unisat.io/v1/indexer';

function normalizeUnisatApiKey(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    trimmed = trimmed.slice(7).trim();
  }
  if (!trimmed || trimmed.includes('your_') || trimmed === 'paste') {
    return null;
  }
  if (trimmed.length >= 2 && trimmed.length % 2 === 0) {
    const half = trimmed.length / 2;
    const a = trimmed.slice(0, half);
    const b = trimmed.slice(half);
    if (a === b) return a;
  }
  return trimmed;
}

function getUnisatApiKey() {
  return normalizeUnisatApiKey(process.env.UNISAT_API_KEY);
}

function unisatUpstreamHeaders() {
  const headers = {
    accept: 'application/json',
    'user-agent': 'Fine-Trading-App/1.0',
  };
  const apiKey = getUnisatApiKey();
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function maybeAugmentUnisatAuthError(status, text) {
  if (status !== 403 && status !== 401) return text;
  const hasKey = Boolean(getUnisatApiKey());
  let hint = hasKey
    ? 'UniSat rejected the API key (invalid token). In frontend/.env use only the key from https://developer.unisat.io/ (no "Bearer ", no quotes, paste once). Restart npm start after fixing.'
    : 'UniSat requires an API key. Add UNISAT_API_KEY to frontend/.env (dev) or Vercel env (prod). Get a free key at https://developer.unisat.io/ then restart the dev server.';
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return JSON.stringify({ ...parsed, hint });
    }
  } catch {
    // not JSON
  }
  return JSON.stringify({ msg: text.slice(0, 300), hint });
}

function sendCors(res, methods = 'GET, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );
}

export default async function handler(req, res) {
  sendCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const subpath = String(req.query.path || '')
    .trim()
    .replace(/^\/+/, '');
  if (!subpath) {
    res.status(400).json({ error: 'Missing path query parameter' });
    return;
  }

  const upstreamParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue;
    if (value === undefined || value === null || value === '') continue;
    upstreamParams.set(key, String(value));
  }
  const qs = upstreamParams.toString();
  const upstreamUrl = `${UNISAT_INDEXER_BASE}/${subpath}${qs ? `?${qs}` : ''}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: unisatUpstreamHeaders(),
    });
    const text = await upstream.text();
    const ct = upstream.headers.get('content-type') || 'application/json';

    if (!upstream.ok) {
      const body = maybeAugmentUnisatAuthError(upstream.status, text);
      res.status(upstream.status).setHeader('Content-Type', ct).send(body);
      return;
    }

    res.setHeader('Content-Type', ct.includes('json') ? 'application/json' : ct);
    res.status(200).send(text);
  } catch (err) {
    console.error('[unisat] proxy error:', err);
    res.status(502).json({
      error: 'Failed to fetch UniSat indexer',
      message: err && err.message ? String(err.message) : String(err),
    });
  }
}
