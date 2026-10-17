/*
 * Which of a wallet's inscriptions belong to an ord.net collection.
 *
 * ord.net has no "is this inscription in that collection" lookup, and reading
 * a collection's whole inscription list is far too slow for a large one. But
 * the question is only ever asked about the handful of inscriptions a proxy
 * wallet holds, and ord.net says how each collection is defined
 * (`collection.kind` on every listing and sale):
 *
 *   parent_child — the collection is the children of a parent inscription.
 *                  Membership is on chain: an inscription is in it when its
 *                  parent is the collection's parent. The collection's
 *                  parents are learned from a few of its current listings,
 *                  and every lookup comes from ord's recursion endpoint
 *                  (lib/ordRecursion), cached for good.
 *   gallery      — a curated list with no on-chain rule. An inscription is
 *                  only known to be in it from ord.net itself: seen in the
 *                  collection's listings or sales, or bought there by the
 *                  trader.
 *
 * Everything ord.net shows in a collection is recorded as a member as it
 * goes past (listing reads the trader already makes, the collection's sales
 * feed, its own purchases), so most proxy-wallet items, which were bought
 * from that collection's listings, are known without any lookup at all.
 * Nothing is ever treated as a member without one of these.
 */

const STORE_PREFIX = 'fine-trading-ordnet-collection:';
/** The old full-scan cache, removed on first use. */
const LEGACY_STORE_PREFIX = 'fine-trading-ordnet-members:';

/** How often to read new sales in a collection. */
export const SALES_REFRESH_MS = 15 * 60 * 1000;
/** The first sales read goes this deep; later ones stop at a known sale. */
const FIRST_SALES_PAGES = 3;
const MAX_SALES_PAGES = 5;
/** How often to re-check a collection's kind. */
const KIND_REFRESH_MS = 24 * 60 * 60 * 1000;
/** Members whose parents are read to learn the collection's parents. */
const PARENT_SAMPLE_BATCH = 5;
const MAX_PARENT_SAMPLES = 25;
const MAX_STORED_MEMBERS = 20000;

const memory = new Map();
const inFlight = new Map();

const storage = () => {
  try {
    return globalThis.window?.localStorage || null;
  } catch {
    return null;
  }
};

const load = (slug) => {
  if (memory.has(slug)) return memory.get(slug);
  let state = {
    kind: null,
    kindCheckedAt: 0,
    members: new Set(),
    parents: new Set(),
    sampled: new Set(),
    newestSaleId: null,
    salesCheckedAt: 0,
  };
  try {
    const store = storage();
    store?.removeItem(LEGACY_STORE_PREFIX + slug);
    const saved = JSON.parse(store?.getItem(STORE_PREFIX + slug) || 'null');
    if (saved?.v === 2) {
      state = {
        kind: saved.kind || null,
        kindCheckedAt: Number(saved.kindCheckedAt) || 0,
        members: new Set(saved.members || []),
        parents: new Set(saved.parents || []),
        sampled: new Set(saved.sampled || []),
        newestSaleId: saved.newestSaleId || null,
        salesCheckedAt: Number(saved.salesCheckedAt) || 0,
      };
    }
  } catch {
    // Unreadable; rebuilt from what ord.net shows next.
  }
  memory.set(slug, state);
  return state;
};

const save = (slug, state) => {
  try {
    storage()?.setItem(
      STORE_PREFIX + slug,
      JSON.stringify({
        v: 2,
        kind: state.kind,
        kindCheckedAt: state.kindCheckedAt,
        members: [...state.members].slice(-MAX_STORED_MEMBERS),
        parents: [...state.parents],
        sampled: [...state.sampled],
        newestSaleId: state.newestSaleId,
        salesCheckedAt: state.salesCheckedAt,
      })
    );
  } catch {
    // Over quota: the in-memory copy still serves this session.
  }
};

const idOf = (row) =>
  typeof row === 'string' ? row : row?.inscriptionId || row?.id || null;

/** True when a row ord.net returned says it is in another collection. */
const isOtherCollection = (row, slug) => {
  const rowSlug = row?.collection?.slug;
  return (
    typeof rowSlug === 'string' && rowSlug.toLowerCase() !== slug.toLowerCase()
  );
};

const absorb = (slug, state, rows) => {
  let added = false;
  for (const row of rows || []) {
    if (isOtherCollection(row, slug)) continue;
    const kind = row?.collection?.kind;
    if (kind === 'parent_child' || kind === 'gallery') {
      state.kind = kind;
      state.kindCheckedAt = Date.now();
    }
    const id = idOf(row);
    if (id && !state.members.has(id)) {
      state.members.add(id);
      added = true;
    }
  }
  return added;
};

/**
 * Record inscriptions ord.net has shown in a collection: listing or sale
 * rows (whose `collection.kind` is kept too), or bare inscription ids the
 * trader bought there. Rows labelled with another collection are ignored.
 */
export const recordCollectionMembers = (slug, rows) => {
  if (!slug) return;
  const state = load(slug);
  if (absorb(slug, state, rows)) save(slug, state);
};

