/**
 * Notices when an API the app trades through starts rate limiting, and tells
 * whoever is listening — the auto-trader's console.
 *
 * Rate limits are the failure a user can do something about (fewer wallets, a
 * slower cycle, another block explorer), but they surface deep inside the
 * engine as generic errors, if at all: ord.net calls wait and retry quietly,
 * and a 429 from mempool.space reads as a zero balance. So rather than teach
 * every one of the ~30 call sites to report, `installRateLimitMonitor` wraps
 * `fetch` once and inspects each response from an API it recognises. It
 * never alters or delays the response.
 *
 * A 429 is the signal everywhere. UniSat can also refuse an over-quota key
 * with an HTTP 200 and an error code in the body, so its bodies are read too
 * (from a clone, off the caller's path).
 */

import { useEffect } from 'react';

/** Which API a request went to, by our proxy path or the upstream host. */
const API_MATCHERS = [
  { api: 'ord.net', proxy: '/api/ordnet', host: /(^|\.)ord\.net$/ },
  { api: 'Satflow', proxy: '/api/satflow', host: /(^|\.)satflow\.com$/ },
  { api: 'UniSat', proxy: '/api/unisat', host: /(^|\.)unisat\.io$/ },
  { api: 'mempool.space', host: /(^|\.)mempool\.space$/ },
  { api: 'blockstream.info', host: /(^|\.)blockstream\.info$/ },
];

/** What each API allows, so the console line says what was exceeded. */
const LIMIT_HINTS = {
  'ord.net':
    'ord.net allows 30 reads and 8 writes per wallet per minute (60 and 20 per IP); the app waits and retries once.',
  Satflow:
    "Satflow limits the app's API key; calls resume once the window passes.",
  UniSat: 'UniSat allows 5 calls a second and 2,000 a day on this key.',
  'mempool.space':
    'Switching the block explorer in Settings spreads the load to another provider.',
  'blockstream.info':
    'Switching the block explorer in Settings spreads the load to another provider.',
};

/** One console line per API per this window; the rest are counted. */
const REPORT_COOLDOWN_MS = 10000;

const listeners = new Set();
const lastReport = new Map();

const urlOf = (input) =>
  typeof input === 'string' ? input : input?.url || String(input || '');

/**
 * The API and endpoint a request URL belongs to, or null for anything else.
 * @param {string} url absolute, or relative to the app (our /api proxies)
 * @returns {{ api: string, endpoint: string } | null}
 */
export const identifyApi = (url) => {
  let parsed;
  try {
    parsed = new URL(String(url), 'http://app.local');
  } catch {
    return null;
  }
  const local = parsed.hostname === 'app.local';
  const match = API_MATCHERS.find((m) =>
    local
      ? m.proxy && parsed.pathname.startsWith(m.proxy)
      : m.host.test(parsed.hostname)
  );
  if (!match) return null;

  // The proxies carry the upstream path in ?path=; Satflow's is in the route.
  const proxied = local && parsed.searchParams.get('path');
  const endpoint = proxied
    ? `/${String(proxied).replace(/^\/+/, '')}`
    : parsed.pathname.replace(/^\/api\//, '/');
  return { api: match.api, endpoint };
};

/**
 * Seconds to wait from a Retry-After header (delta-seconds or an HTTP date).
 * @returns {number|null}
 */
export const parseRetryAfter = (value, now = Date.now()) => {
  if (value === null || value === undefined || value === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(value);
  return Number.isFinite(date)
    ? Math.max(0, Math.ceil((date - now) / 1000))
    : null;
};

const UNISAT_QUOTA_MESSAGE =
  /rate.?limit|too many requests|quota|daily limit|limit exceeded/i;

/**
 * @param {(event: RateLimitEvent) => void} listener
 * @returns {() => void} unsubscribe
 *
 * @typedef {Object} RateLimitEvent
 * @property {string} api e.g. 'ord.net'
 * @property {string} endpoint e.g. '/listings'
 * @property {string} method
 * @property {number|null} retryAfterSeconds
 * @property {number} suppressed further hits since the previous report
 */
export const onRateLimit = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Report a rate limit to every listener, at most once per API per cooldown.
 * Hits inside the cooldown are counted and carried on the next report.
 */
export const reportRateLimit = (event, now = Date.now()) => {
  const previous = lastReport.get(event.api);
  if (previous && now - previous.at < REPORT_COOLDOWN_MS) {
    previous.suppressed += 1;
    return;
  }
  lastReport.set(event.api, { at: now, suppressed: 0 });
  const full = { ...event, suppressed: previous?.suppressed || 0 };
  listeners.forEach((listener) => {
    try {
      listener(full);
    } catch {
      // A broken listener must not break the request that tripped it.
    }
  });
};

/** Forget past reports, so the next hit on every API is reported. */
export const resetRateLimitReports = () => lastReport.clear();

/**
 * Inspect one response. Synchronous for status codes; UniSat's quota answer
 * needs its body, which is read from a clone in the background.
 */
export const inspectResponse = (url, response, method = 'GET') => {
  const target = identifyApi(url);
  if (!target || !response) return;

  const report = () =>
    reportRateLimit({
      ...target,
      method: String(method || 'GET').toUpperCase(),
      retryAfterSeconds: parseRetryAfter(
        response.headers?.get?.('retry-after')
      ),
    });

  if (response.status === 429) {
    report();
    return;
  }

  if (
    target.api === 'UniSat' &&
    response.ok &&
    typeof response.clone === 'function'
  ) {
    response
      .clone()
      .json()
      .then((body) => {
        if (
          body &&
          body.code !== undefined &&
          body.code !== 0 &&
          UNISAT_QUOTA_MESSAGE.test(String(body.msg || ''))
        ) {
          report();
        }
      })
      .catch(() => {
        // Not JSON, or already consumed: nothing to learn from it.
      });
  }
};

/** The console line for a rate-limit event. */
export const formatRateLimitMessage = (event) => {
  const wait =
    event.retryAfterSeconds !== null && event.retryAfterSeconds !== undefined
      ? ` ${event.api} asks to wait ${event.retryAfterSeconds}s.`
      : '';
  const more =
    event.suppressed > 0
      ? ` (${event.suppressed} more since the last notice)`
      : '';
  const hint = LIMIT_HINTS[event.api] ? ` ${LIMIT_HINTS[event.api]}` : '';
  return `⚠ Rate limit reached on ${event.api}: ${event.method} ${event.endpoint}${more}.${wait}${hint}`;
};

let installedOn = null;

/**
 * Wrap `target.fetch` so every response passes through inspectResponse.
 * Idempotent; the response is returned untouched and undelayed.
 */
export const installRateLimitMonitor = (target = globalThis) => {
  if (!target || typeof target.fetch !== 'function') return;
  if (installedOn === target) return;
  const originalFetch = target.fetch.bind(target);
  target.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    try {
      inspectResponse(
        urlOf(input),
        response,
        init?.method || input?.method || 'GET'
      );
    } catch {
      // Monitoring is best effort; the caller gets its response regardless.
    }
    return response;
  };
  installedOn = target;
};

/**
 * Write every rate-limit event to an activity log for as long as the calling
 * component is mounted.
 * @param {(message: string) => void} log e.g. useActivityLog's addConsoleLog
 */
export const useRateLimitLog = (log) => {
  useEffect(
    () => onRateLimit((event) => log(formatRateLimitMessage(event))),
    [log]
  );
};
