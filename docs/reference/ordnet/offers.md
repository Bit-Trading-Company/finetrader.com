<!--
ord.net API docs — Offers
Source: https://developers.ord.net/reference/offers/
Retrieved: 2026-09-14
Mirrored for offline reference; ord.net is the source of truth.
-->

# Offers

Offers are buy-side bids. Inscription offers target one inscription; collection offers target a whole collection or a trait scope. The buyer signs offer funding PSBTs. The seller can accept eligible offers before settlement.

Reads and writes need a bearer token. Tokens are issued only after verifying a funded payment address. Inscription-offer creation stays under `/collection/:slug/offers/...`. Collection-wide and trait offers use `/collection/:slug/collection-offers/...`.

This page covers these flows:

-   **Any wallet**: read active offers, read offer history.
-   **Buyer**: create an inscription offer, create/cancel a collection offer.
-   **Seller**: accept an offer, reject an offer, counter an offer.
-   **Seller**: fill an eligible collection offer.
-   **Buyer**: accept a counter, reject a counter.
-   **You**: read your offers across all inscriptions (`GET /me/offers`).

## Status and kind values

Offers carry a `status` and a `kind`. The full enums:

| `status` | When |
| --- | --- |
| `active` | Offer is live and waiting for action. |
| `accepted` | Trade settled on-chain. |
| `rejected` | Counterparty declined. |
| `cancelled` | Originator cancelled. |
| `expired` | `validityHours` elapsed without action. |
| `invalidated` | Locked PSBT inputs are no longer spendable. |

| `kind` | What it is |
| --- | --- |
| `buyer_offer` | A buyer’s bid on an inscription. |
| `seller_counter` | A seller’s counter on a parent buyer offer. |

## Collection offers

Collection offers are active bids on either every eligible inscription in a collection or a trait-filtered subset. They use the `/collection/:slug/collection-offers/...` namespace. Do not confuse this with `/collection/:slug/offers/...`, which creates inscription-specific buyer offers for provided inscription ids.

Targets use one of two shapes:

```json
{
  "kind": "all"
}
```

```json
{
  "kind": "traits",
  "traits": [
    {
      "type": "Background",
      "values": [
        "Gold",
        "Silver"
      ]
    }
  ]
}
```

### GET /collection/:slug/collection-offers

Returns active collection and trait offers for the collection.

```json
{
  "rows": [
    {
      "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "target": {
        "kind": "all"
      },
      "scopeLabel": "Collection",
      "priceSats": 100000,
      "eligibleCount": 500,
      "makerAddress": "bc1q...",
      "expiresAt": "2026-05-15T18:00:00.000Z",
      "createdAt": "2026-05-08T18:00:00.000Z",
      "totalSats": 100000,
      "status": "active",
      "sampleInscription": null
    }
  ],
  "totalCount": 1,
  "collectionOfferCount": 1,
  "traitOfferCount": 0
}
```

### GET /collection/:slug/my/sent-collection-offers

Returns active collection offers sent by your linked wallets. Rows may include `actionBindingId` for cancellation.

### POST /collection/:slug/collection-offers/target-preview

Previews target eligibility, floor, and a sample inscription before building funding PSBTs.

```json
{
  "target": {
    "kind": "all"
  }
}
```

```json
{
  "target": {
    "kind": "all"
  },
  "eligibleCount": 500,
  "floorSats": 120000,
  "collectionFloorSats": 120000,
  "sampleInscription": {
    "inscriptionId": "abc123...i0",
    "image": "https://...",
    "previewContentType": "image/png"
  }
}
```

### POST /collection/:slug/collection-offers/replacement-warning

Checks whether the selected payment inputs would replace active same-scope collection offers from the same buyer. `priceSats` must be at least `10000` and a multiple of `5000`; `offerCount` defaults to `1` and is capped at `10`.

```json
{
  "walletBindingId": "55555555-5555-4555-8555-555555555555",
  "target": {
    "kind": "all"
  },
  "priceSats": 100000,
  "offerCount": 1,
  "ladderStepSats": 0,
  "spendableUtxos": [
    {
      "txid": "deadbeef...",
      "vout": 0,
      "valueSats": 200000
    }
  ]
}
```

```json
{
  "replacementWarning": {
    "activeOfferCount": 1
  }
}
```

### POST /collection/:slug/collection-offers/preflight

Builds one zero-fee funding-parent PSBT per requested collection offer. `priceSats` must be at least `10000` and a multiple of `5000`; `offerCount` defaults to `1` and is capped at `10`; `validityHours` defaults to `168` when omitted. Each returned offer can include up to `50` selected payment UTXOs.

```json
{
  "walletBindingId": "55555555-5555-4555-8555-555555555555",
  "ordinalsPublicKey": "abcdef...",
  "paymentPublicKey": "abcdef...",
  "target": {
    "kind": "all"
  },
  "priceSats": 100000,
  "offerCount": 1,
  "ladderStepSats": 0,
  "validityHours": 168,
  "spendableUtxos": [
    {
      "txid": "deadbeef...",
      "vout": 0,
      "valueSats": 200000
    }
  ]
}
```

