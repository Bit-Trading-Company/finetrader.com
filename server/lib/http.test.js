/**
 * @jest-environment node
 */
const {
  buildQueryString,
  handlePreflight,
  isOriginAllowed,
  parseJsonBody,
  safeSubpath,
} = require('./http');

describe('safeSubpath', () => {
  it.each([
    [
      'address/bc1pxyz/inscription-utxo-data',
      'address/bc1pxyz/inscription-utxo-data',
    ],
    ['/utxo/abc/0', 'utxo/abc/0'],
    ['/collection/fine%20pepes/listings', 'collection/fine%20pepes/listings'],
  ])('accepts %s', (input, expected) => {
    expect(safeSubpath(input)).toBe(expected);
  });

  it.each([
    '',
    '/',
    '../admin',
    'a/../../b',
    'a/%2e%2e/b',
    'a/%252e%252e/b',
    'https://evil.example/x',
    'a\\b',
    'a?b=1',
    'a#b',
    '%E0%A4%A',
  ])('rejects %p', (input) => {
    expect(safeSubpath(input)).toBeNull();
  });
});

describe('buildQueryString', () => {
  it('skips empty values and omitted keys, and repeats array values', () => {
    expect(
      buildQueryString(
        { op: 'item', a: '1', empty: '', none: null, list: ['x', 'y'] },
        ['op']
      )
    ).toBe('a=1&list=x&list=y');
  });
});

describe('parseJsonBody', () => {
  it('returns objects as-is and parses JSON strings', () => {
    const body = { a: 1 };
    expect(parseJsonBody(body)).toBe(body);
    expect(parseJsonBody('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonBody('')).toEqual({});
  });

  it('returns null for invalid or non-object JSON', () => {
    expect(parseJsonBody('{oops')).toBeNull();
    expect(parseJsonBody('"text"')).toBeNull();
  });
});

describe('origin checks', () => {
  const originalEnv = process.env;
  afterEach(() => {
    process.env = originalEnv;
  });

  const req = (headers = {}, method = 'GET') => ({ method, headers });
  const res = () => {
    const r = { statusCode: 200, headers: {} };
    r.status = jest.fn((code) => {
      r.statusCode = code;
      return r;
    });
    r.setHeader = jest.fn((name, value) => {
      r.headers[name.toLowerCase()] = value;
    });
    r.json = jest.fn(() => r);
    r.end = jest.fn(() => r);
    return r;
  };

  it('allows requests without an Origin (same-origin GETs, server callers)', () => {
    expect(isOriginAllowed(req({ host: 'finetrader.com' }))).toBe(true);
    expect(isOriginAllowed(req({}))).toBe(true);
  });

  it("allows the deployment's own origin (Host or X-Forwarded-Host)", () => {
    expect(
      isOriginAllowed(
        req({ origin: 'http://localhost:3000', host: 'localhost:3000' })
      )
    ).toBe(true);
    expect(
      isOriginAllowed(
        req({
          origin: 'https://finetrader.com',
          host: 'internal:3000',
          'x-forwarded-host': 'finetrader.com',
        })
      )
    ).toBe(true);
  });

  it('rejects other websites, null origins and cross-site no-cors requests', () => {
    expect(
      isOriginAllowed(
        req({ origin: 'https://evil.example', host: 'finetrader.com' })
      )
    ).toBe(false);
    expect(
      isOriginAllowed(req({ origin: 'null', host: 'finetrader.com' }))
    ).toBe(false);
    expect(
      isOriginAllowed(
        req({ host: 'finetrader.com', 'sec-fetch-site': 'cross-site' })
      )
    ).toBe(false);
  });

  it('allows origins listed in ALLOWED_ORIGINS', () => {
    process.env = {
      ...originalEnv,
      ALLOWED_ORIGINS: 'https://staging.example.com/, https://other.example',
    };
    expect(
      isOriginAllowed(
        req({ origin: 'https://staging.example.com', host: 'api.example' })
      )
    ).toBe(true);
    expect(
      isOriginAllowed(
        req({ origin: 'https://nope.example', host: 'api.example' })
      )
    ).toBe(false);
  });

  it('answers 403 for a disallowed origin and stops the handler', () => {
    const r = res();
    const handled = handlePreflight(
      req({ origin: 'https://evil.example', host: 'finetrader.com' }),
      r
    );
    expect(handled).toBe(true);
    expect(r.statusCode).toBe(403);
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('echoes an allowed origin instead of "*" and answers preflights', () => {
    const r = res();
    const handled = handlePreflight(
      req(
        { origin: 'http://localhost:3000', host: 'localhost:3000' },
        'OPTIONS'
      ),
      r
    );
    expect(handled).toBe(true);
    expect(r.statusCode).toBe(204);
    expect(r.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000'
    );
    expect(r.headers.vary).toBe('Origin');
  });

  it('lets allowed non-preflight requests continue without a CORS origin header', () => {
    const r = res();
    expect(handlePreflight(req({ host: 'localhost:3000' }), r)).toBe(false);
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });
});
