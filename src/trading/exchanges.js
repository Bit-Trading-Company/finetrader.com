/**
 * Marketplace registry for trading.
 *
 * The auto-trade engine (./autoTradeEngine) and the AutoTrade page talk to a
 * marketplace only through its adapter. Exchange-independent helpers (token
 * ids, chain lookups, balances, the trading-fee transaction) live in
 * ./ordinals, ./chain and ./feeTransaction and are shared by every adapter.
 *
 * To add a marketplace, see docs/ADDING_A_MARKETPLACE.md.
 */

import { satflowAdapter } from './satflow/satflowAdapter';
import { ordnetAdapter } from './ordnet/ordnetAdapter';

/**
 * A marketplace integration. Items returned by the fetch methods use the
 * shape the engine expects: token/inscription ids readable by
 * getTokenId/getInscriptionId (./ordinals), `listed`, `listedPrice` (sats),
 * `mempoolTxId` ('' when nothing is pending) and `owner`.
 *
 * The engine passes a trailing `options` object to every method, typically
 * `{ wallet, wallets, network, collectionSymbol, selectedCollection }`.
 * Adapters that do not need it ignore it.
 *
 * @typedef {Object} MarketplaceAdapter
 * @property {string} id Value stored in AutoTrade settings (see TRADING_EXCHANGES).
 * @property {string} label Name shown in trading console logs.
 * @property {(inscriptionId: string) => string} getItemUrl Link shown in console logs.
 * @property {(collectionSymbol: string, bypassCache: boolean, options?: object) => Promise<object[]>} fetchCollectionItems
 *   Collection listings, cheapest first. options may include pageSize / page.
 * @property {(collectionSymbol: string, bypassCache: boolean, options?: object) => Promise<number|null>} getFloorPrice
 *   Floor price in sats, or null when unknown.
 * @property {(ownerAddress: string, collectionSymbol: string|null, bypassCache: boolean, options?: object) => Promise<object[]>} fetchWalletOrdinals
 *   Items held by an address, optionally filtered to one collection.
 * @property {(tokenId: string, expectedOwner: string, options?: object) => Promise<boolean>} checkPurchaseConfirmed
 *   True once expectedOwner holds the token.
 * @property {(ordinal: object, priceInSats: number, wallet: object, network: string, options?: object) => Promise<{ success: boolean, error?: string }>} listOrdinalWithProxyWallet
 * @property {(ordinal: object, wallet: object, network: string, options?: object) => Promise<{ success: boolean, error?: string }>} delistOrdinalWithProxyWallet
 * @property {(ordinal: object, wallet: object, network: string, addConsoleLog: Function|null, isStopRequested: Function|null, options?: object) => Promise<{ success: boolean, noPrepNeeded?: boolean, intentData?: object, signedPaymentPrepPSBT?: string, error?: string }>} prepareSecurePurchase
 *   First half of a purchase (signs any preparation step, broadcasts nothing).
 *   The engine forwards `signedPaymentPrepPSBT`, and `intentData` when
 *   `noPrepNeeded`, to completeSecurePurchase through options.
 * @property {(ordinal: object, wallet: object, network: string, addConsoleLog: Function|null, isStopRequested: Function|null, options?: object) => Promise<{ success: boolean, txid?: string, error?: string }>} completeSecurePurchase
 *   Signs and broadcasts the purchase.
 */

const ADAPTERS = [satflowAdapter, ordnetAdapter];

/** Exchange ids as stored in AutoTrade settings. */
export const TRADING_EXCHANGES = {
  SATFLOW: satflowAdapter.id,
  ORDNET: ordnetAdapter.id,
};

const ADAPTERS_BY_ID = Object.fromEntries(ADAPTERS.map((a) => [a.id, a]));

/**
 * Adapter for an exchange id. Unknown ids fall back to Satflow, the default
 * exchange.
 * @param {string} exchange
 * @returns {MarketplaceAdapter}
 */
export const getTradingApi = (exchange) =>
  ADAPTERS_BY_ID[exchange] || satflowAdapter;

/** Display name for an exchange id. */
export const getExchangeLabel = (exchange) => getTradingApi(exchange).label;

/** Console-log link for a listed inscription (null when the id is unknown). */
export const getItemLink = (inscriptionId, exchange) =>
  inscriptionId ? getTradingApi(exchange).getItemUrl(inscriptionId) : null;
