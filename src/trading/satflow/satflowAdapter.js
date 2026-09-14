/**
 * Satflow marketplace adapter (contract: MarketplaceAdapter in ../exchanges).
 */

import {
  fetchCollectionItems,
  getFloorPrice,
  fetchWalletOrdinals,
  checkPurchaseConfirmed,
} from './satflowApi';
import {
  listOrdinalWithProxyWallet,
  delistOrdinalWithProxyWallet,
} from './satflowListing';
import {
  prepareSecurePurchase,
  completeSecurePurchase,
} from './satflowPurchase';
import {
  fetchTopCollections,
  searchCollections as searchSatflowCollections,
} from '../../features/marketplace/collectionsApi';

/** @type {import('../exchanges').MarketplaceAdapter} */
export const satflowAdapter = {
  id: 'satflow',
  label: 'Satflow',
  getItemUrl: (inscriptionId) =>
    `https://ordinals.com/inscription/${inscriptionId}`,
  // Satflow has real discovery endpoints, proxied to keep the API key server-side.
  fetchCollections: () => fetchTopCollections(),
  searchCollections: (query) => searchSatflowCollections(query),
  fetchCollectionItems,
  getFloorPrice,
  fetchWalletOrdinals,
  checkPurchaseConfirmed,
  listOrdinalWithProxyWallet,
  delistOrdinalWithProxyWallet,
  prepareSecurePurchase,
  completeSecurePurchase,
};