```json
{
  "criteriaCanonicalJson": "{\"v\":1,...}",
  "offerCriteriaHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "eligibleRoot": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "eligibleCount": 500,
  "buyerReceiveScriptHex": "5120...",
  "offers": [
    {
      "priceSats": 100000,
      "offerAddress": "bc1p...",
      "offerScriptHex": "20...",
      "offerAuthSecretHash": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "selectedPaymentUtxos": [
        {
          "txid": "deadbeef...",
          "vout": 0,
          "valueSats": 200000
        }
      ],
      "fundingParentFeeRateSatVb": 0,
      "fundingBroadcasted": false,
      "expectedFundingParentTxid": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "fundingParentVout": 0,
      "preflightToken": "...",
      "fundingParentStep": {
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
    }
  ]
}
```

### POST /collection/:slug/collection-offers/submit

Submits the signed funding-parent PSBTs from preflight. Submit the same offer count and selected payment UTXOs returned by preflight; each offer accepts up to `50` selected payment UTXOs. Root `spendableUtxos` can be omitted because submit revalidates `offers[].selectedPaymentUtxos`.

```json
{
  "walletBindingId": "55555555-5555-4555-8555-555555555555",
  "ordinalsPublicKey": "abcdef...",
  "paymentPublicKey": "abcdef...",
  "target": {
    "kind": "all"
  },
  "priceSats": 100000,
  "offerCount": 1,
  "ladderStepSats": 0,
  "validityHours": 168,
  "offers": [
    {
      "priceSats": 100000,
      "selectedPaymentUtxos": [
        {
          "txid": "deadbeef...",
          "vout": 0,
          "valueSats": 200000
        }
      ],
      "expectedFundingParentTxid": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "fundingParentVout": 0,
      "preflightToken": "...",
      "signedFundingParentStep": {
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
    }
  ]
}
```

```json
{
  "status": "active",
  "offers": [
    {
      "offerId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "status": "active",
      "priceSats": 100000,
      "fundingParentTxid": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "fundingParentVout": 0,
      "fundingParentFeeRateSatVb": 0,
      "fundingBroadcasted": false
    }
  ]
}
```

### POST /collection/:slug/collection-offers/:offerId/cancel

Cancels your active collection offer.

```json
{
  "walletBindingId": "55555555-5555-4555-8555-555555555555"
}
```

```json
{
  "offerId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "status": "cancelled"
}
```

### POST /collection/:slug/collection-offers/:offerId/fill/preflight

Builds the seller PSBT to accept a collection offer for a matching inscription.

```json
{
  "walletBindingId": "55555555-5555-4555-8555-555555555555",
  "ordinalsPublicKey": "abcdef...",
  "offerId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "inscriptionId": "abc123...i0"
}
```

```json
{
  "offerId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "inscriptionId": "abc123...i0",
  "sellerReceiveSats": 97500,
  "inscriptionUtxoValueSats": 546,
  "marketplaceFeeSats": 2500,
  "creatorRoyaltySats": 0,
  "targetFeeRateSatVb": 1,
  "estimatedNetworkFeeSats": 220,
  "belowTopOfferWarning": null,
  "expectedSettlementTxid": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "admissionAnchorUtxoId": "77777777-7777-4777-8777-777777777777",
  "sellerStep": {
    "stepIndex": 0,
    "signerAddress": "bc1p...",
    "inputsToSign": [
      {
        "address": "bc1p...",
        "signingIndexes": [
          0
        ]
      }
    ],
    "psbtBase64": "<base64-psbt>"
  }
}
```

### POST /collection/:slug/collection-offers/:offerId/fill/submit

Submits the signed seller PSBT and broadcasts the collection-offer settlement package.

```json
{
  "walletBindingId": "55555555-5555-4555-8555-555555555555",
  "ordinalsPublicKey": "abcdef...",
  "offerId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "inscriptionId": "abc123...i0",
  "targetFeeRateSatVb": 1,
  "expectedSettlementTxid": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "admissionAnchorUtxoId": "77777777-7777-4777-8777-777777777777",
  "signedSellerStep": {
    "stepIndex": 0,
    "signerAddress": "bc1p...",
    "inputsToSign": [
      {
        "address": "bc1p...",
        "signingIndexes": [
          0
        ]
      }
    ],
    "psbtBase64": "<signed-base64-psbt>"
  }
}
```

```json
{
  "offerId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "fillAttemptId": "88888888-8888-4888-8888-888888888888",
  "status": "broadcast",
  "settlementTxid": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
}
```

## GET /inscriptions/:id/offers

Returns active offers and counters on the inscription, including counteroffer visibility for your wallet.

### Path parameters

| Name | Type | Description |
| --- | --- | --- |
| `id` | string | The inscription id. |

### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `inscriptionId` | string |  |
| `ownerAddress` | string | Current owner address. |
| `topOfferSats` | integer | null | Highest active offer in SATS. |
| `liveOfferCount` | integer | Count of active offers and counters. |
| `expiringSoonCount` | integer | Count of offers near expiry. |
| `offers` | array | Offer rows. |
| `offers[].id` | string (UUID) | The offer id. |
| `offers[].parentOfferId` | string (UUID) | null | Set when `kind` is `seller_counter`. |
| `offers[].kind` | string | `buyer_offer` or `seller_counter`. |
| `offers[].status` | string | See status table above. |
| `offers[].inscriptionId` | string |  |
| `offers[].buyerAddress` | string |  |
| `offers[].sellerAddress` | string |  |
| `offers[].createdAt` | ISO datetime |  |
| `offers[].expiresAt` | ISO datetime |  |
| `offers[].acceptedAt` | string | null |  |
| `offers[].rejectedAt` | string | null |  |
| `offers[].cancelledAt` | string | null |  |
| `offers[].floorSats` | integer | null | Floor for the inscription’s collection at offer time. |
| `offers[].topOfferSats` | integer | null | Top offer at offer time. |
| `offers[].settlementTxid` | string | null | Set after acceptance. |
| `offers[].priceSats` | integer | Offer price. |
| `offers[].inscriptionUtxoValueSats` | integer | Dust-paying value carried by the inscription UTXO. |
| `offers[].sellerMarketplaceFeeBps` | integer |  |
| `offers[].sellerMarketplaceFeeSats` | integer |  |
| `offers[].buyerMarketplaceFeeBps` | integer |  |
| `offers[].buyerMarketplaceFeeSats` | integer |  |
| `offers[].sellerCreatorRoyaltyBps` | integer |  |
| `offers[].sellerCreatorRoyaltySats` | integer |  |
| `offers[].buyerCreatorRoyaltyBps` | integer |  |
| `offers[].buyerCreatorRoyaltySats` | integer |  |
| `offers[].sellerReceiveSats` | integer |  |
| `offers[].buyerPayTotalSats` | integer |  |
| `offers[].marketplaceRevenueSats` | integer |  |
| `offers[].creatorRevenueSats` | integer |  |

```json
{
  "inscriptionId": "abc123...i0",
  "ownerAddress": "bc1p...",
  "topOfferSats": 60000,
  "liveOfferCount": 2,
  "expiringSoonCount": 0,
  "offers": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "parentOfferId": null,
      "kind": "buyer_offer",
      "status": "active",
      "inscriptionId": "abc123...i0",
      "buyerAddress": "bc1q...",
      "sellerAddress": "bc1p...",
      "createdAt": "2026-05-08T18:00:00.000Z",
      "expiresAt": "2026-05-15T18:00:00.000Z",
      "acceptedAt": null,
      "rejectedAt": null,
      "cancelledAt": null,
      "floorSats": 45000,
      "topOfferSats": 60000,
      "settlementTxid": null,
      "priceSats": 50000,
      "inscriptionUtxoValueSats": 546,
      "sellerMarketplaceFeeBps": 100,
      "sellerMarketplaceFeeSats": 500,
      "buyerMarketplaceFeeBps": 100,
      "buyerMarketplaceFeeSats": 500,
      "sellerCreatorRoyaltyBps": 0,
      "sellerCreatorRoyaltySats": 0,
      "buyerCreatorRoyaltyBps": 100,
      "buyerCreatorRoyaltySats": 500,
      "sellerReceiveSats": 49500,
      "buyerPayTotalSats": 51000,
      "marketplaceRevenueSats": 1000,
      "creatorRevenueSats": 500
    }
  ]
}
```

## GET /inscriptions/:id/offers/history

Page-paginated history of offers on the inscription.

### Query parameters

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | integer | `0` | Zero-indexed page. Min `0`, max `100`. Page size is fixed at 25. |

### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `inscriptionId` | string |  |
| `offers` | array | Same shape as the active offers response. |
| `hasMore` | boolean | More pages exist. |
| `page` | integer | Current page. |

```json
{
  "inscriptionId": "abc123...i0",
  "offers": [
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "parentOfferId": null,
      "kind": "buyer_offer",
      "status": "expired",
      "inscriptionId": "abc123...i0",
      "buyerAddress": "bc1q...",
      "sellerAddress": "bc1p...",
      "createdAt": "2026-04-01T12:00:00.000Z",
      "expiresAt": "2026-04-08T12:00:00.000Z",
      "acceptedAt": null,
      "rejectedAt": null,
      "cancelledAt": null,
      "floorSats": 40000,
      "topOfferSats": 50000,
      "settlementTxid": null,
      "priceSats": 45000,
      "inscriptionUtxoValueSats": 546,
      "sellerMarketplaceFeeBps": 100,
      "sellerMarketplaceFeeSats": 450,
      "buyerMarketplaceFeeBps": 100,
      "buyerMarketplaceFeeSats": 450,
      "sellerCreatorRoyaltyBps": 0,
      "sellerCreatorRoyaltySats": 0,
      "buyerCreatorRoyaltyBps": 100,
      "buyerCreatorRoyaltySats": 450,
      "sellerReceiveSats": 44550,
      "buyerPayTotalSats": 45900,
      "marketplaceRevenueSats": 900,
      "creatorRevenueSats": 450
    }
  ],
  "hasMore": false,
  "page": 0
}
```

## Create an offer (buyer)

