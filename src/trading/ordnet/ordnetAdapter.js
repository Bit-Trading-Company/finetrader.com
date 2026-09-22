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
import {
  fetchOrdNetCollections,
  searchOrdNetCollections,
} from './ordnetCollections';
import { EXCHANGE_IDS } from '../exchangeIds';

/** @type {import('../exchanges').MarketplaceAdapter} */
export const ordnetAdapter = {
  id: EXCHANGE_IDS.ORDNET,
  label: 'ord.net',
  getItemUrl: (inscriptionId) => `https://ord.net/inscription/${inscriptionId}`,
  // Reads go through a BIP-322 session signed by a proxy wallet.
  needsWalletForReads: true,
  // ord.net has no collections index; these derive one from the order book.
  fetchCollections: fetchOrdNetCollections,
  searchCollections: searchOrdNetCollections,
  fetchCollectionItems,
  getFloorPrice,
  fetchWalletOrdinals,
  checkPurchaseConfirmed,
  listOrdinalWithProxyWallet,
  delistOrdinalWithProxyWallet,
  prepareSecurePurchase,
  completeSecurePurchase,
};
