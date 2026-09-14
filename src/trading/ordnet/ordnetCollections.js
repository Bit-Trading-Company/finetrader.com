/**
 * Collection discovery for ord.net.
 *
 * ord.net has no collections index, search, or browse endpoint — every
 * collection route needs a slug you already have. So the browsable list is
 * derived from the live order book: page `GET /listings`, collect the
 * distinct collections, then ask `/collection-stats/floors` for real figures
 * in a single call (it accepts up to 100 slugs at once).
 *
 * The consequence is worth stating plainly: only collections with at least
 * one live listing can appear. A collection nobody is currently selling is
 * invisible here, where Satflow would still list it.
 *
 * Results are cached in-process for a short while, because the picker
 * re-reads them on every keystroke and each read counts against ord.net's
 * 30-per-minute per-profile budget.
 */
import { ordNetFetch, getReadSession } from './ordnetTrading';

/** Listing pages to walk. Each is one read; 4 x 100 covers the active book. */
const MAX_PAGES = 4;
const PAGE_SIZE = 100;

/** `/collection-stats/floors` accepts at most this many slugs per call. */
const MAX_SLUGS_PER_STATS_CALL = 100;

const CACHE_TTL_MS = 60000;
let cache = { at: 0, collections: [] };

/**
 * Walk the order book and return one entry per collection that has listings.
 * @returns {Promise<{slug: string, name: string, seen: number}[]>}
 */
const collectSlugsFromListings = async (session) => {
  const found = new Map();
  let cursor = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await ordNetFetch('/listings', {
      token: session.sessionToken,
      query: { limit: PAGE_SIZE, sort: 'recent', cursor },
    });

    for (const listing of data?.listings || []) {
      const slug = listing?.collection?.slug;
      if (!slug) continue;
      const entry = found.get(slug);
      if (entry) entry.seen += 1;
      else
        found.set(slug, {
          slug,
          name: listing.collection.name || slug,
          seen: 1,
        });
    }

    cursor = data?.pagination?.nextCursor || null;
    if (!cursor || !data?.pagination?.hasNext) break;
  }

  return Array.from(found.values());
};

/** Real floor and listed counts for slugs, in as few calls as possible. */
const fetchStats = async (session, slugs) => {
  const stats = new Map();

  for (let i = 0; i < slugs.length; i += MAX_SLUGS_PER_STATS_CALL) {
    const batch = slugs.slice(i, i + MAX_SLUGS_PER_STATS_CALL);
    const data = await ordNetFetch('/collection-stats/floors', {
      token: session.sessionToken,
      query: { slugs: batch.join(',') },
    });
    for (const row of data?.data || []) {
      if (row?.slug) stats.set(row.slug, row);
    }
  }

  return stats;
};

/**
 * Collections currently tradeable on ord.net, richest first.
 *
 * Shaped like `features/marketplace/collectionsApi`'s Collection so the
 * picker can render either marketplace without branching.
 *
 * @param {{ bypassCache?: boolean, wallet?: object, wallets?: object[], network?: string }} [options]
 */
export const fetchOrdNetCollections = async (options = {}) => {
  if (!options.bypassCache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.collections;
  }

  const session = await getReadSession(options);
  const discovered = await collectSlugsFromListings(session);
  if (discovered.length === 0) return [];

  const stats = await fetchStats(
    session,
    discovered.map((entry) => entry.slug)
  );

  const collections = discovered
    .map((entry) => {
      const stat = stats.get(entry.slug);
      return {
        collectionSymbol: entry.slug,
        collectionId: entry.slug,
        name: entry.name,
        // Floor is already in sats, which is what the adapters expect.
        fp: stat?.floor ?? null,
        // Fall back to what the order book showed when stats are missing.
        listedCount: stat?.listedCount ?? entry.seen,
      };
    })
    .sort((a, b) => (b.listedCount || 0) - (a.listedCount || 0));

  cache = { at: Date.now(), collections };
  return collections;
};

/**
 * Search the derived list by name or slug.
 *
 * Client-side on purpose: there is no ord.net search endpoint, and the list
 * is small enough that filtering it costs nothing and spends no rate limit.
 */
export const searchOrdNetCollections = async (query, options = {}) => {
  const collections = await fetchOrdNetCollections(options);
  const term = String(query || '')
    .trim()
    .toLowerCase();
  if (!term) return collections;

  return collections.filter((collection) =>
    `${collection.name} ${collection.collectionSymbol}`
      .toLowerCase()
      .includes(term)
  );
};
