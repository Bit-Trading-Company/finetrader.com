/**
 * @jest-environment node
 */
/*
 * fetchWalletOrdinals is the call the auto-trade engine makes for every wallet
 * on every cycle. It used to scan the whole collection each time — ten ord.net
 * reads per wallet against a thirty-per-minute budget, which 429s with more
 * than a couple of wallets. These tests pin both the cost and the merge.
 */
import { webcrypto } from 'crypto';
import { TextEncoder } from 'util';
import { createHash } from 'crypto';
import {
  fetchWalletOrdinals,
  formatMinFunding,
  listOrdinalWithProxyWallet,
  ORDNET_MIN_FUNDING_SATS,
  prepareSecurePurchase,
  setOrdNetProviderSigner,
} from './ordnetTrading';
import { deriveAddressFromPrivateKey } from '../../lib/bitcoinUtils';

/*
 * bip322-js pins bitcoinjs-lib 6 while this app is on 7, and CRA's Jest
 * resolver flattens that and hands it the wrong version at import time. These
 * tests seed a session rather than signing one, so the signer is stubbed to
 * keep the module loadable. Jest hoists this above the imports. The real
 * BIP-322 path is verified by scripts/verify-ordnet-signing.mjs on plain Node.
 */
jest.mock('bip322-js', () => ({ Signer: { sign: () => '' } }));

// The node environment has neither, and the key helpers need both.
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;

// Sessions are read off window.localStorage, which node does not provide.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  },
};

const WALLET = 'bc1pwallet00000000000000000000000000000000000000000000000000';
/*
 * Membership is cached per collection for the life of the module, which is
 * the point of it — so each test uses its own slug rather than reaching in to
 * reset that state.
 */
let slugCounter = 0;
const nextSlug = () => `test-collection-${++slugCounter}`;
const PUBKEY =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

/** A session already in storage, so no signing happens in these tests. */
const seedSession = (address) =>
  window.localStorage.setItem(
    `fine-trading-ordnet-session:${address}`,
    JSON.stringify({
      sessionToken: 'token',
      walletBindingId: 'binding',
      address,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    })
  );

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  text: async () => JSON.stringify(body),
  json: async () => body,
});

/** Route a stubbed fetch by URL, and record what was asked for. */
const heldTxid = (index) => `${index}`.repeat(64).slice(0, 64);

const stubFetch = ({
  listings = [],
  members = [],
  held = [],
  utxos = null,
}) => {
  const calls = { ordnet: [], unisat: [] };

  global.fetch = jest.fn(async (url) => {
    const target = String(url);
    if (/\/api\/address\/[^/]+\/utxo$/.test(target)) {
      return utxos
        ? jsonResponse(utxos)
        : { ok: false, status: 503, json: async () => null };
    }

    if (target.startsWith('/api/unisat')) {
      calls.unisat.push(target);
      return jsonResponse({
        data: {
          total: held.length,
          utxo: held.map((id, index) => ({
            txid: heldTxid(index),
            vout: 0,
            inscriptions: [{ inscriptionId: id, inscriptionNumber: index }],
          })),
        },
      });
    }

    calls.ordnet.push(target);

    if (target.includes('%2Flistings') || target.includes('path=%2Flistings')) {
      return jsonResponse({ listings, pagination: { hasNext: false } });
    }
    // Collection membership.
    return jsonResponse({
      items: members.map((id) => ({ inscriptionId: id })),
      pagination: { hasNext: false },
    });
  });

  return calls;
};

