/**
 * HTTP helpers shared by the API handlers in server/.
 *
 * Handlers take `(req, res)` as provided by both Vercel serverless functions
 * (api/*.js) and the Express dev server (src/setupProxy.js):
 *   req.method, req.query (parsed object), req.headers, req.body (object or string)
 *   res.status(), res.setHeader(), res.json(), res.send(), res.end()
 */

const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'Origin',
  'Referer',
  'x-wallet-address',
  'x-wallet-provider',
].join(', ');

const headerValue = (req, name) => {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
};

/**
 * Extra browser origins allowed to call the API, from ALLOWED_ORIGINS
 * (comma-separated, e.g. "https://staging.example.com"). The site's own origin
 * never needs to be listed.
 */
function extraAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/**
 * Whether a request may use the API.
 *
 * Browsers attach an Origin header to cross-origin requests and to same-origin
 * POSTs; the origin must then be this deployment's own host or be listed in
 * ALLOWED_ORIGINS. Requests without an Origin are allowed (same-origin GETs,
 * server-side callers) unless the browser marks them `Sec-Fetch-Site:
 * cross-site` (e.g. an <img> or no-cors fetch from another website).
 *
 * This stops other websites from spending the API keys through their visitors'
 * browsers. It cannot stop scripts that forge headers; rate-limit /api/* at the
 * edge for that (see docs/KNOWN_ISSUES.md).
 */
function isOriginAllowed(req) {
  const origin = headerValue(req, 'origin');
  if (!origin) return headerValue(req, 'sec-fetch-site') !== 'cross-site';

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false; // includes `Origin: null` (sandboxed frames, file://)
  }
  const requestHosts = [
    headerValue(req, 'x-forwarded-host'),
    headerValue(req, 'host'),
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(',').map((host) => host.trim()));
  if (requestHosts.includes(originHost)) return true;
  return extraAllowedOrigins().includes(origin.replace(/\/+$/, ''));
}

function setCors(req, res, methods) {
  const origin = headerValue(req, 'origin');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
}

/**
 * Reject requests from other websites, apply CORS headers and answer
 * preflight requests. Call first in every handler.
 * @returns {boolean} true when the request has already been answered (403 for
 *   a disallowed origin, or a preflight) and the handler should stop
 */
function handlePreflight(req, res, methods = 'GET, POST, OPTIONS') {
  if (!isOriginAllowed(req)) {
    res.status(403).json({ error: 'Origin not allowed' });
    return true;
  }
  setCors(req, res, methods);
  if (req.method !== 'OPTIONS') return false;
  res.status(204).end();
  return true;
}

/**
 * Respond 405 unless the request method is one of `allowed`.
 * @returns {boolean} true when the request was rejected
 */
function rejectUnlessMethod(req, res, allowed) {
  if (allowed.includes(req.method)) return false;
  res.status(405).json({ error: 'Method not allowed' });
  return true;
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Request body as a string for forwarding upstream (object bodies are re-serialized). */
function bodyToString(body) {
  if (body === undefined || body === null) return '';
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  return JSON.stringify(body);
}

/**
 * Request body as an object.
 * @returns {object|null} `{}` for an empty body, null when the body is not a JSON object
 */
function parseJsonBody(body) {
  if (body === undefined || body === null || body === '') return {};
  if (typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  const parsed = tryParseJson(bodyToString(body));
  return parsed && typeof parsed === 'object' ? parsed : null;
}

/**
 * Query string from a parsed query object, skipping empty values and
 * `omitKeys` (e.g. the `op` added by the router).
 */
function buildQueryString(query, omitKeys = []) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (omitKeys.includes(key)) return;
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      if (item !== undefined && item !== null && item !== '') {
        params.append(key, String(item));
      }
    });
  });
  return params.toString();
}

function withQuery(url, query, omitKeys = []) {
  const qs = buildQueryString(query, omitKeys);
  return qs ? `${url}?${qs}` : url;
}

/**
 * Validate a client-supplied upstream sub-path such as "address/bc1p.../utxo".
 *
 * Rejects absolute URLs, backslashes, query/fragment characters and "." or ".."
 * segments, including percent-encoded forms, so a caller cannot escape the
 * upstream base path.
 *
 * @returns {string|null} the path without leading slashes, or null when unsafe
 */
function safeSubpath(raw) {
  const original = String(raw ?? '').trim();
  let decoded = original;
  for (let i = 0; i < 3; i += 1) {
    let next;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (next === decoded) break;
    decoded = next;
  }

  if (
    !decoded.replace(/^\/+/, '') ||
    decoded.includes('://') ||
    /[\\?#]/.test(decoded) ||
    decoded.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    return null;
  }
  return original.replace(/^\/+/, '');
}

/**
 * Relay an upstream JSON API response. JSON bodies pass through unchanged;
 * non-JSON error bodies are wrapped as `{ error, status, message }` so clients
 * can always call `response.json()` on failures.
 */
async function relayJson(upstream, res) {
  const text = await upstream.text();
  const json = text ? tryParseJson(text) : undefined;
  res.status(upstream.status);
  if (json !== undefined) {
    res.json(json);
    return;
  }
  if (!upstream.ok) {
    res.json({
      error: 'Upstream request failed',
      status: upstream.status,
      message: text.slice(0, 2000),
    });
    return;
  }
  res.setHeader(
    'Content-Type',
    upstream.headers.get('content-type') || 'text/plain; charset=utf-8'
  );
  res.send(text);
}

/** Relay an upstream response verbatim: status, content type and body text. */
async function relayRaw(upstream, res, text) {
  const body = text === undefined ? await upstream.text() : text;
  const contentType = upstream.headers.get('content-type') || '';
  res.status(upstream.status);
  res.setHeader(
    'Content-Type',
    contentType.includes('json') || !contentType
      ? 'application/json'
      : contentType
  );
  res.send(body);
}

/** Log an unexpected failure and answer with a JSON error. */
function sendServerError(res, label, error, status = 500) {
  console.error(`[api] ${label}:`, error);
  if (res.headersSent) return;
  res.status(status).json({
    error: `${label} failed`,
    message: error && error.message ? error.message : String(error),
  });
}

module.exports = {
  isOriginAllowed,
  setCors,
  handlePreflight,
  rejectUnlessMethod,
  tryParseJson,
  bodyToString,
  parseJsonBody,
  buildQueryString,
  withQuery,
  safeSubpath,
  relayJson,
  relayRaw,
  sendServerError,
};