Two calls: preflight to build offer PSBTs, submit to lock them in. The buyer’s PSBT carries payment inputs that release if the seller accepts. Creation is collection-scoped so floor checks use the selected collection. Each create-offer request can include 1 to 20 inscription ids.

### POST /collection/:slug/offers/preflight

#### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes |  |
| `paymentPublicKey` | string | yes | Hex public key for the payment address. |
| `inscriptionIds` | array | yes | 1 to 20 inscription ids in this collection. Duplicate ids are rejected. |
| `priceSats` | integer | yes | Offer price in SATS. Must meet the configured minimum and be a multiple of 1,000 SATS. |
| `validityHours` | integer | no | One of `12`, `24`, `168` (7 days), `720` (30 days), `2160` (90 days). Defaults to `168`. |
| `spendableUtxos` | array | conditional | Up to 1000 candidate payment UTXOs. Required for API-created or non-Xverse bindings. Xverse bindings may omit it and use wallet-provider UTXO fallback. |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555",
  "paymentPublicKey": "abcdef...",
  "inscriptionIds": [
    "abc123...i0"
  ],
  "priceSats": 50000,
  "validityHours": 168,
  "spendableUtxos": [
    {
      "txid": "deadbeef...",
      "vout": 0,
      "valueSats": 100000
    }
  ]
}
```

#### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `selectedPaymentUtxos` | array | UTXOs the server chose. |
| `items` | array | One preflight item per inscription. |
| `items[].inscriptionId` | string |  |
| `items[].priceSats` | integer |  |
| `items[].buyerPayTotalSats` | integer |  |
| `items[].expectedSettlementTxid` | string |  |
| `items[].steps` | array | One PSBT step. |

```json
{
  "selectedPaymentUtxos": [
    {
      "txid": "deadbeef...",
      "vout": 0,
      "valueSats": 100000
    }
  ],
  "items": [
    {
      "inscriptionId": "abc123...i0",
      "priceSats": 50000,
      "buyerPayTotalSats": 51000,
      "expectedSettlementTxid": "settle1...",
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
      ]
    }
  ]
}
```

### POST /collection/:slug/offers/submit

#### Request body

The preflight body, plus signed items:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes |  |
| `paymentPublicKey` | string | yes |  |
| `inscriptionIds` | array | yes | Same 1 to 20 ids as preflight. |
| `priceSats` | integer | yes | Same as preflight. |
| `validityHours` | integer | no | Same as preflight. Defaults to `168` when omitted. |
| `selectedPaymentUtxos` | array | yes (min 1) | The exact UTXOs from preflight. |
| `signedItems` | array | yes | One signed item per preflight item. |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555",
  "paymentPublicKey": "abcdef...",
  "inscriptionIds": [
    "abc123...i0"
  ],
  "priceSats": 50000,
  "validityHours": 168,
  "selectedPaymentUtxos": [
    {
      "txid": "deadbeef...",
      "vout": 0,
      "valueSats": 100000
    }
  ],
  "signedItems": [
    {
      "inscriptionId": "abc123...i0",
      "expectedSettlementTxid": "settle1...",
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
  ]
}
```

#### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `items` | array | Created offer rows. |
| `items[].inscriptionId` | string |  |
| `items[].offerId` | string (UUID) |  |
| `items[].status` | string | Always `active` on success. |
| `status` | string | Always `active` on success. |

```json
{
  "items": [
    {
      "inscriptionId": "abc123...i0",
      "offerId": "33333333-3333-3333-3333-333333333333",
      "status": "active"
    }
  ],
  "status": "active"
}
```

## Cancel or reject an offer

These calls do not take a PSBT.

-   `POST /inscriptions/:id/offers/:offerId/cancel`: buyer cancels their own offer.
-   `POST /inscriptions/:id/offers/:offerId/reject`: seller declines an offer they received.

### Path parameters (both)

| Name | Type | Description |
| --- | --- | --- |
| `id` | string | Inscription id. |
| `offerId` | string (UUID) | Offer id. |

### Request body (both)

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes |  |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555"
}
```

### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `offerId` | string (UUID) |  |
| `status` | string | `cancelled` for cancel, `rejected` for reject. |

```json
{
  "offerId": "33333333-3333-3333-3333-333333333333",
  "status": "cancelled"
}
```

## Accept an offer (seller)

Two calls. The seller signs the seller side and the result broadcasts.

### POST /inscriptions/:id/offers/:offerId/accept/preflight

#### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes |  |
| `ordinalsPublicKey` | string | yes | Public key for the ordinals address. |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555",
  "ordinalsPublicKey": "abcdef..."
}
```

#### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `offerId` | string (UUID) |  |
| `targetFeeRateSatVb` | integer |  |
| `estimatedNetworkFeeSats` | integer |  |
| `expectedSettlementTxid` | string |  |
| `expectedPayoutTxid` | string | null | A separate payout tx, when one is needed. |
| `steps` | array | One or two PSBT steps. |
| `steps[].stepIndex` | integer | `0` (and possibly `1`). |
| `steps[].signerAddress` | string |  |
| `steps[].inputsToSign` | array |  |
| `steps[].psbtBase64` | string |  |

