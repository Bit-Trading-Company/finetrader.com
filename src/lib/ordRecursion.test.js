/**
 * @jest-environment node
 */
import {
  fetchInscriptionParents,
  ORD_RECURSION_BASE,
  resetInscriptionParents,
} from './ordRecursion';

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
};

const respond = (body) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => resetInscriptionParents());

describe('fetchInscriptionParents', () => {
  it("reads an inscription's parents once and keeps them", async () => {
    global.fetch = jest.fn(async () =>
      respond({ ids: ['parent-i0'], more: false, page_index: 0 })
    );

    await expect(fetchInscriptionParents('child-i0')).resolves.toEqual([
      'parent-i0',
    ]);
    await expect(fetchInscriptionParents('child-i0')).resolves.toEqual([
      'parent-i0',
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe(
      `${ORD_RECURSION_BASE}/r/parents/child-i0`
    );
  });

  it('follows further pages', async () => {
    global.fetch = jest.fn(async (url) =>
      url.endsWith('/1')
        ? respond({ ids: ['p-2'], more: false })
        : respond({ ids: ['p-1'], more: true })
    );
    await expect(fetchInscriptionParents('many-i0')).resolves.toEqual([
      'p-1',
      'p-2',
    ]);
  });

  it('throws without caching when ord cannot be reached', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503 }));
    await expect(fetchInscriptionParents('child-i0')).rejects.toThrow(/503/);

    global.fetch = jest.fn(async () => respond({ ids: [], more: false }));
    await expect(fetchInscriptionParents('child-i0')).resolves.toEqual([]);
  });

  it('only looks up mainnet', async () => {
    global.fetch = jest.fn();
    await expect(
      fetchInscriptionParents('child-i0', { network: 'testnet' })
    ).rejects.toThrow(/mainnet/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
