/**
 * Collection lookups, shared by every collection picker in the app.
 *
 * Both calls go through this app's own `/api` proxy rather than Satflow
 * directly, because the API key must stay server-side (see server/README and
 * docs/ARCHITECTURE.md).
 */

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
 */

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
  return Array.isArray(data.collections) ? data.collections : [];
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
  return normalizeSearchResponse(data);
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
