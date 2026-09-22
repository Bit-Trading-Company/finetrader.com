/**
 * Marketplace ids, on their own so anything can name an exchange.
 *
 * These live apart from exchanges.js because that module imports the
 * adapters, and the adapters' own data sources need to stamp their
 * collections with the exchange they came from — importing exchanges.js from
 * there would close a cycle.
 */

/** @typedef {'satflow'|'ordnet'} ExchangeId */

/** @type {{SATFLOW: ExchangeId, ORDNET: ExchangeId}} */
export const EXCHANGE_IDS = {
  SATFLOW: 'satflow',
  ORDNET: 'ordnet',
};
