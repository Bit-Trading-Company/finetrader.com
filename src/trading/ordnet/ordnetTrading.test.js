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
import { fetchWalletOrdinals } from './ordnetTrading';

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
const stubFetch = ({ listings = [], members = [], held = [] }) => {
  const calls = { ordnet: [], unisat: [] };

  global.fetch = jest.fn(async (url) => {
    const target = String(url);

    if (target.startsWith('/api/unisat')) {
      calls.unisat.push(target);
      return jsonResponse({
        data: {
          total: held.length,
          utxo: held.map((id, index) => ({
            txid: `${index}`.repeat(64).slice(0, 64),
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
