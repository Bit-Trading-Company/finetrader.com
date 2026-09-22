/**
 * Satflow collection lookups.
 *
 * Both calls go through this app's own `/api` proxy rather than Satflow
 * directly, because the API key must stay server-side (see server/README and
 * docs/ARCHITECTURE.md).
 *
 * Every collection returned here is stamped with the exchange it came from.
 * Satflow and ord.net both call their identifier a "slug" and both store it
 * in `collectionSymbol`, but the two are separate namespaces — a Satflow slug
 * means nothing to ord.net. Without the stamp nothing downstream could tell
 * them apart, and a collection picked on one marketplace would be sent to the
 * other's API. See tagCollections / collectionMatchesExchange below.
 */
import { EXCHANGE_IDS } from '../../trading/exchangeIds';

/**
 * @typedef {object} Collection
 * @property {string} collectionSymbol the slug the trading APIs expect
 * @property {string} collectionId
 * @property {string} name
 * @property {string} [image]
 * @property {number} [totalSupply]
 * @property {number} [fp] floor price, in sats
 * @property {number} [listedCount]
 * @property {number} [vol1d]
 * @property {number} [vol7d]
 * @property {number} [totalVol]
 * @property {import('../../trading/exchangeIds').ExchangeId} exchange which
 *   marketplace this came from, and the only one it can be traded on
 */

/**
 * Stamp a marketplace's collections with its id.
 * @param {object[]} collections
 * @param {import('../../trading/exchangeIds').ExchangeId} exchange
 * @returns {Collection[]}
 */
export const tagCollections = (collections, exchange) =>
  (Array.isArray(collections) ? collections : []).map((collection) => ({
    ...collection,
    exchange,
  }));

const asJson = async (response) => {
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

/**
 * The most active collections, as shown by default.
 * @returns {Promise<Collection[]>}
 */
export const fetchTopCollections = async () => {
  const data = await asJson(
    await fetch('/api/satflow-top-collections', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
  );
  return tagCollections(data.collections, EXCHANGE_IDS.SATFLOW);
};

/**
 * Satflow's search endpoint answers in more than one shape depending on which
 * upstream served it: a plain `{collections}` / `{collectionsV2}` object, or a
 * tRPC batch envelope. Normalize both to {@link Collection}.
 */
const normalizeSearchResponse = (data) => {
  const direct = data?.collectionsV2 ?? data?.collections ?? null;
  if (Array.isArray(direct)) return direct;

  const ordinals = Array.isArray(data)
    ? data[0]?.result?.data?.json?.results?.ordinals
    : null;
  if (!Array.isArray(ordinals)) return [];

  return ordinals.map((c) => {
    const memflow = c.memflowData || {};
    const meta = c.metadata || c;
    return {
      collectionSymbol: c.id,
      collectionId: c.id,
      name: c.name || meta?.name || c.id,
      image: c.image_url || meta?.image_url,
      totalSupply: c.item_count != null ? Number(c.item_count) : 0,
      totalVol:
        memflow.totalVolume != null ? Number(memflow.totalVolume) : null,
      fp: memflow.floorPrice != null ? Number(memflow.floorPrice) : null,
      currency: 'BTC',
    };
  });
};

/**
 * Search collections by name.
 * @param {string} pattern
 * @returns {Promise<Collection[]>} empty for a blank pattern
 */
export const searchCollections = async (pattern) => {
  const term = (pattern || '').trim();
  if (!term) return [];

  const params = new URLSearchParams({ q: term });
  const data = await asJson(
    await fetch(`/api/satflow-search?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
  );
  return tagCollections(normalizeSearchResponse(data), EXCHANGE_IDS.SATFLOW);
};

/**
 * The slug the trading APIs identify a collection by. Collections arrive from
 * several endpoints that each name this field differently.
 * @param {Collection|null} collection
 * @returns {string|null}
 */
export const getCollectionSlug = (collection) =>
  collection?.collectionSymbol ||
  collection?.symbol ||
  collection?.collectionId ||
  null;

/**
 * The marketplace a collection belongs to, or null for one that predates the
 * stamp (or came from somewhere that does not set it).
 * @param {object|null} collection
 * @returns {import('../../trading/exchangeIds').ExchangeId|null}
 */
export const getCollectionExchange = (collection) =>
  collection?.exchange || null;

/**
 * Whether a collection can be traded on `exchange`.
 *
 * An untagged collection is treated as a match: it is the pre-existing shape,
 * and refusing to trade it would break a flow that works today rather than
 * preventing a real mistake.
 *
 * @param {object|null} collection
 * @param {import('../../trading/exchangeIds').ExchangeId} exchange
 * @returns {boolean}
 */
export const collectionMatchesExchange = (collection, exchange) => {
  if (!collection) return false;
  const from = getCollectionExchange(collection);
  return !from || from === exchange;
};
