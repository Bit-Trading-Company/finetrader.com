/*
 * Which inscriptions belong to an ord.net collection.
 *
 * ord.net has no "is this inscription in that collection" lookup and no
 * holdings-by-owner endpoint, so the only way to tell which of a wallet's
 * inscriptions are in a collection is the collection's own inscription list,
 * 100 per page. That list used to be read 10 pages deep, which silently
 * dropped every wallet item past the first 1,000 inscriptions of a larger
 * collection: the run then said "No items needed processing" while the
 * wallet held items to trade.
 *
 * Membership barely changes, so the full list is read once, paced under
 * ord.net's read limit, and kept in localStorage. A scan that is cut short
 * resumes from its cursor. Later refreshes read newest-first only until they
 * reach inscriptions already known, which is usually one page.
 */

const STORE_PREFIX = 'fine-trading-ordnet-members:';
const PAGE_SIZE = 100;
/** How often to look for newly added inscriptions. */
export const MEMBERSHIP_REFRESH_MS = 15 * 60 * 1000;
/** 100,000 inscriptions: a backstop against a cursor that never ends. */
const MAX_SCAN_PAGES = 1000;
/** New inscriptions arrive a few at a time; this is plenty. */
const MAX_REFRESH_PAGES = 20;
/*
 * ord.net allows 30 reads per profile per minute. A scan reads this many
 * pages straight away, then one per gap (24 a minute), leaving room for the
 * per-wallet reads of the cycle that is waiting on it.
 */
const READ_BURST = 15;
const READ_GAP_MS = 2500;
const PROGRESS_EVERY_PAGES = 10;

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
    ids: new Set(),
    complete: false,
    cursor: null,
    checkedAt: 0,
  };
  try {
    const raw = storage()?.getItem(STORE_PREFIX + slug);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved?.v === 1 && Array.isArray(saved.ids)) {
      state = {
        ids: new Set(saved.ids),
        complete: !!saved.complete,
        cursor: saved.cursor || null,
        checkedAt: Number(saved.checkedAt) || 0,
      };
    }
  } catch {
    // Unreadable; start over.
  }
  memory.set(slug, state);
  return state;
};

const save = (slug, state) => {
  try {
    storage()?.setItem(
      STORE_PREFIX + slug,
      JSON.stringify({
        v: 1,
        ids: [...state.ids],
        complete: state.complete,
        cursor: state.cursor,
        checkedAt: state.checkedAt,
      })
    );
  } catch {
    // Over quota: the in-memory copy still serves this session.
  }
};

const idOf = (row) => row?.inscriptionId || row?.id || null;

/** Reads pages one after another, bursting first and then pacing. */
const pacedReader = (fetchPage, sleep) => {
  let pages = 0;
  return async (query) => {
    if (pages >= READ_BURST) await sleep(READ_GAP_MS);
    pages += 1;
    return fetchPage(query);
  };
};

const fullScan = async (slug, state, read, log) => {
  const resumed = state.ids.size > 0;
  if (log) {
    log(
      resumed
        ? `  Resuming ord.net's list of ${slug} (${state.ids.size} inscriptions so far)…`
        : `  Reading ord.net's list of ${slug} inscriptions (once; saved for later runs)…`
    );
  }
  for (let page = 0; page < MAX_SCAN_PAGES; page++) {
    const data = await read({
      limit: PAGE_SIZE,
      cursor: state.cursor,
      sort: 'oldest',
    });
    for (const row of data?.items || []) {
      const id = idOf(row);
      if (id) state.ids.add(id);
    }
    const next = data?.pagination?.nextCursor || null;
    if (!data?.pagination?.hasNext || !next) {
      state.complete = true;
      state.cursor = null;
      break;
    }
    state.cursor = next;
    if (log && (page + 1) % PROGRESS_EVERY_PAGES === 0) {
      log(`    …${state.ids.size} inscriptions read`);
    }
  }
  state.checkedAt = Date.now();
  save(slug, state);
  if (log) {
    log(
      state.complete
        ? `  ord.net lists ${state.ids.size} inscriptions in ${slug}.`
        : `  ⚠ Stopped reading ${slug} at ${state.ids.size} inscriptions.`
    );
  }
};

const refreshNewest = async (state, read) => {
  let cursor = null;
  for (let page = 0; page < MAX_REFRESH_PAGES; page++) {
    const data = await read({ limit: PAGE_SIZE, cursor, sort: 'newest' });
    let reachedKnown = false;
    for (const row of data?.items || []) {
      const id = idOf(row);
      if (!id) continue;
      if (state.ids.has(id)) reachedKnown = true;
      else state.ids.add(id);
    }
    cursor = data?.pagination?.nextCursor || null;
    if (reachedKnown || !data?.pagination?.hasNext || !cursor) break;
  }
  state.checkedAt = Date.now();
};

/**
 * Every inscription id in a collection, as a Set.
 *
 * @param {string} slug
 * @param {{
 *   fetchPage: (query: {limit: number, cursor: string|null, sort: string}) => Promise<any>,
 *   log?: (line: string) => void,
 *   sleep?: (ms: number) => Promise<void>,
 * }} deps `fetchPage` reads one page of /collection/:slug/inscriptions.
 * @returns {Promise<Set<string>>}
 */
export const getCollectionMembership = async (slug, deps) => {
  const state = load(slug);
  const fresh =
    state.complete && Date.now() - state.checkedAt < MEMBERSHIP_REFRESH_MS;
  if (fresh) return state.ids;

  // Wallets are processed one after another, but never scan twice at once.
  if (inFlight.has(slug)) return inFlight.get(slug);

  const sleep =
    deps.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const read = pacedReader(deps.fetchPage, sleep);

  const task = (async () => {
    if (!state.complete) {
      try {
        await fullScan(slug, state, read, deps.log);
      } catch (error) {
        // Keep what was read; the next call resumes from the cursor.
        save(slug, state);
        throw new Error(
          `could not read ord.net's list of ${slug} inscriptions (${state.ids.size} read so far, will resume): ${error.message}`
        );
      }
      return state.ids;
    }
    try {
      await refreshNewest(state, read);
      save(slug, state);
    } catch {
      // A slightly stale list beats none; try again next time.
    }
    return state.ids;
  })();

  inFlight.set(slug, task);
  try {
    return await task;
  } finally {
    inFlight.delete(slug);
  }
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
