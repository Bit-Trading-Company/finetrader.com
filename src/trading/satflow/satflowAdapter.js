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

/** @type {import('../exchanges').MarketplaceAdapter} */
export const satflowAdapter = {
  id: 'satflow',
  label: 'Satflow',
  getItemUrl: (inscriptionId) =>
    `https://ordinals.com/inscription/${inscriptionId}`,
  fetchCollectionItems,
  getFloorPrice,
  fetchWalletOrdinals,
  checkPurchaseConfirmed,
  listOrdinalWithProxyWallet,
  delistOrdinalWithProxyWallet,
  prepareSecurePurchase,
  completeSecurePurchase,
};
