/*
 * An inscription's parents, from ord's recursive endpoints.
 *
 * `/r/parents/<id>` is part of ord's recursion API, which inscriptions
 * themselves depend on, so it is served with `Access-Control-Allow-Origin: *`
 * and stays up where ord's JSON API is switched off (as on ordinals.com).
 * Parents are fixed at inscription time and never change, so each answer is
 * kept for good.
 */

/** An ord server with recursion enabled. Mainnet only. */
export const ORD_RECURSION_BASE = 'https://ordinals.com';

const STORE_KEY = 'fine-trading-ord-parents';
/** Enough for every inscription a set of proxy wallets will ever touch. */
const MAX_STORED = 5000;
/** A parent list is almost always one id; more than this is not a collection. */
const MAX_PAGES = 3;

const cache = new Map();
const inFlight = new Map();
let loaded = false;

const storage = () => {
  try {
    return globalThis.window?.localStorage || null;
  } catch {
    return null;
  }
};

const loadStore = () => {
  if (loaded) return;
  loaded = true;
  try {
    const saved = JSON.parse(storage()?.getItem(STORE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      Object.entries(saved).forEach(([id, parents]) => {
        if (Array.isArray(parents)) cache.set(id, parents);
      });
    }
  } catch {
    // Unreadable; rebuilt as lookups come in.
  }
};

const saveStore = () => {
  try {
    const entries = [...cache.entries()].slice(-MAX_STORED);
    storage()?.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Over quota: the in-memory copy still serves this session.
  }
};

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`ord recursion ${response.status} for ${url}`);
  }
  return response.json();
};

/**
 * The parent inscription ids of `inscriptionId` (empty when it has none).
 * Throws when ord cannot be reached; nothing is cached then.
 *
 * @param {string} inscriptionId
 * @param {{network?: string}} [options]
 * @returns {Promise<string[]>}
 */
export const fetchInscriptionParents = async (inscriptionId, options = {}) => {
  if (String(options.network || 'mainnet').toLowerCase() !== 'mainnet') {
    throw new Error('Inscription parents are only looked up on mainnet');
  }
  loadStore();
  if (cache.has(inscriptionId)) return cache.get(inscriptionId);
  if (inFlight.has(inscriptionId)) return inFlight.get(inscriptionId);

  const task = (async () => {
    const parents = [];
    const id = encodeURIComponent(inscriptionId);
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await fetchJson(
        page === 0
          ? `${ORD_RECURSION_BASE}/r/parents/${id}`
          : `${ORD_RECURSION_BASE}/r/parents/${id}/${page}`
      );
      parents.push(...(Array.isArray(data?.ids) ? data.ids : []));
      if (!data?.more) break;
    }
    cache.set(inscriptionId, parents);
    saveStore();
    return parents;
  })();

  inFlight.set(inscriptionId, task);
  try {
    return await task;
  } finally {
    inFlight.delete(inscriptionId);
  }
};

/** Forget every cached answer. For tests. */
export const resetInscriptionParents = () => {
  cache.clear();
  inFlight.clear();
  loaded = false;
  try {
    storage()?.removeItem(STORE_KEY);
  } catch {
    // Nothing to remove.
  }
};
