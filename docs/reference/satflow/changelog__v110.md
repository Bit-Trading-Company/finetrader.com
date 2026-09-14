<!--
Satflow docs — v1.1.0
Source: https://docs.satflow.com/changelog/v110.md
Retrieved: 2026-09-14
Mirrored for offline reference; the vendor is the source of truth.
-->

Fetch the complete documentation index at: https://docs.satflow.com/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# v1.1.0

# API Changelog: v1.0.0 → v1.1.0

## Overview

This changelog documents the path and parameter changes between the production API (v1.0.0) and the new development version (v1.1.0) of the Satflow Marketplace API.

## Version Information

* **Production Version**: 1.0.0 (Native Marketplace API)
* **Development Version**: 1.1.0 (Satflow Marketplace API)
* **Server URLs**:
  * Production: `https://native.satflow.com`
  * Development: `https://api.satflow.com`

## Endpoint Changes

### 1. `/item` → `/rest/item`

**Method**: `GET` → `GET`**Parameters**:

* `inscription_id` → `inscriptionId`
* `inscription_number` → `inscriptionNumber`
* `metadata` (unchanged)
* `bid` (unchanged)
* `listing` (unchanged)

### 2. `/collectionStats` → `/rest/collection-stats`

**Method**: `GET` → `GET`**Parameters**:

* `collection_id` → `collectionId` (both query parameters)

### 3. `/biddingWallet/address` → `/rest/address/bidding-wallet`

**Method**: `GET` → `GET`**Parameters**:

* `ordinalsAddress` (unchanged - query parameter)
* `paymentAddress` (unchanged - query parameter)
* `paymentPubkey` (unchanged - query parameter)

### 4. `/walletBids` → `/rest/address/bids`

**Method**: `GET` → `GET`**Parameters**: No parameter name changes

### 5. `/intent/sell` → `/rest/intent/sell`

**Method**: `POST` → `POST`**Parameters**: No parameter name changes

### 6. `/intent/bulkSell` → `/rest/intent/bulk-sell`

**Method**: `POST` → `POST`**Parameters**: No parameter name changes

### 7. `/intent/accept` → `/rest/intent/accept`

**Method**: `POST` → `POST`**Parameters**: No parameter name changes

### 8. `/intent/withdraw` → `/rest/intent/withdraw`

**Method**: `POST` → `POST`**Parameters**: No parameter name changes

### 9. `/withdraw` → `/rest/withdraw`

**Method**: `POST` → `POST`**Parameters**: No parameter name changes

### 10. `/list` → `/rest/list`

**Method**: `POST` → `POST`**Parameters**: No parameter name changes

### 11. `/acceptCollectionBid` → `/rest/intent/accept-collection-bid`

**Method**: `POST` → `POST`**Parameters**: No parameter name changes

### 12. `/cancel` → `/rest/cancel`

**Method**: `POST` → `POST`**Parameters**: No parameter name changes

### 13. `/fillBid` → `/rest/bid/fill`

**Method**: `POST` → `POST`**Parameters**: No parameter name changes

### 14. `/listings` → `/rest/activity/listings`

**Method**: `GET` → `GET`**Parameters**: No parameter name changes

### 15. `/bids` → `/rest/activity/bids`

**Method**: `GET` → `GET`**Parameters**: No parameter name changes

### 16. `/sales` → `/rest/activity/sales`

**Method**: `GET` → `GET`**Parameters**: No parameter name changes

### 17. `/satflow/getChallenge` → `/rest/challenge`

**Method**: `GET` → `GET`**Parameters**:

* `address` (unchanged - query parameter)

### 18. `/satflow/verifyChallenge` → `/rest/challenge/verify`

**Method**: `GET` → `GET`**Parameters**:

* `address` (unchanged - query parameter)
* `signature` (unchanged - query parameter)
* `isAuth` (query) → removed

### 19. `/bid` → `/rest/bid/place`

**Method**: `POST` → `POST`**Status**: Replaced and enhanced
**Parameters**: Enhanced to support both inscription and collection bids
**Functionality**: Place bids on inscriptions or collections

## Breaking Changes Summary

1. **Path Changes**: All endpoints now have `/rest/` prefix
2. **Parameter Name Changes**:
   * `inscription_id` → `inscriptionId`
   * `inscription_number` → `inscriptionNumber`
   * `collection_id` → `collectionId`
3. **Removed Parameters**:
   * Challenge verify: `isAuth` parameter removed
4. **Enhanced Endpoints**:
   * `/bid` → `/rest/bid/place` (enhanced to support both inscription and collection bids)

## Support

For questions about this migration or API changes, please contact support on [Discord](https://discord.gg/satflow).