const refreshSales = async (slug, state, readSales) => {
  if (Date.now() - state.salesCheckedAt < SALES_REFRESH_MS) return;
  const firstRead = !state.newestSaleId;
  let cursor = null;
  let newest = null;
  for (
    let page = 0;
    page < (firstRead ? FIRST_SALES_PAGES : MAX_SALES_PAGES);
    page++
  ) {
    const data = await readSales({ limit: 100, cursor });
    const sales = data?.sales || [];
    let reachedKnown = false;
    for (const sale of sales) {
      if (!newest && sale?.saleId) newest = sale.saleId;
      if (sale?.saleId && sale.saleId === state.newestSaleId) {
        reachedKnown = true;
        break;
      }
      absorb(slug, state, [sale]);
    }
    cursor = data?.pagination?.nextCursor || null;
    if (reachedKnown || !data?.pagination?.hasNext || !cursor) break;
  }
  if (newest) state.newestSaleId = newest;
  state.salesCheckedAt = Date.now();
};

const learnFromListings = async (slug, state, readListings) => {
  const data = await readListings({ limit: 20, sort: 'price' });
  absorb(slug, state, data?.listings || []);
  state.kindCheckedAt = Date.now();
};

/** Read the parents of a few more known members, widening the parent set. */
const sampleParents = async (state, fetchParents) => {
  const unsampled = [...state.members]
    .filter((id) => !state.sampled.has(id))
    .slice(0, PARENT_SAMPLE_BATCH);
  for (const id of unsampled) {
    if (state.sampled.size >= MAX_PARENT_SAMPLES) break;
    try {
      const parents = await fetchParents(id);
      parents.forEach((p) => state.parents.add(p));
      state.sampled.add(id);
    } catch {
      // ord unreachable; try again next time.
    }
  }
};

const parentMatch = async (id, state, fetchParents) => {
  try {
    const parents = await fetchParents(id);
    return parents.some((p) => state.parents.has(p));
  } catch {
    return false;
  }
};

/**
 * Of `heldIds`, which are in the collection.
 *
 * @param {string} slug
 * @param {Iterable<string>} heldIds the wallet's inscriptions
 * @param {{
 *   readListings: (query: object) => Promise<any>,
 *   readSales: (query: object) => Promise<any>,
 *   fetchParents: (inscriptionId: string) => Promise<string[]>,
 * }} deps reads of /listings and /sales filtered to this collection, and
 *   an inscription's parents
 * @returns {Promise<{members: Set<string>, unknown: string[], kind: string|null}>}
 *   `unknown` are held inscriptions not shown to be in the collection.
 */
export const resolveHeldMembers = async (slug, heldIds, deps) => {
  const state = load(slug);
  const held = [...heldIds];

  // One refresh at a time per collection; wallets reuse its result.
  if (!inFlight.has(slug)) {
    const refresh = (async () => {
      try {
        await refreshSales(slug, state, deps.readSales);
      } catch {
        // The sales feed is a bonus; carry on with what is known.
      }
    })();
    inFlight.set(slug, refresh);
    refresh.finally(() => inFlight.delete(slug));
  }
  await inFlight.get(slug);

  let unknown = held.filter((id) => !state.members.has(id));

  if (unknown.length > 0) {
    const needKind =
      !state.kind || Date.now() - state.kindCheckedAt > KIND_REFRESH_MS;
    if (
      needKind ||
      (state.kind === 'parent_child' && state.parents.size === 0)
    ) {
      try {
        await learnFromListings(slug, state, deps.readListings);
      } catch {
        // Without the kind nothing more can be shown this time.
      }
      unknown = unknown.filter((id) => !state.members.has(id));
    }
  }

  if (unknown.length > 0 && state.kind === 'parent_child') {
    if (state.sampled.size === 0) await sampleParents(state, deps.fetchParents);

    const stillUnknown = [];
    for (const id of unknown) {
      if (await parentMatch(id, state, deps.fetchParents)) {
        state.members.add(id);
      } else {
        stillUnknown.push(id);
      }
    }

    /*
     * A collection can have several parents (one per mint phase, say), and
     * the first few listings may not show them all. Widen the sample a
     * little each time an item still does not match, up to a limit.
     */
    if (stillUnknown.length > 0 && state.sampled.size < MAX_PARENT_SAMPLES) {
      const before = state.parents.size;
      await sampleParents(state, deps.fetchParents);
      if (state.parents.size > before) {
        for (const id of [...stillUnknown]) {
          if (await parentMatch(id, state, deps.fetchParents)) {
            state.members.add(id);
          }
        }
      }
    }
    unknown = unknown.filter((id) => !state.members.has(id));
  }

  save(slug, state);
  return {
    members: new Set(held.filter((id) => state.members.has(id))),
    unknown,
    kind: state.kind,
  };
};

/** Forget everything held for a collection. For tests. */
export const resetCollectionMembership = (slug) => {
  memory.delete(slug);
  inFlight.delete(slug);
  try {
    storage()?.removeItem(STORE_PREFIX + slug);
  } catch {
    // Nothing to remove.
  }
};
