/**
 * ord.net marketplace adapter (contract: MarketplaceAdapter in ../exchanges).
 */

import {
  fetchCollectionItems,
  getFloorPrice,
  fetchWalletOrdinals,
  checkPurchaseConfirmed,
  listOrdinalWithProxyWallet,
  delistOrdinalWithProxyWallet,
  prepareSecurePurchase,
  completeSecurePurchase,
} from './ordnetTrading';

/** @type {import('../exchanges').MarketplaceAdapter} */
export const ordnetAdapter = {
  id: 'ordnet',
  label: 'ord.net',
  getItemUrl: (inscriptionId) => `https://ord.net/inscription/${inscriptionId}`,
  fetchCollectionItems,
  getFloorPrice,
  fetchWalletOrdinals,
  checkPurchaseConfirmed,
  listOrdinalWithProxyWallet,
  delistOrdinalWithProxyWallet,
  prepareSecurePurchase,
  completeSecurePurchase,
};
