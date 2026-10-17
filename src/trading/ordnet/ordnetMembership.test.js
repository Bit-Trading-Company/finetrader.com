/**
 * @jest-environment node
 */
/*
 * Which of a wallet's inscriptions are in an ord.net collection, without
 * reading the collection's whole inscription list (too slow for a large
 * one): what ord.net has shown in the collection, and for parent_child
 * collections the inscription's parent.
 */
import {
  recordCollectionMembers,
  resetCollectionMembership,
  resolveHeldMembers,
  SALES_REFRESH_MS,
} from './ordnetMembership';

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  },
};

let counter = 0;
const nextSlug = () => `membership-${++counter}`;
const used = [];

/** ord.net and ord stubs for one collection. */
const world = ({
  slug,
  kind = 'parent_child',
  listed = [],
  sales = [],
  parents = {},
}) => {
  used.push(slug);
  const row = (inscriptionId) => ({
    inscriptionId,
    collection: { slug, kind },
  });
  return {
    readListings: jest.fn(async () => ({
      listings: listed.map(row),
      pagination: { hasNext: false },
    })),
    readSales: jest.fn(async () => ({
      sales: sales.map((inscriptionId, n) => ({
        saleId: `${slug}-sale-${sales.length - n}`,
        ...row(inscriptionId),
      })),
      pagination: { hasNext: false },
    })),
    fetchParents: jest.fn(async (id) => parents[id] || []),
  };
};

afterEach(() => jest.useRealTimers());
afterAll(() => used.forEach(resetCollectionMembership));

describe('parent_child collections', () => {
  it('recognises a held item by its parent', async () => {
    const slug = nextSlug();
    const deps = world({
      slug,
      listed: ['floor-1', 'floor-2'],
      parents: {
        'floor-1': ['parent-A'],
        'floor-2': ['parent-A'],
        'mine-1': ['parent-A'],
        'other-1': ['parent-Z'],
      },
    });

    const result = await resolveHeldMembers(slug, ['mine-1', 'other-1'], deps);

    expect([...result.members]).toEqual(['mine-1']);
    expect(result.unknown).toEqual(['other-1']);
    expect(result.kind).toBe('parent_child');
    expect(deps.readListings).toHaveBeenCalledTimes(1);
  });

  it('widens the parent sample for a collection with several parents', async () => {
    const slug = nextSlug();
    const listed = Array.from({ length: 8 }, (_, n) => `floor-${n}`);
    const parents = Object.fromEntries(
      listed.map((id, n) => [id, [n < 5 ? 'phase-1' : 'phase-2']])
    );
    parents['mine-phase-2'] = ['phase-2'];
    const deps = world({ slug, listed, parents });

    const result = await resolveHeldMembers(slug, ['mine-phase-2'], deps);

    expect([...result.members]).toEqual(['mine-phase-2']);
  });

  it('needs no lookups for an item ord.net has already shown', async () => {
    const slug = nextSlug();
    const deps = world({ slug, sales: ['bought-1'] });
    recordCollectionMembers(slug, ['bought-by-trader']);

    const result = await resolveHeldMembers(
      slug,
      ['bought-1', 'bought-by-trader'],
      deps
    );

    expect(result.unknown).toEqual([]);
    expect(deps.fetchParents).not.toHaveBeenCalled();
    expect(deps.readListings).not.toHaveBeenCalled();
  });
});

describe('gallery collections', () => {
  it('only counts what ord.net has shown, with no parent lookups', async () => {
    const slug = nextSlug();
    const deps = world({
      slug,
      kind: 'gallery',
      listed: ['floor-1'],
      sales: ['sold-1'],
      parents: { 'mine-1': ['anything'] },
    });

    const result = await resolveHeldMembers(slug, ['sold-1', 'mine-1'], deps);

    expect([...result.members]).toEqual(['sold-1']);
    expect(result.unknown).toEqual(['mine-1']);
    expect(result.kind).toBe('gallery');
    expect(deps.fetchParents).not.toHaveBeenCalled();
  });
});

describe('what ord.net shows', () => {
  it('ignores rows labelled with another collection', async () => {
    const slug = nextSlug();
    recordCollectionMembers(slug, [
      { inscriptionId: 'elsewhere', collection: { slug: 'other' } },
      { inscriptionId: 'here', collection: { slug: slug.toUpperCase() } },
    ]);
    const deps = world({ slug, kind: 'gallery' });

    const result = await resolveHeldMembers(slug, ['elsewhere', 'here'], deps);

    expect([...result.members]).toEqual(['here']);
  });

  it('reads new sales at most every 15 minutes, stopping at a known one', async () => {
    jest.useFakeTimers({ now: Date.now() });
    const slug = nextSlug();
    const deps = world({ slug, kind: 'gallery', sales: ['s-1'] });

    await resolveHeldMembers(slug, ['s-1'], deps);
    await resolveHeldMembers(slug, ['s-1'], deps);
    expect(deps.readSales).toHaveBeenCalledTimes(1);

    jest.setSystemTime(Date.now() + SALES_REFRESH_MS + 1);
    const later = world({ slug, kind: 'gallery', sales: ['s-2', 's-1'] });
    const result = await resolveHeldMembers(slug, ['s-2'], later);
    expect([...result.members]).toEqual(['s-2']);
    expect(later.readSales).toHaveBeenCalledTimes(1);
  });

  it('keeps what it learned for later runs', async () => {
    const slug = nextSlug();
    await resolveHeldMembers(
      slug,
      ['sold-1'],
      world({ slug, kind: 'gallery', sales: ['sold-1'] })
    );

    // A new page load: memory is gone, localStorage is not.
    let fresh;
    jest.isolateModules(() => {
      fresh = require('./ordnetMembership');
    });
    const offline = world({ slug, kind: 'gallery' });
    offline.readSales.mockRejectedValue(new Error('offline'));
    const result = await fresh.resolveHeldMembers(slug, ['sold-1'], offline);
    expect([...result.members]).toEqual(['sold-1']);
  });

  it('removes the old full-collection cache', async () => {
    const slug = nextSlug();
    store.set(`fine-trading-ordnet-members:${slug}`, '{"v":1,"ids":[]}');
    await resolveHeldMembers(slug, [], world({ slug }));
    expect(store.has(`fine-trading-ordnet-members:${slug}`)).toBe(false);
  });
});
