import { act, renderHook } from '@testing-library/react';
import {
  formatRateLimitMessage,
  identifyApi,
  inspectResponse,
  installRateLimitMonitor,
  onRateLimit,
  parseRetryAfter,
  reportRateLimit,
  resetRateLimitReports,
  useRateLimitLog,
} from './rateLimitMonitor';

const response = (status, { retryAfter = null, body = null } = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: {
    get: (name) => (name.toLowerCase() === 'retry-after' ? retryAfter : null),
  },
  clone: () => ({ json: async () => body }),
});

/** Collect the events reported while `run` executes. */
const captureEvents = async (run) => {
  const events = [];
  const stop = onRateLimit((event) => events.push(event));
  try {
    await run();
    // UniSat bodies are read from a clone in the background.
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    stop();
  }
  return events;
};

beforeEach(() => resetRateLimitReports());

describe('identifyApi', () => {
  it.each([
    ['/api/ordnet?path=%2Flistings&limit=100', 'ord.net', '/listings'],
    [
      '/api/ordnet?path=/collection/puppets/purchases/preflight',
      'ord.net',
      '/collection/puppets/purchases/preflight',
    ],
    [
      '/api/satflow-intent-secure-purchase',
      'Satflow',
      '/satflow-intent-secure-purchase',
    ],
    [
      '/api/unisat?path=address%2Fbc1p%2Finscription-utxo-data&cursor=0',
      'UniSat',
      '/address/bc1p/inscription-utxo-data',
    ],
    [
      'https://mempool.space/api/address/bc1p/utxo',
      'mempool.space',
      '/address/bc1p/utxo',
    ],
    [
      'https://mempool.space/testnet/api/tx',
      'mempool.space',
      '/testnet/api/tx',
    ],
    [
      'https://blockstream.info/api/fee-estimates',
      'blockstream.info',
      '/fee-estimates',
    ],
    ['https://ord.net/api/v1/listings', 'ord.net', '/v1/listings'],
  ])('%s is %s', (url, api, endpoint) => {
    expect(identifyApi(url)).toEqual({ api, endpoint });
  });

  it('ignores anything else, including look-alike hosts', () => {
    expect(identifyApi('/api/health')).toBeNull();
    expect(identifyApi('https://example.com/api/ordnet')).toBeNull();
    expect(identifyApi('https://notmempool.space.evil.com/x')).toBeNull();
  });
});

describe('parseRetryAfter', () => {
  it('reads seconds and HTTP dates', () => {
    const now = Date.parse('2026-10-07T12:00:00Z');
    expect(parseRetryAfter('12', now)).toBe(12);
    expect(parseRetryAfter('Wed, 07 Oct 2026 12:00:30 GMT', now)).toBe(30);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('soon')).toBeNull();
  });
});

describe('inspectResponse', () => {
  it('reports a 429 with the method, endpoint and requested wait', async () => {
    const events = await captureEvents(() =>
      inspectResponse(
        '/api/ordnet?path=%2Flistings',
        response(429, { retryAfter: '20' }),
        'get'
      )
    );
    expect(events).toEqual([
      {
        api: 'ord.net',
        endpoint: '/listings',
        method: 'GET',
        retryAfterSeconds: 20,
        suppressed: 0,
      },
    ]);
  });

  it('ignores other failures and other hosts', async () => {
    const events = await captureEvents(() => {
      inspectResponse('/api/ordnet?path=%2Flistings', response(401));
      inspectResponse('/api/ordnet?path=%2Flistings', response(503));
      inspectResponse('https://example.com/x', response(429));
    });
    expect(events).toEqual([]);
  });

  it("catches UniSat's over-quota answer, which arrives as HTTP 200", async () => {
    const events = await captureEvents(() => {
      inspectResponse(
        '/api/unisat?path=address%2Fbc1p%2Finscription-utxo-data',
        response(200, { body: { code: -2003, msg: 'Daily limit exceeded' } })
      );
      // An ordinary UniSat error is not a rate limit.
      inspectResponse(
        '/api/unisat?path=x',
        response(200, { body: { code: -1, msg: 'address invalid' } })
      );
    });
    expect(events.map((e) => e.api)).toEqual(['UniSat']);
  });
});

describe('reportRateLimit', () => {
  it('reports once per API per cooldown and counts what it held back', async () => {
    const event = { api: 'mempool.space', endpoint: '/x', method: 'GET' };
    const events = await captureEvents(() => {
      reportRateLimit(event, 1000);
      reportRateLimit(event, 2000);
      reportRateLimit(event, 3000);
      reportRateLimit({ ...event, api: 'ord.net' }, 3000);
      reportRateLimit(event, 12000);
    });
    expect(events.map((e) => [e.api, e.suppressed])).toEqual([
      ['mempool.space', 0],
      ['ord.net', 0],
      ['mempool.space', 2],
    ]);
  });
});

describe('formatRateLimitMessage', () => {
  it('names the API, the call, the wait and what the limit is', () => {
    const message = formatRateLimitMessage({
      api: 'ord.net',
      endpoint: '/collection/puppets/purchases/preflight',
      method: 'POST',
      retryAfterSeconds: 12,
      suppressed: 3,
    });
    expect(message).toMatch(
      /^⚠ Rate limit reached on ord\.net: POST \/collection\/puppets\/purchases\/preflight \(3 more since the last notice\)\. ord\.net asks to wait 12s\./
    );
    expect(message).toMatch(/8 writes per wallet per minute/);
  });

  it('leaves out a wait the API did not give', () => {
    expect(
      formatRateLimitMessage({
        api: 'mempool.space',
        endpoint: '/address/bc1p/utxo',
        method: 'GET',
        retryAfterSeconds: null,
        suppressed: 0,
      })
    ).toBe(
      '⚠ Rate limit reached on mempool.space: GET /address/bc1p/utxo. Switching the block explorer in Settings spreads the load to another provider.'
    );
  });
});

describe('installRateLimitMonitor', () => {
  it('passes the response through untouched and reports a 429', async () => {
    const limited = response(429, { retryAfter: '5' });
    const target = { fetch: jest.fn(async () => limited) };
    installRateLimitMonitor(target);
    installRateLimitMonitor(target); // idempotent: wraps once

    let result;
    const events = await captureEvents(async () => {
      result = await target.fetch('https://mempool.space/api/tx', {
        method: 'POST',
      });
    });

    expect(result).toBe(limited);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      api: 'mempool.space',
      method: 'POST',
      retryAfterSeconds: 5,
    });
  });

  it('still returns the response when inspection throws', async () => {
    const odd = { status: 429, headers: null };
    const target = { fetch: async () => odd };
    installRateLimitMonitor(target);
    await expect(target.fetch('/api/ordnet?path=%2Flistings')).resolves.toBe(
      odd
    );
  });
});

describe('useRateLimitLog', () => {
  it('writes rate limits to the log while mounted, and stops after', () => {
    const log = jest.fn();
    const { unmount } = renderHook(() => useRateLimitLog(log));

    act(() => {
      reportRateLimit({
        api: 'Satflow',
        endpoint: '/satflow-list',
        method: 'POST',
      });
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(
      /^⚠ Rate limit reached on Satflow: POST \/satflow-list\./
    );

    unmount();
    resetRateLimitReports();
    reportRateLimit({
      api: 'Satflow',
      endpoint: '/satflow-list',
      method: 'POST',
    });
    expect(log).toHaveBeenCalledTimes(1);
  });
});