```json
{
  "offerId": "33333333-3333-3333-3333-333333333333",
  "targetFeeRateSatVb": 1,
  "estimatedNetworkFeeSats": 220,
  "expectedSettlementTxid": "settle1...",
  "expectedPayoutTxid": null,
  "steps": [
    {
      "stepIndex": 0,
      "signerAddress": "bc1p...",
      "inputsToSign": [
        {
          "address": "bc1p...",
          "signingIndexes": [
            0
          ],
          "sigHash": 131
        }
      ],
      "psbtBase64": "<base64-psbt>"
    }
  ]
}
```

### POST /inscriptions/:id/offers/:offerId/accept/submit

#### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes |  |
| `ordinalsPublicKey` | string | yes | Same as preflight. |
| `expectedSettlementTxid` | string | yes | From preflight. |
| `expectedPayoutTxid` | string | null | yes | From preflight. May be null. |
| `signedSteps` | array | yes | Wallet-signed steps. |
| `signedSteps[].stepIndex` | integer | yes |  |
| `signedSteps[].signerAddress` | string | yes |  |
| `signedSteps[].inputsToSign` | array | yes |  |
| `signedSteps[].psbtBase64` | string | yes |  |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555",
  "ordinalsPublicKey": "abcdef...",
  "expectedSettlementTxid": "settle1...",
  "expectedPayoutTxid": null,
  "signedSteps": [
    {
      "stepIndex": 0,
      "signerAddress": "bc1p...",
      "inputsToSign": [
        {
          "address": "bc1p...",
          "signingIndexes": [
            0
          ],
          "sigHash": 131
        }
      ],
      "psbtBase64": "<signed-base64-psbt>"
    }
  ]
}
```

#### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `offerId` | string (UUID) |  |
| `settlementTxid` | string | Broadcast settlement txid. |
| `payoutTxid` | string | null | Broadcast payout txid, when applicable. |
| `status` | string | Always `accepted` on success. |

```json
{
  "offerId": "33333333-3333-3333-3333-333333333333",
  "settlementTxid": "settle1...",
  "payoutTxid": null,
  "status": "accepted"
}
```

## Counter an offer (seller)

A counter is the seller’s price on the same inscription. It sits on the offer as a pending counter until the buyer accepts, rejects, or it expires.

The counter PSBT has three steps:

| Step | Sighash | Purpose |
| --- | --- | --- |
| `0` | `DEFAULT` | Transfer the inscription. |
| `1` | `ALL | ANYONECANPAY` | Settlement. |
| `2` | `ALL | ANYONECANPAY` | Recovery. |

### POST /inscriptions/:id/offers/:offerId/counter/preflight

#### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes |  |
| `ordinalsPublicKey` | string | yes |  |
| `priceSats` | integer | yes | Counter price in SATS. Must beat the current buyer offer by at least 1,000 SATS and be a multiple of 1,000 SATS. |
| `validityHours` | integer | no | One of `12`, `24`, `168`, `720`, `2160`. Defaults to `168`. |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555",
  "ordinalsPublicKey": "abcdef...",
  "priceSats": 60000,
  "validityHours": 24
}
```

#### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `priceSats` | integer |  |
| `inscriptionUtxoValueSats` | integer |  |
| `sellerMarketplaceFeeBps` | integer |  |
| `sellerMarketplaceFeeSats` | integer |  |
| `buyerMarketplaceFeeBps` | integer |  |
| `buyerMarketplaceFeeSats` | integer |  |
| `sellerCreatorRoyaltyBps` | integer |  |
| `sellerCreatorRoyaltySats` | integer |  |
| `buyerCreatorRoyaltyBps` | integer |  |
| `buyerCreatorRoyaltySats` | integer |  |
| `sellerReceiveSats` | integer |  |
| `buyerPayTotalSats` | integer |  |
| `marketplaceRevenueSats` | integer |  |
| `creatorRevenueSats` | integer |  |
| `anchorUtxoId` | string (UUID) | Send back at submit. |
| `targetFeeRateSatVb` | integer |  |
| `estimatedNetworkFeeSats` | integer |  |
| `expectedTransferTxid` | string |  |
| `expectedSettlementTxid` | string |  |
| `steps` | array | Three PSBT steps. |
| `steps[].stepIndex` | integer | `0`, `1`, or `2`. |
| `steps[].signerAddress` | string |  |
| `steps[].inputsToSign` | array |  |
| `steps[].psbtBase64` | string |  |