describe('ord.net fetchWalletOrdinals', () => {
  beforeEach(() => {
    window.localStorage.clear();
    seedSession(WALLET);
    jest.resetModules();
  });

  it('reports listed and unlisted holdings in the collection', async () => {
    const slug = nextSlug();
    stubFetch({
      listings: [
        {
          inscriptionId: 'ins-listed',
          listingId: 'listing-1',
          priceSats: 50000,
          collection: { slug },
          sellerAddress: WALLET,
        },
      ],
      members: ['ins-listed', 'ins-held', 'ins-someone-else'],
      held: ['ins-listed', 'ins-held'],
    });

    const items = await fetchWalletOrdinals(WALLET, slug, true, {
      wallet: { address: WALLET, publicKey: PUBKEY },
    });

    const byId = Object.fromEntries(items.map((i) => [i.inscriptionId, i]));
    expect(Object.keys(byId).sort()).toEqual(['ins-held', 'ins-listed']);
    expect(byId['ins-listed'].listed).toBe(true);
    expect(byId['ins-listed'].listedPrice).toBe(50000);
    expect(byId['ins-held'].listed).toBe(false);
    expect(byId['ins-held'].listedPrice).toBeNull();
  });

  it('ignores inscriptions the wallet holds outside the collection', async () => {
    const slug = nextSlug();
    stubFetch({
      listings: [],
      members: ['ins-in-collection'],
      held: ['ins-in-collection', 'ins-from-elsewhere'],
    });

    const items = await fetchWalletOrdinals(WALLET, slug, true, {
      wallet: { address: WALLET, publicKey: PUBKEY },
    });

    expect(items.map((i) => i.inscriptionId)).toEqual(['ins-in-collection']);
  });

  it('costs one ord.net read per wallet once membership is cached', async () => {
    const slug = nextSlug();
    const calls = stubFetch({
      listings: [],
      members: ['ins-a'],
      held: ['ins-a'],
    });

    // First call warms the membership cache.
    await fetchWalletOrdinals(WALLET, slug, true, {
      wallet: { address: WALLET, publicKey: PUBKEY },
    });
    const afterWarmup = calls.ordnet.length;

    const second =
      'bc1psecond0000000000000000000000000000000000000000000000000';
    seedSession(second);
    await fetchWalletOrdinals(second, slug, true, {
      wallet: { address: second, publicKey: PUBKEY },
    });

    // The second wallet should only have cost its own /listings read.
    expect(calls.ordnet.length - afterWarmup).toBe(1);
    // Ownership never touches ord.net.
    expect(calls.unisat.length).toBe(2);
  });
});

describe('ord.net holdings that are on the move', () => {
  beforeEach(() => {
    window.localStorage.clear();
    seedSession(WALLET);
  });

  it('drops an inscription already spent in the mempool, and holds back an unconfirmed one', async () => {
    /*
     * After a wallet-to-wallet sale the owner index still shows the seller.
     * Listing from there gets a PSBT for the buyer's address — the reported
     * "No inputs could be signed". The wallet's own UTXO set is the tiebreak.
     */
    const slug = nextSlug();
    stubFetch({
      members: ['ins-sold', 'ins-arriving', 'ins-settled'],
      held: ['ins-sold', 'ins-arriving', 'ins-settled'],
      utxos: [
        // ins-sold (index 0) is absent: spent by an unconfirmed settlement.
        {
          txid: heldTxid(1),
          vout: 0,
          value: 10000,
          status: { confirmed: false },
        },
        { txid: heldTxid(2), vout: 0, value: 546, status: { confirmed: true } },
      ],
    });

    const items = await fetchWalletOrdinals(WALLET, slug, true, {
      wallet: { address: WALLET, publicKey: PUBKEY },
    });

    const byId = Object.fromEntries(items.map((i) => [i.inscriptionId, i]));
    expect(Object.keys(byId).sort()).toEqual(['ins-arriving', 'ins-settled']);
    expect(byId['ins-arriving'].mempoolTxId).toBe(heldTxid(1));
    expect(byId['ins-settled'].mempoolTxId).toBe('');
  });

  it('filters nothing when the UTXO set cannot be read', async () => {
    const slug = nextSlug();
    stubFetch({ members: ['ins-a'], held: ['ins-a'], utxos: null });

    const items = await fetchWalletOrdinals(WALLET, slug, true, {
      wallet: { address: WALLET, publicKey: PUBKEY },
    });
    expect(items.map((i) => i.inscriptionId)).toEqual(['ins-a']);
  });
});

