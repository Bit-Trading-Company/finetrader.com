<!--
ord.net API docs — Buying
Source: https://developers.ord.net/reference/buying/
Retrieved: 2026-10-07
Mirrored for offline reference; ord.net is the source of truth.
-->

# Buying

A buy turns one or more active listings into a single signed transaction. You can buy a single listing or batch up to 20 per call.

The full sequence is **preflight → submit**. Preflight returns totals, selected payment inputs, and the PSBT the wallet must sign.

All endpoints require a bearer token. Tokens are issued only after verifying a funded payment address.

API requests do not accept referral codes or partner data and have no buyer-cookie referral. An API buy can still honor attribution already stored on its listings:

| Listings in the buy | Referral result |
| --- | --- |
| Every listing stores the same partner | Credit that partner |
| Stored partners differ | No referral |
| Any listing has no stored partner | No referral |

Selection uses listing rows, not the number of transferred inscriptions, so a lot or same-sat bundle counts as one listing. Partner status, payout address, and fee shares are resolved when the listing sells. An inactive or otherwise unpayable stored partner makes the transaction unreferred. A buy transaction contains at most one referral payout, and referral identity is not added to the API request or response.

## POST /collection/:slug/purchases/preflight

Builds the purchase PSBT.

### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes | Choose from `walletBindings` returned by `/auth/verify` or `GET /me`. |
| `paymentPublicKey` | string | yes | x-only or compressed hex public key for the payment address. |
| `listings` | array | yes | Listings to buy. Min 1, max 20. No duplicate `listingId` or `inscriptionId`. |
| `listings[].listingId` | string (UUID) | yes | The listing to buy. |
| `listings[].inscriptionId` | string | yes | Must match the listing’s inscription. |
| `spendableUtxos` | array | conditional | Up to 1000 candidate payment UTXOs. Required for API-created or non-Xverse bindings. Xverse bindings may omit it and use wallet-provider UTXO fallback. |
| `spendableUtxos[].txid` | string | yes | Lowercase hex (64 chars). |
| `spendableUtxos[].vout` | integer | yes | Non-negative. |
| `spendableUtxos[].valueSats` | integer | yes | Positive. |
| `roundUpDonation` | boolean | no | When `true`, include the configured initiative’s round-up contribution in the settlement. Defaults to `false`. |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555",
  "paymentPublicKey": "abcdef...",
  "listings": [
    {
      "listingId": "77777777-7777-7777-7777-777777777777",
      "inscriptionId": "abc123...i0"
    }
  ],
  "spendableUtxos": [
    {
      "txid": "deadbeef...",
      "vout": 0,
      "valueSats": 100000
    }
  ]
}
```

### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `listings` | array | Per-listing breakdown. |
| `listings[].listingId` | string (UUID) |  |
| `listings[].inscriptionId` | string |  |
| `listings[].priceSats` | integer | Seller’s asking price. |
| `listings[].inscriptionUtxoValueSats` | integer | Dust-paying value carried by the inscription UTXO. |
| `listings[].listingFeeSats` | integer | Marketplace listing fee component. |
| `listings[].buyerFeeBps` | integer | Buyer fee in basis points. |
| `listings[].buyerFeeSats` | integer | Buyer fee in sats. |
| `listings[].sellerCreatorRoyaltySats` | integer | Creator royalty paid by the seller. |
| `listings[].buyerCreatorRoyaltySats` | integer | Creator royalty paid by the buyer. |
| `listings[].sellerReceiveSats` | integer | What the seller nets after fees. |
| `listings[].buyerPayTotalSats` | integer | What the buyer pays for this listing all-in. |
| `listings[].marketplaceRevenueSats` | integer | Marketplace cut for this listing. |
| `listings[].creatorRevenueSats` | integer | Creator cut for this listing. |
| `selectedPaymentUtxos` | array | UTXOs the server chose to fund the package. |
| `selectedPaymentUtxos[].txid` | string |  |
| `selectedPaymentUtxos[].vout` | integer |  |
| `selectedPaymentUtxos[].valueSats` | integer |  |
| `targetFeeRateSatVb` | integer | Target fee rate in sat/vB. |
| `estimatedPackageVsize` | integer | Estimated package vsize in vB. |
| `estimatedNetworkFeeSats` | integer | Estimated miner fee in sats. |
| `cpfpFeeSats` | integer | Extra fee for CPFP if any. |
| `listingTransferFeeSats` | integer | Listing transfer fee component. |
| `totalBuyerCostSats` | integer | All-in buyer cost across the package. |
| `donationInitiative` | object or null | Available initiative name and URL, or `null` when donations are unavailable. |
| `donationSats` | integer | Donation included in `totalBuyerCostSats`; `0` unless requested. |
| `purchaseAnchorUtxoId` | string (UUID) | Send back at submit. |
| `steps` | array | One PSBT step. |
| `steps[].stepIndex` | integer | `0`. |
| `steps[].signerAddress` | string | Payment address. |
| `steps[].inputsToSign` | array | Same shape as listings. |
| `steps[].psbtBase64` | string | The unsigned PSBT. |
| `expectedSettlementTxid` | string | The settlement txid the server expects to broadcast. |
| `expectedListingTransferTxids` | string\[\] | One expected transfer txid per listing in `listings`, in the same order. |

```json
{
  "listings": [
    {
      "listingId": "77777777-7777-7777-7777-777777777777",
      "inscriptionId": "abc123...i0",
      "priceSats": 50000,
      "inscriptionUtxoValueSats": 546,
      "listingFeeSats": 0,
      "buyerFeeBps": 100,
      "buyerFeeSats": 500,
      "sellerCreatorRoyaltySats": 0,
      "buyerCreatorRoyaltySats": 500,
      "sellerReceiveSats": 49500,
      "buyerPayTotalSats": 51000,
      "marketplaceRevenueSats": 1000,
      "creatorRevenueSats": 500
    }
  ],
  "selectedPaymentUtxos": [
    {
      "txid": "deadbeef...",
      "vout": 0,
      "valueSats": 100000
    }
  ],
  "targetFeeRateSatVb": 1,
  "estimatedPackageVsize": 220,
  "estimatedNetworkFeeSats": 220,
  "cpfpFeeSats": 0,
  "listingTransferFeeSats": 0,
  "totalBuyerCostSats": 51220,
  "donationInitiative": {
    "name": "Open Ordinals",
    "url": "https://ordinals.org"
  },
  "donationSats": 0,
  "purchaseAnchorUtxoId": "88888888-8888-8888-8888-888888888888",
  "steps": [
    {
      "stepIndex": 0,
      "signerAddress": "bc1q...",
      "inputsToSign": [
        {
          "address": "bc1q...",
          "signingIndexes": [
            0
          ]
        }
      ],
      "psbtBase64": "<base64-psbt>"
    }
  ],
  "expectedSettlementTxid": "settle1...",
  "expectedListingTransferTxids": [
    "transfer1..."
  ]
}
```

### Status codes

-   `200`: PSBT returned.
-   `400`: invalid request body.
-   `401`: missing or invalid bearer token.
-   `403`: wallet not allowed.
-   `409`: listing state changed or the requested donation initiative is unavailable.
-   `429`: rate limited.
-   `503`: upstream trading service temporarily unavailable.

## POST /collection/:slug/purchases/submit

Broadcasts the purchase package after the wallet has signed.

### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes |  |
| `paymentPublicKey` | string | yes |  |
| `listings` | array | yes | Same as preflight. |
| `listings[].listingId` | string (UUID) | yes |  |
| `listings[].inscriptionId` | string | yes |  |
| `spendableUtxos` | array | yes | Same as preflight. |
| `spendableUtxos[].txid` | string | yes |  |
| `spendableUtxos[].vout` | integer | yes |  |
| `spendableUtxos[].valueSats` | integer | yes |  |
| `roundUpDonation` | boolean | no | Must repeat the value used at preflight. Defaults to `false`. |
| `purchaseAnchorUtxoId` | string (UUID) | yes | From preflight. |
| `selectedPaymentUtxos` | array | yes (min 1) | The exact UTXOs from `preflight.selectedPaymentUtxos`. |
| `selectedPaymentUtxos[].txid` | string | yes |  |
| `selectedPaymentUtxos[].vout` | integer | yes |  |
| `selectedPaymentUtxos[].valueSats` | integer | yes |  |
| `signedSteps` | array | yes | The wallet-signed `steps` from preflight. |
| `signedSteps[].stepIndex` | integer | yes |  |
| `signedSteps[].signerAddress` | string | yes |  |
| `signedSteps[].inputsToSign` | array | yes |  |
| `signedSteps[].psbtBase64` | string | yes | The signed PSBT. |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555",
  "paymentPublicKey": "abcdef...",
  "listings": [
    {
      "listingId": "77777777-7777-7777-7777-777777777777",
      "inscriptionId": "abc123...i0"
    }
  ],
  "spendableUtxos": [
    {
      "txid": "deadbeef...",
      "vout": 0,
      "valueSats": 100000
    }
  ],
  "purchaseAnchorUtxoId": "88888888-8888-8888-8888-888888888888",
  "selectedPaymentUtxos": [
    {
      "txid": "deadbeef...",
      "vout": 0,
      "valueSats": 100000
    }
  ],
  "signedSteps": [
    {
      "stepIndex": 0,
      "signerAddress": "bc1q...",
      "inputsToSign": [
        {
          "address": "bc1q...",
          "signingIndexes": [
            0
          ]
        }
      ],
      "psbtBase64": "<signed-base64-psbt>"
    }
  ]
}
```

### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `settlementTxid` | string | Broadcast settlement txid. |
| `listingTransferTxids` | string\[\] | One transfer txid per listing in `listings`, in the same order. |
| `pendingSaleIds` | string\[\] (UUID) | Pending sale records created by this purchase. |
| `listings` | array | Echoes the listings that were purchased. |
| `listings[].listingId` | string (UUID) |  |
| `listings[].inscriptionId` | string |  |

```json
{
  "settlementTxid": "settle1...",
  "listingTransferTxids": [
    "transfer1..."
  ],
  "pendingSaleIds": [
    "99999999-9999-9999-9999-999999999999"
  ],
  "listings": [
    {
      "listingId": "77777777-7777-7777-7777-777777777777",
      "inscriptionId": "abc123...i0"
    }
  ]
}
```

### Status codes

Same as preflight.

## Spendable UTXOs

`spendableUtxos` is the candidate set the server selects payment inputs from. API-created bindings use provider `unknown`, so they must send `spendableUtxos`. Xverse bindings may omit it at preflight and use wallet-provider UTXO fallback. At submit, send the exact `selectedPaymentUtxos` returned by preflight.

Rules:

-   No duplicate `(txid, vout)` pairs.
-   `txid` must be lowercase hex.
-   The cap on candidates is 1000 per call.

[Previous  
P2P Proposals](/reference/trading/)[Next  
Offers](/reference/offers/)