```json
{
  "priceSats": 60000,
  "inscriptionUtxoValueSats": 546,
  "sellerMarketplaceFeeBps": 100,
  "sellerMarketplaceFeeSats": 600,
  "buyerMarketplaceFeeBps": 100,
  "buyerMarketplaceFeeSats": 600,
  "sellerCreatorRoyaltyBps": 0,
  "sellerCreatorRoyaltySats": 0,
  "buyerCreatorRoyaltyBps": 100,
  "buyerCreatorRoyaltySats": 600,
  "sellerReceiveSats": 59400,
  "buyerPayTotalSats": 61200,
  "marketplaceRevenueSats": 1200,
  "creatorRevenueSats": 600,
  "anchorUtxoId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "targetFeeRateSatVb": 1,
  "estimatedNetworkFeeSats": 330,
  "expectedTransferTxid": "transfer1...",
  "expectedSettlementTxid": "settle1...",
  "steps": [
    {
      "stepIndex": 0,
      "signerAddress": "bc1p...",
      "inputsToSign": [
        {
          "address": "bc1p...",
          "signingIndexes": [
            0
          ],
          "sigHash": 0
        }
      ],
      "psbtBase64": "<base64-psbt>"
    },
    {
      "stepIndex": 1,
      "signerAddress": "bc1p...",
      "inputsToSign": [
        {
          "address": "bc1p...",
          "signingIndexes": [
            0
          ],
          "sigHash": 129
        }
      ],
      "psbtBase64": "<base64-psbt>"
    },
    {
      "stepIndex": 2,
      "signerAddress": "bc1p...",
      "inputsToSign": [
        {
          "address": "bc1p...",
          "signingIndexes": [
            0
          ],
          "sigHash": 129
        }
      ],
      "psbtBase64": "<base64-psbt>"
    }
  ]
}
```

### POST /inscriptions/:id/offers/:offerId/counter/submit

#### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes |  |
| `ordinalsPublicKey` | string | yes |  |
| `priceSats` | integer | yes | Same as preflight. |
| `validityHours` | integer | no | Same as preflight. Defaults to `168` when omitted. |
| `anchorUtxoId` | string (UUID) | yes | From preflight. |
| `expectedTransferTxid` | string | yes | From preflight. |
| `expectedSettlementTxid` | string | yes | From preflight. |
| `signedSteps` | array | yes | Three wallet-signed steps. |
| `signedSteps[].stepIndex` | integer | yes |  |
| `signedSteps[].signerAddress` | string | yes |  |
| `signedSteps[].inputsToSign` | array | yes |  |
| `signedSteps[].psbtBase64` | string | yes |  |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555",
  "ordinalsPublicKey": "abcdef...",
  "priceSats": 60000,
  "validityHours": 24,
  "anchorUtxoId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "expectedTransferTxid": "transfer1...",
  "expectedSettlementTxid": "settle1...",
  "signedSteps": [
    {
      "stepIndex": 0,
      "signerAddress": "bc1p...",
      "inputsToSign": [
        {
          "address": "bc1p...",
          "signingIndexes": [
            0
          ],
          "sigHash": 0
        }
      ],
      "psbtBase64": "<signed-base64-psbt>"
    },
    {
      "stepIndex": 1,
      "signerAddress": "bc1p...",
      "inputsToSign": [
        {
          "address": "bc1p...",
          "signingIndexes": [
            0
          ],
          "sigHash": 129
        }
      ],
      "psbtBase64": "<signed-base64-psbt>"
    },
    {
      "stepIndex": 2,
      "signerAddress": "bc1p...",
      "inputsToSign": [
        {
          "address": "bc1p...",
          "signingIndexes": [
            0
          ],
          "sigHash": 129
        }
      ],
      "psbtBase64": "<signed-base64-psbt>"
    }
  ]
}
```

#### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `offerId` | string (UUID) | The new counter offer’s id. |
| `parentOfferId` | string (UUID) | The buyer offer this counter is on. |
| `status` | string | Always `active` on success. |

```json
{
  "offerId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "parentOfferId": "33333333-3333-3333-3333-333333333333",
  "status": "active"
}
```

### POST /inscriptions/:id/offers/:offerId/counter/reject

Buyer declines a seller’s counter.

#### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes |  |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555"
}
```

#### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `offerId` | string (UUID) |  |
| `status` | string | `rejected`. |

```json
{
  "offerId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "status": "rejected"
}
```

## Accept a counter (buyer)

Two calls. The buyer signs payment inputs and the result broadcasts.

### POST /inscriptions/:id/offers/:offerId/counter/accept/preflight

#### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes |  |
| `paymentPublicKey` | string | yes |  |
| `spendableUtxos` | array | conditional | Up to 1000 candidate payment UTXOs. Required for API-created or non-Xverse bindings. Xverse bindings may omit it and use wallet-provider UTXO fallback. |
| `spendableUtxos[].txid` | string | yes |  |
| `spendableUtxos[].vout` | integer | yes |  |
| `spendableUtxos[].valueSats` | integer | yes |  |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555",
  "paymentPublicKey": "abcdef...",
  "spendableUtxos": [
    {
      "txid": "deadbeef...",
      "vout": 0,
      "valueSats": 100000
    }
  ]
}
```

#### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `offerId` | string (UUID) |  |
| `selectedPaymentUtxos` | array |  |
| `targetFeeRateSatVb` | integer |  |
| `estimatedNetworkFeeSats` | integer |  |
| `expectedFundingTxid` | string |  |
| `expectedSettlementTxid` | string |  |
| `steps` | array | Two PSBT steps. |
| `steps[].stepIndex` | integer | `0` or `1`. |
| `steps[].signerAddress` | string |  |
| `steps[].inputsToSign` | array |  |
| `steps[].psbtBase64` | string |  |

```json
{
  "offerId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "selectedPaymentUtxos": [
    {
      "txid": "deadbeef...",
      "vout": 0,
      "valueSats": 100000
    }
  ],
  "targetFeeRateSatVb": 1,
  "estimatedNetworkFeeSats": 330,
  "expectedFundingTxid": "fund1...",
  "expectedSettlementTxid": "settle1...",
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
    },
    {
      "stepIndex": 1,
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
  ]
}
```

### POST /inscriptions/:id/offers/:offerId/counter/accept/submit

#### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes |  |
| `paymentPublicKey` | string | yes |  |
| `spendableUtxos` | array | yes (min 1) |  |
| `spendableUtxos[].txid` | string | yes |  |
| `spendableUtxos[].vout` | integer | yes |  |
| `spendableUtxos[].valueSats` | integer | yes |  |
| `selectedPaymentUtxos` | array | yes | The exact UTXOs from preflight. |
| `expectedFundingTxid` | string | yes | From preflight. |
| `expectedSettlementTxid` | string | yes | From preflight. |
| `signedSteps` | array | yes | Both signed steps. |
| `signedSteps[].stepIndex` | integer | yes |  |
| `signedSteps[].signerAddress` | string | yes |  |
| `signedSteps[].inputsToSign` | array | yes |  |
| `signedSteps[].psbtBase64` | string | yes |  |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555",
  "paymentPublicKey": "abcdef...",
  "spendableUtxos": [
    {
      "txid": "deadbeef...",
      "vout": 0,
      "valueSats": 100000
    }
  ],
  "selectedPaymentUtxos": [
    {
      "txid": "deadbeef...",
      "vout": 0,
      "valueSats": 100000
    }
  ],
  "expectedFundingTxid": "fund1...",
  "expectedSettlementTxid": "settle1...",
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
    },
    {
      "stepIndex": 1,
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

#### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `offerId` | string (UUID) |  |
| `settlementTxid` | string |  |
| `payoutTxid` | string | null |  |
| `status` | string | Always `accepted` on success. |

```json
{
  "offerId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "settlementTxid": "settle1...",
  "payoutTxid": null,
  "status": "accepted"
}
```

## Your offers

`GET /api/v1/me/offers`

Cursor-paginated. The shape of `200` depends on `view`.

### Query parameters

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `view` | string | `owned` | One of `owned`, `sent`, `history`. |
| `cursor` | string |  | Opaque cursor from the previous response. |

| `view` | Returns |
| --- | --- |
| `owned` | Offers and counters on inscriptions held by your linked wallets. |
| `sent` | Offers your linked wallets have sent. |
| `history` | Past offer activity for your linked wallets. |

### Response (200) when `view=owned`

| Field | Type | Description |
| --- | --- | --- |
| `view` | string | `owned`. |
| `groups` | array | One group per inscription. |
| `groups[].inscriptionId` | string |  |
| `groups[].inscriptionNumber` | string |  |
| `groups[].inscriptionTitle` | string | null |  |
| `groups[].collectionName` | string | null |  |
| `groups[].ownerAddress` | string |  |
| `groups[].actionBindingId` | string (UUID) | null | Binding that can act on this group, when any. |
| `groups[].topOfferSats` | integer | null |  |
| `groups[].activeOfferCount` | integer |  |
| `groups[].activeCounterCount` | integer |  |
| `groups[].earliestExpiresAt` | ISO datetime | null |  |
| `groups[].offers` | array | Buyer offers received on this inscription. |
| `groups[].sentCounters` | array | Seller counters sent from your linked wallets. |
| `groups[].offers[].id` | string (UUID) | Offer id. |
| `groups[].offers[].kind` | string | `buyer_offer` or `seller_counter`. |
| `groups[].offers[].status` | string | See status table. |
| `groups[].offers[].side` | string | `received` or `sent`. |
| `groups[].offers[].actionKind` | string | null | Action available to your wallet. |
| `groups[].offers[].buyerAddress` | string |  |
| `groups[].offers[].sellerAddress` | string |  |
| `groups[].offers[].priceSats` | integer |  |
| `groups[].offers[].createdAt` | ISO datetime |  |
| `groups[].offers[].expiresAt` | ISO datetime |  |
| `actionableCount` | integer | Total actionable items. |
| `ownedCount` | integer | Count for `owned`. |
| `sentCount` | integer | Count for `sent`. |
| `hasMore` | boolean |  |
| `nextCursor` | string | null |  |

```json
{
  "view": "owned",
  "groups": [
    {
      "inscriptionId": "abc123...i0",
      "inscriptionNumber": "12345",
      "inscriptionTitle": "Inscription 12345",
      "collectionName": "Wizards",
      "ownerAddress": "bc1p...",
      "actionBindingId": "55555555-5555-5555-5555-555555555555",
      "topOfferSats": 50000,
      "activeOfferCount": 1,
      "activeCounterCount": 0,
      "earliestExpiresAt": "2026-05-15T18:00:00.000Z",
      "offers": [
        {
          "id": "33333333-3333-3333-3333-333333333333",
          "kind": "buyer_offer",
          "status": "active",
          "side": "received",
          "actionKind": "seller_received_buyer_offer",
          "buyerAddress": "bc1q...",
          "sellerAddress": "bc1p...",
          "priceSats": 50000,
          "createdAt": "2026-05-08T18:00:00.000Z",
          "expiresAt": "2026-05-15T18:00:00.000Z"
        }
      ],
      "sentCounters": []
    }
  ],
  "actionableCount": 1,
  "ownedCount": 1,
  "sentCount": 0,
  "hasMore": false,
  "nextCursor": null
}
```

### Response (200) when `view=sent`

| Field | Type | Description |
| --- | --- | --- |
| `view` | string | `sent`. |
| `rows` | array | One row per sent offer. |
| `rows[].id` | string (UUID) | Offer id. |
| `rows[].inscriptionId` | string |  |
| `rows[].inscriptionNumber` | string |  |
| `rows[].inscriptionTitle` | string | null |  |
| `rows[].collectionName` | string | null |  |
| `rows[].kind` | string | `buyer_offer` or `seller_counter`. |
| `rows[].status` | string |  |
| `rows[].side` | string | `received` or `sent`. |
| `rows[].actionKind` | string | null | Action available to your wallet. |
| `rows[].buyerAddress` | string |  |
| `rows[].sellerAddress` | string |  |
| `rows[].priceSats` | integer |  |
| `rows[].createdAt` | ISO datetime |  |
| `rows[].expiresAt` | ISO datetime |  |
| `actionableCount` | integer |  |
| `ownedCount` | integer |  |
| `sentCount` | integer |  |
| `hasMore` | boolean |  |
| `nextCursor` | string | null |  |

```json
{
  "view": "sent",
  "rows": [
    {
      "id": "33333333-3333-3333-3333-333333333333",
      "inscriptionId": "abc123...i0",
      "inscriptionNumber": "12345",
      "inscriptionTitle": "Inscription 12345",
      "collectionName": "Wizards",
      "kind": "buyer_offer",
      "status": "active",
      "side": "sent",
      "actionKind": null,
      "buyerAddress": "bc1q...",
      "sellerAddress": "bc1p...",
      "priceSats": 50000,
      "createdAt": "2026-05-08T18:00:00.000Z",
      "expiresAt": "2026-05-15T18:00:00.000Z"
    }
  ],
  "actionableCount": 0,
  "ownedCount": 0,
  "sentCount": 1,
  "hasMore": false,
  "nextCursor": null
}
```

### Response (200) when `view=history`

| Field | Type | Description |
| --- | --- | --- |
| `view` | string | `history`. |
| `events` | array | Past offer events. |
| `events[].eventKey` | string | Stable event key for pagination/rendering. |
| `events[].eventType` | string | One of `created`, `accepted`, `rejected`, `cancelled`, `expired`, `invalidated`. |
| `events[].role` | string | `buyer` or `seller`. |
| `events[].offerId` | string (UUID) |  |
| `events[].parentOfferId` | string (UUID) | null |  |
| `events[].inscriptionId` | string |  |
| `events[].inscriptionNumber` | string |  |
| `events[].inscriptionTitle` | string | null |  |
| `events[].kind` | string | `buyer_offer` or `seller_counter`. |
| `events[].status` | string | See status table. |
| `events[].side` | string | `received` or `sent`. |
| `events[].buyerAddress` | string |  |
| `events[].sellerAddress` | string |  |
| `events[].priceSats` | integer |  |
| `events[].occurredAt` | ISO datetime |  |
| `events[].createdAt` | ISO datetime |  |
| `events[].expiresAt` | ISO datetime |  |
| `events[].settlementTxid` | string | null |  |
| `events[].payoutTxid` | string | null |  |
| `actionableCount` | integer |  |
| `ownedCount` | integer |  |
| `sentCount` | integer |  |
| `hasMore` | boolean |  |
| `nextCursor` | string | null |  |

```json
{
  "view": "history",
  "events": [
    {
      "eventKey": "22222222-2222-2222-2222-222222222222:expired",
      "eventType": "expired",
      "role": "buyer",
      "offerId": "22222222-2222-2222-2222-222222222222",
      "parentOfferId": null,
      "inscriptionId": "abc123...i0",
      "inscriptionNumber": "12345",
      "inscriptionTitle": "Inscription 12345",
      "kind": "buyer_offer",
      "status": "expired",
      "side": "sent",
      "buyerAddress": "bc1q...",
      "sellerAddress": "bc1p...",
      "priceSats": 45000,
      "occurredAt": "2026-04-08T12:00:00.000Z",
      "createdAt": "2026-04-01T12:00:00.000Z",
      "expiresAt": "2026-04-08T12:00:00.000Z",
      "settlementTxid": null,
      "payoutTxid": null
    }
  ],
  "actionableCount": 0,
  "ownedCount": 0,
  "sentCount": 0,
  "hasMore": false,
  "nextCursor": null
}
```

[Previous  
Buying](/reference/buying/) [Next  
Errors and Rate Limits](/reference/errors-rate-limits/)