describe('ord.net trading writes', () => {
  const PRIVATE_KEY = createHash('sha256')
    .update('ordnet-writes')
    .digest('hex');
  const ADDRESS = deriveAddressFromPrivateKey(PRIVATE_KEY);
  const wallet = { address: ADDRESS, privateKey: PRIVATE_KEY, index: 0 };

  /** Route ord.net writes to handlers by path; record every request. */
  const stubWrites = (handlers, { held = [], utxos = [] } = {}) => {
    const requests = [];
    global.fetch = jest.fn(async (url, init = {}) => {
      const target = String(url);
      if (/\/api\/address\/[^/]+\/utxo$/.test(target)) {
        return jsonResponse(utxos);
      }
      if (target.startsWith('/api/unisat')) {
        return jsonResponse({ data: { total: held.length, utxo: held } });
      }
      const path = new URLSearchParams(target.split('?')[1]).get('path');
      const body = init.body ? JSON.parse(init.body) : null;
      requests.push({ path, body });
      const handler = handlers[path];
      if (!handler) return jsonResponse({});
      const result = handler(body);
      if (result?.status) {
        return {
          ok: false,
          status: result.status,
          headers: { get: () => null },
          text: async () => JSON.stringify({ error: result.error }),
        };
      }
      return jsonResponse(result);
    });
    return requests;
  };

  beforeEach(() => {
    window.localStorage.clear();
    seedSession(ADDRESS);
  });

  it('names the real problem when ord.net builds the listing for another address', async () => {
    const slug = nextSlug();
    stubWrites({
      [`/collection/${slug}/listings/preflight`]: () => ({
        listings: [
          {
            inscriptionId: 'ins-1',
            anchorUtxoId: 'anchor',
            psbts: [
              { stepIndex: 0, signerAddress: 'bc1pbuyer', psbtBase64: 'x' },
            ],
          },
        ],
        recoveryPsbt: { signerAddress: 'bc1pbuyer', psbtBase64: 'x' },
      }),
    });

    const result = await listOrdinalWithProxyWallet(
      { inscriptionId: 'ins-1' },
      50000,
      wallet,
      'mainnet',
      { collectionSymbol: slug }
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/built this listing for bc1pbuyer/);
  });

  it('takes the old listing down before re-pricing', async () => {
    const slug = nextSlug();
    const requests = stubWrites({
      [`/collection/${slug}/listings/delist`]: (body) => ({
        listings: body.listings,
      }),
      [`/collection/${slug}/listings/preflight`]: () => ({
        status: 409,
        error: 'Offer above listing price',
      }),
    });

    const result = await listOrdinalWithProxyWallet(
      {
        inscriptionId: 'ins-1',
        listed: true,
        listingId: 'old-listing',
        listedPrice: 40000,
      },
      50000,
      wallet,
      'mainnet',
      { collectionSymbol: slug }
    );

    expect(requests.map((r) => r.path)).toEqual([
      `/collection/${slug}/listings/delist`,
      `/collection/${slug}/listings/preflight`,
    ]);
    expect(requests[0].body.listings).toEqual([
      { listingId: 'old-listing', inscriptionId: 'ins-1' },
    ]);
    // ord.net's 409 here is an offer above the ask; say so.
    expect(result.error).toMatch(/active offer is above that price/);
  });

  it('never offers an inscription-bearing output as payment', async () => {
    const slug = nextSlug();
    const inscriptionTxid = 'a'.repeat(64);
    const requests = stubWrites(
      {
        [`/collection/${slug}/purchases/preflight`]: () => ({
          status: 409,
          error: 'stop here',
        }),
      },
      {
        // A 10,000-sat inscription output: above the postage heuristic.
        held: [
          {
            txid: inscriptionTxid,
            vout: 0,
            inscriptions: [{ inscriptionId: 'ins-held' }],
          },
        ],
        utxos: [
          {
            txid: inscriptionTxid,
            vout: 0,
            value: 10000,
            status: { confirmed: true },
          },
          {
            txid: 'b'.repeat(64),
            vout: 1,
            value: 500000,
            status: { confirmed: true },
          },
          {
            txid: 'c'.repeat(64),
            vout: 0,
            value: 8000,
            status: { confirmed: false },
          },
          {
            txid: 'd'.repeat(64),
            vout: 2,
            value: 546,
            status: { confirmed: true },
          },
        ],
      }
    );

    await prepareSecurePurchase(
      { inscriptionId: 'ins-buy', listingId: 'listing-buy' },
      wallet,
      'mainnet',
      null,
      null,
      { collectionSymbol: slug }
    );

    const preflight = requests.find((r) => r.path.endsWith('/preflight'));
    expect(preflight.body.spendableUtxos).toEqual([
      { txid: 'b'.repeat(64), vout: 1, valueSats: 500000 },
    ]);
  });
});

