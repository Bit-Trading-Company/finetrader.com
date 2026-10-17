/**
 * @jest-environment node
 */
/*
 * ord.net collection membership. It used to stop at 10 pages (1,000
 * inscriptions), so wallet items further in were silently dropped and the
 * run reported "No items needed processing".
 */
import {
  getCollectionMembership,
  MEMBERSHIP_REFRESH_MS,
  resetCollectionMembership,
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

const idAt = (n) => `${String(n).padStart(64, '0')}i0`;

/** A collection of `total` inscriptions, served 100 a page in either order. */
const collection = (total, { failAtPage = null } = {}) => {
  const ids = Array.from({ length: total }, (_, n) => idAt(n));
  const calls = [];
  const fetchPage = jest.fn(async ({ cursor, sort, limit }) => {
    calls.push({ cursor, sort });
    const ordered = sort === 'newest' ? [...ids].reverse() : ids;
    const start = cursor ? Number(cursor) : 0;
    if (failAtPage !== null && start / limit === failAtPage) {
      throw new Error('HTTP 429');
    }
    const items = ordered
      .slice(start, start + limit)
      .map((inscriptionId) => ({ inscriptionId }));
    const hasNext = start + limit < ordered.length;
    return {
      items,
      pagination: {
        hasNext,
        nextCursor: hasNext ? String(start + limit) : null,
      },
    };
  });
  return { ids, fetchPage, calls };
};

const noSleep = jest.fn(async () => {});

let slug = 0;
const nextSlug = () => `membership-${++slug}`;

afterEach(() => {
  jest.useRealTimers();
  noSleep.mockClear();
});

describe('ord.net collection membership', () => {
  it('reads past the first 1,000 inscriptions', async () => {
    const s = nextSlug();
    const { fetchPage } = collection(1550);
    const ids = await getCollectionMembership(s, { fetchPage, sleep: noSleep });
    expect(ids.size).toBe(1550);
    expect(ids.has(idAt(1234))).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(16);
  });

  it('paces a long scan under the read limit', async () => {
    const s = nextSlug();
    const { fetchPage } = collection(3000);
    await getCollectionMembership(s, { fetchPage, sleep: noSleep });
    // 30 pages: the first 15 at once, then a gap before each of the rest.
    expect(noSleep).toHaveBeenCalledTimes(15);
    expect(noSleep).toHaveBeenCalledWith(2500);
  });

  it('keeps the list for later runs', async () => {
    const s = nextSlug();
    const first = collection(250);
    await getCollectionMembership(s, { fetchPage: first.fetchPage });

    // A new page load: memory is gone, localStorage is not.
    let fresh;
    jest.isolateModules(() => {
      fresh = require('./ordnetMembership');
    });
    const second = collection(250);
    const ids = await fresh.getCollectionMembership(s, {
      fetchPage: second.fetchPage,
    });
    expect(ids.size).toBe(250);
    expect(second.fetchPage).not.toHaveBeenCalled();
  });

  it('resumes a scan that was cut short instead of starting over', async () => {
    const s = nextSlug();
    const failing = collection(500, { failAtPage: 3 });
    await expect(
      getCollectionMembership(s, { fetchPage: failing.fetchPage })
    ).rejects.toThrow(/300 read so far, will resume/);

    const working = collection(500);
    const ids = await getCollectionMembership(s, {
      fetchPage: working.fetchPage,
    });
    expect(ids.size).toBe(500);
    expect(working.calls[0].cursor).toBe('300');
  });

  it('refreshes newest-first, stopping at what it already knows', async () => {
    jest.useFakeTimers({ now: Date.now() });
    const s = nextSlug();
    const initial = collection(400);
    await getCollectionMembership(s, { fetchPage: initial.fetchPage });

    // Still fresh: no reads at all.
    const idle = collection(400);
    await getCollectionMembership(s, { fetchPage: idle.fetchPage });
    expect(idle.fetchPage).not.toHaveBeenCalled();

    // Later, five more were added to the collection.
    jest.setSystemTime(Date.now() + MEMBERSHIP_REFRESH_MS + 1);
    const grown = collection(405);
    const ids = await getCollectionMembership(s, {
      fetchPage: grown.fetchPage,
    });
    expect(ids.size).toBe(405);
    expect(grown.calls).toEqual([{ cursor: null, sort: 'newest' }]);
  });

  it('reports progress on the first read', async () => {
    const s = nextSlug();
    const log = jest.fn();
    await getCollectionMembership(s, {
      fetchPage: collection(1200).fetchPage,
      log,
      sleep: noSleep,
    });
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/once; saved/));
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/lists 1200 inscriptions/)
    );
  });

  afterAll(() => {
    for (let n = 1; n <= slug; n++)
      resetCollectionMembership(`membership-${n}`);
  });
});
