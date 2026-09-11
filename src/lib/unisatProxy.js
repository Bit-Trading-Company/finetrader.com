/**
 * URL for the same-origin UniSat indexer proxy (/api/unisat, server/unisat.js),
 * which adds the API key server-side and avoids browser CORS.
 *
 * @param {string} indexerPath e.g. `utxo/<txid>/<vout>` or `address/<address>/inscription-utxo-data`
 * @param {Record<string, unknown>} [query] extra query params; empty values are skipped
 * @returns {string}
 */
export const buildUnisatProxyUrl = (indexerPath, query = {}) => {
  const params = new URLSearchParams();
  params.set('path', String(indexerPath).replace(/^\/+/, ''));
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  return `/api/unisat?${params.toString()}`;
};