describe('ord.net funding floor', () => {
  it('is the 0.001 BTC ord.net enforces and documents', () => {
    expect(ORDNET_MIN_FUNDING_SATS).toBe(100000);
    expect(formatMinFunding()).toBe('0.001');
  });
});

describe('ord.net connected-wallet fallback', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setOrdNetProviderSigner(null);
  });

  afterEach(() => setOrdNetProviderSigner(null));

  it('signs in as the connected wallet when no proxy wallet can', async () => {
    const slug = nextSlug();
    const signed = [];
    let verifyBody = null;

    global.fetch = jest.fn(async (url, init) => {
      const target = String(url);
      if (target.startsWith('/api/unisat')) {
        return jsonResponse({ data: { total: 0, utxo: [] } });
      }
      if (target.includes('auth%2Fchallenge')) {
        return jsonResponse({
          authRequestId: 'req-1',
          challenges: [
            { challengeId: 'c1', address: 'bc1p-ordinals', message: 'sign me' },
          ],
        });
      }
      if (target.includes('auth%2Fverify')) {
        // Captured rather than asserted here: assertions belong outside the
        // stub, where they run whether or not the branch was reached.
        verifyBody = JSON.parse(init.body);
        return jsonResponse({
          sessionToken: 'provider-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          walletBindings: [{ walletBindingId: 'provider-binding' }],
        });
      }
      if (target.includes('path=%2Flistings')) {
        return jsonResponse({ listings: [], pagination: { hasNext: false } });
      }
      return jsonResponse({ items: [], pagination: { hasNext: false } });
    });

    setOrdNetProviderSigner({
      ordinalsAddress: 'bc1p-ordinals',
      paymentAddress: 'bc1q-payments',
      signMessage: async (address, message) => {
        signed.push({ address, message });
        return Buffer.from('a-signature').toString('base64');
      },
    });

    // No proxy wallets at all: the connected wallet is the only signer.
    const items = await fetchWalletOrdinals('bc1p-ordinals', slug, true, {
      wallets: [],
    });

    expect(items).toEqual([]);
    expect(signed).toEqual([{ address: 'bc1p-ordinals', message: 'sign me' }]);
    // The signature must reach ord.net hex-encoded, not base64.
    expect(verifyBody?.verifications?.[0]?.signature).toMatch(/^[0-9a-f]+$/);
  });

  it('refuses reads when there is neither a proxy nor a connected wallet', async () => {
    global.fetch = jest.fn();
    await expect(
      fetchWalletOrdinals('bc1p-anything', nextSlug(), true, { wallets: [] })
    ).rejects.toThrow(/require a wallet/);
  });
});
