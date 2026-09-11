/**
 * @jest-environment node
 */
const { handleSatflow } = require('./satflow');
const { handleMagicEden } = require('./magiceden');
const { handleUnisat } = require('./unisat');
const { handleOrdnet } = require('./ordnet');

const createResponse = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    headersSent: false,
  };
  const finish = (body) => {
    res.body = body;
    res.headersSent = true;
    return res;
  };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.setHeader = jest.fn((name, value) => {
    res.headers[name.toLowerCase()] = value;
    return res;
  });
  res.json = jest.fn(finish);
  res.send = jest.fn(finish);
  res.end = jest.fn(() => finish(undefined));
  return res;
};

const upstreamResponse = (
  body,
  { status = 200, contentType = 'application/json' } = {}
) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {
    get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null),
  },
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const request = (overrides = {}) => ({
  method: 'GET',
  query: {},
  headers: {},
  body: undefined,
  ...overrides,
});

const originalEnv = process.env;
const originalFetch = global.fetch;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    SATFLOW_API_KEY: 'satflow-test-key',
    MAGIC_EDEN_API_KEY: 'magic-eden-test-key',
    UNISAT_API_KEY: 'unisat-test-key',
  };
  global.fetch = jest.fn(async () => upstreamResponse({ ok: true }));
});

afterEach(() => {
  process.env = originalEnv;
  global.fetch = originalFetch;
});

const lastFetch = () => {
  const [url, init = {}] = global.fetch.mock.calls.at(-1);
  return { url, init };
};

describe('handleSatflow', () => {
  it('rejects a missing op', async () => {
    const res = createResponse();
    await handleSatflow(request(), res);
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects the wrong method for an op', async () => {
    const res = createResponse();
    await handleSatflow(
      request({ method: 'POST', query: { op: 'item' } }),
      res
    );
    expect(res.statusCode).toBe(405);
  });

  it('forwards query params without the router op and adds the API key', async () => {
    const res = createResponse();
    await handleSatflow(
      request({ query: { op: 'item', inscriptionId: 'abci0' } }),
      res
    );
    const { url, init } = lastFetch();
    expect(url).toBe('https://api.satflow.com/v1/item?inscriptionId=abci0');
    expect(init.headers['x-api-key']).toBe('satflow-test-key');
    expect(res.body).toEqual({ ok: true });
  });

  it('wraps non-JSON upstream errors so clients can parse them', async () => {
    global.fetch.mockResolvedValueOnce(
      upstreamResponse('<html>Bad gateway</html>', {
        status: 502,
        contentType: 'text/html',
      })
    );
    const res = createResponse();
    await handleSatflow(
      request({ method: 'POST', query: { op: 'list' }, body: { a: 1 } }),
      res
    );
    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({
      error: 'Upstream request failed',
      status: 502,
    });
  });

  it('answers 400 for malformed tRPC bodies instead of throwing', async () => {
    const res = createResponse();
    await handleSatflow(
      request({ method: 'POST', query: { op: 'setup-utxos' }, body: '{oops' }),
      res
    );
    expect(res.statusCode).toBe(400);
  });
});

describe('handleMagicEden', () => {
  it('proxies runes endpoints to the developer API with the API key', async () => {
    const res = createResponse();
    await handleMagicEden(
      request({
        query: { op: 'runes', endpoint: '/market/DOGGO/info', limit: '1' },
      }),
      res
    );
    const { url, init } = lastFetch();
    expect(url).toBe(
      'https://api-mainnet.magiceden.dev/v2/ord/btc/runes/market/DOGGO/info?limit=1'
    );
    expect(init.headers.authorization).toBe('Bearer magic-eden-test-key');
  });

  it('rejects runes endpoints that escape the runes API', async () => {
    const res = createResponse();
    await handleMagicEden(
      request({ query: { op: 'runes', endpoint: '/../../wallets/tokens' } }),
      res
    );
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('only allows known PSBT endpoints', async () => {
    const res = createResponse();
    await handleMagicEden(
      request({
        method: 'POST',
        query: { op: 'psbt', endpoint: 'delist' },
        body: {},
      }),
      res
    );
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('relays upstream error statuses instead of converting them to 500', async () => {
    global.fetch.mockResolvedValueOnce(
      upstreamResponse({ error: 'rate limited' }, { status: 429 })
    );
    const res = createResponse();
    await handleMagicEden(
      request({ query: { op: 'wallet-tokens', ownerAddress: 'bc1pnocache' } }),
      res
    );
    expect(res.statusCode).toBe(429);
  });
});

describe('handleUnisat', () => {
  it('proxies indexer paths with the API key', async () => {
    const res = createResponse();
    await handleUnisat(
      request({ query: { path: 'utxo/abc/0', size: '16' } }),
      res
    );
    const { url, init } = lastFetch();
    expect(url).toBe(
      'https://open-api.unisat.io/v1/indexer/utxo/abc/0?size=16'
    );
    expect(init.headers.authorization).toBe('Bearer unisat-test-key');
  });

  it('rejects encoded path traversal', async () => {
    const res = createResponse();
    await handleUnisat(
      request({ query: { path: 'utxo/%2e%2e/%2e%2e/x' } }),
      res
    );
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('adds a configuration hint to auth failures', async () => {
    global.fetch.mockResolvedValueOnce(
      upstreamResponse({ msg: 'forbidden' }, { status: 403 })
    );
    const res = createResponse();
    await handleUnisat(request({ query: { path: 'utxo/abc/0' } }), res);
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).hint).toMatch(/UniSat rejected the API key/);
  });
});

describe('handleOrdnet', () => {
  it('forwards the session token and JSON body', async () => {
    const res = createResponse();
    await handleOrdnet(
      request({
        method: 'POST',
        query: { path: '/collection/fine_pepes/listings/preflight' },
        headers: { authorization: 'Bearer session' },
        body: { items: [1] },
      }),
      res
    );
    const { url, init } = lastFetch();
    expect(url).toBe(
      'https://ord.net/api/v1/collection/fine_pepes/listings/preflight'
    );
    expect(init.headers.authorization).toBe('Bearer session');
    expect(init.body).toBe('{"items":[1]}');
  });

  it('rejects double-encoded path traversal', async () => {
    const res = createResponse();
    await handleOrdnet(request({ query: { path: '%252e%252e/admin' } }), res);
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
