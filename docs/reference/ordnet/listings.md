<!--
ord.net API docs — Listings
Source: https://developers.ord.net/reference/listings/
Retrieved: 2026-09-14
Mirrored for offline reference; ord.net is the source of truth.
-->

# Listings

Read the live order book, post inscriptions for sale, and cancel listings.

Reads are a single GET endpoint with filters and cursor pagination. Writes use the [PSBT flow](/#the-psbt-flow): preflight to build the PSBTs, submit to broadcast.

All listing write endpoints use the `/collection/:slug/...` route form.

## GET /listings

Returns active, buyable listings. Cursor-paginated.

### Query parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `limit` | integer | no | `50` | Page size. Min `1`, max `100`. |
| `cursor` | string | no |  | Opaque cursor from `pagination.nextCursor`. |
| `sort` | string | no | `recent` | `recent` sorts by newest listing first. `price` sorts by lowest asking price first. |
| `collectionSlug` | string | no |  | Restrict to one collection. Case-insensitive. Letters, numbers, hyphens, and underscores are allowed. |
| `inscriptionId` | string | no |  | Restrict to one inscription. Bundle members match too. |
| `sellerAddress` | string | no |  | Restrict to one seller address. |

### Example

Terminal window

```sh
curl "https://ord.net/api/v1/listings?collectionSlug=wizards&sort=price&limit=25" \  -H "Authorization: Bearer $ORD_SESSION_TOKEN"
```

### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `listings` | array | Listing rows, ordered by `sort`. |
| `listings[].listingId` | string (UUID) | Listing identifier. |
| `listings[].inscriptionId` | string | The listed inscription. |
| `listings[].inscriptionNumber` | string | Inscription number as a string. |
| `listings[].inscriptionName` | string | Display name of the inscription. |
| `listings[].collection.slug` | string | null | Collection slug, if any. |
| `listings[].collection.name` | string | null | Collection display name. |
| `listings[].collection.kind` | string | null | One of `parent_child`, `gallery`. |
| `listings[].collection.verificationStatus` | string | null | One of `verified`, `unverified`. |
| `listings[].sellerAddress` | string | Seller’s ordinals address. |
| `listings[].priceSats` | integer | Asking price in sats. |
| `listings[].listedAt` | ISO 8601 datetime | When the listing became active. |
| `listings[].listingExpiresAt` | ISO 8601 | null | When the listing expires. |
| `listings[].sat` | integer | null | Sat number, if known. |
| `listings[].locationTxid` | string | null | Current outpoint txid. |
| `listings[].locationVout` | integer | null | Current outpoint vout. |
| `listings[].locationSatpoint` | string | null | Current satpoint. |
| `pagination.pageSize` | integer | Items in this page. |
| `pagination.hasNext` | boolean | `true` if more pages exist. |
| `pagination.nextCursor` | string | null | Cursor for the next call. `null` on the last page. |

```json
{
  "listings": [
    {
      "listingId": "11111111-1111-1111-1111-111111111111",
      "inscriptionId": "abc123...i0",
      "inscriptionNumber": "12345",
      "inscriptionName": "Inscription 12345",
      "collection": {
        "slug": "wizards",
        "name": "Wizards",
        "kind": "parent_child",
        "verificationStatus": "verified"
      },
      "sellerAddress": "bc1p...",
      "priceSats": 50000,
      "listedAt": "2026-05-08T18:00:00.000Z",
      "listingExpiresAt": "2026-06-07T18:00:00.000Z",
      "sat": 123456789,
      "locationTxid": "abc123...",
      "locationVout": 0,
      "locationSatpoint": "abc123...:0:0"
    }
  ],
  "pagination": {
    "pageSize": 25,
    "hasNext": true,
    "nextCursor": "<opaque-cursor>"
  }
}
```

### Status codes

-   `200`: listings returned.
-   `400`: invalid `sort`, `collectionSlug`, or `inscriptionId`.
-   `401`: missing or invalid bearer token.
-   `403`: wallet not allowed.
-   `429`: rate limited.

### Filtering notes

Bundle listings: when you filter by `inscriptionId`, any inscription in the bundle matches. Without a filter, the row shows the bundle’s canonical inscription.

The cursor encodes sort and last-seen item. Changing `sort`, `collectionSlug`, `inscriptionId`, or `sellerAddress` between calls invalidates the cursor. Start a new pagination from the beginning.

## Create a listing

Two calls: preflight to build the PSBTs, submit to broadcast.

### Listing PSBT structure

Each listing produces two PSBT steps that the wallet must sign:

| Step | Sighash | Purpose |
| --- | --- | --- |
| `0` | `DEFAULT` | Transfer the inscription to the listing escrow output. |
| `1` | `SINGLE | ANYONECANPAY` | Settlement leg consumed by the buyer’s transaction. |

A single **recovery PSBT** also covers all listings in the batch. The recovery PSBT is what makes cancellation cheap: signing it at create time means delisting can settle without another wallet round trip.

### POST /collection/:slug/listings/preflight

Builds the listing PSBTs.

Path parameter: `slug` is the collection slug.

#### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes | Choose from `walletBindings` returned by `/auth/verify` or `GET /me`. |
| `ordinalsPublicKey` | string | yes | x-only (64 hex) or compressed (66 hex) public key for the ordinals address. |
| `items` | array | yes | Items to list. Min 1, max 20. No duplicate `inscriptionId`. |
| `items[].inscriptionId` | string | yes | The inscription to list. |
| `items[].priceSats` | integer | yes | Asking price in sats. Must be at least the configured listing minimum. |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555",
  "ordinalsPublicKey": "abcdef...",
  "items": [
    {
      "inscriptionId": "abc123...i0",
      "priceSats": 50000
    }
  ]
}
```

#### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `listings` | array | One entry per item, in the same order. |
| `listings[].inscriptionId` | string | The inscription this entry is for. |
| `listings[].anchorUtxoId` | string (UUID) | Server-side handle. Send back at submit. |
| `listings[].psbts` | array | Two PSBT steps to sign. |
| `listings[].psbts[].stepIndex` | integer | `0` or `1`. |
| `listings[].psbts[].inscriptionId` | string | Same as parent. |
| `listings[].psbts[].signerAddress` | string | Address that should sign. |
| `listings[].psbts[].inputsToSign` | array | Per-input signing instructions. |
| `listings[].psbts[].inputsToSign[].address` | string | Address for this input. |
| `listings[].psbts[].inputsToSign[].publicKey` | string | undefined | When set, use this key for signing. |
| `listings[].psbts[].inputsToSign[].disableTweakSigner` | boolean | undefined | When `true`, skip the taproot tweak. |
| `listings[].psbts[].inputsToSign[].signingIndexes` | integer\[\] | Input indices in the PSBT to sign. |
| `listings[].psbts[].inputsToSign[].sigHash` | integer | undefined | Sighash flag to use. |
| `listings[].psbts[].psbtBase64` | string | The unsigned PSBT. |
| `recoveryPsbt.signerAddress` | string | Address that should sign the recovery PSBT. |
| `recoveryPsbt.inputsToSign` | array | Same shape as listing inputs. |
| `recoveryPsbt.psbtBase64` | string | The unsigned recovery PSBT. |

```json
{
  "listings": [
    {
      "inscriptionId": "abc123...i0",
      "anchorUtxoId": "66666666-6666-6666-6666-666666666666",
      "psbts": [
        {
          "stepIndex": 0,
          "inscriptionId": "abc123...i0",
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
          "inscriptionId": "abc123...i0",
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
  ],
  "recoveryPsbt": {
    "signerAddress": "bc1p...",
    "inputsToSign": [
      {
        "address": "bc1p...",
        "signingIndexes": [
          0
        ],
        "sigHash": 1
      }
    ],
    "psbtBase64": "<base64-psbt>"
  }
}
```

#### Status codes

-   `200`: PSBTs returned.
-   `400`: invalid request body.
-   `401`: missing or invalid bearer token.
-   `403`: wallet not allowed.
-   `429`: rate limited.
-   `503`: upstream trading service temporarily unavailable.

### POST /collection/:slug/listings/submit

Publishes the listing once the wallet has signed every PSBT.

#### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes | Same as preflight. |
| `ordinalsPublicKey` | string | yes | Same as preflight. |
| `items` | array | yes | Same items sent at preflight. |
| `items[].inscriptionId` | string | yes |  |
| `items[].priceSats` | integer | yes |  |
| `durationDays` | integer | yes | One of `1`, `7`, `30`, `90`, `180`. |
| `anchors` | array | yes | One entry per item, in the same order. |
| `anchors[].inscriptionId` | string | yes | Same as the item. |
| `anchors[].anchorUtxoId` | string (UUID) | yes | The `anchorUtxoId` from preflight. No duplicates. |
| `signed` | array | yes | One entry per item, with the wallet-signed PSBTs. |
| `signed[].inscriptionId` | string | yes |  |
| `signed[].psbts` | array | yes | Both signed steps (`stepIndex` 0 and 1). |
| `signed[].psbts[].stepIndex` | integer | yes |  |
| `signed[].psbts[].signerAddress` | string | yes |  |
| `signed[].psbts[].inputsToSign` | array | yes |  |
| `signed[].psbts[].psbtBase64` | string | yes | The signed PSBT. |
| `signedRecoveryPsbt` | object | yes | The signed recovery PSBT. |
| `signedRecoveryPsbt.signerAddress` | string | yes |  |
| `signedRecoveryPsbt.inputsToSign` | array | yes |  |
| `signedRecoveryPsbt.psbtBase64` | string | yes |  |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555",
  "ordinalsPublicKey": "abcdef...",
  "items": [
    {
      "inscriptionId": "abc123...i0",
      "priceSats": 50000
    }
  ],
  "durationDays": 90,
  "anchors": [
    {
      "inscriptionId": "abc123...i0",
      "anchorUtxoId": "66666666-6666-6666-6666-666666666666"
    }
  ],
  "signed": [
    {
      "inscriptionId": "abc123...i0",
      "psbts": [
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
              "sigHash": 131
            }
          ],
          "psbtBase64": "<signed-base64-psbt>"
        }
      ]
    }
  ],
  "signedRecoveryPsbt": {
    "signerAddress": "bc1p...",
    "inputsToSign": [
      {
        "address": "bc1p...",
        "signingIndexes": [
          0
        ],
        "sigHash": 1
      }
    ],
    "psbtBase64": "<signed-base64-psbt>"
  }
}
```

#### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `listings` | array | One entry per item. |
| `listings[].inscriptionId` | string | The listed inscription. |
| `listings[].listingId` | string (UUID) | The new listing’s id. |

```json
{
  "listings": [
    {
      "inscriptionId": "abc123...i0",
      "listingId": "77777777-7777-7777-7777-777777777777"
    }
  ]
}
```

#### Status codes

Same as preflight.

## Cancel a listing

`POST /collection/:slug/listings/delist`

Single call. No PSBT signing required because the recovery PSBT was signed at create time.

### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `walletBindingId` | string (UUID) | yes | Same as listing flow. |
| `listings` | array | yes | Items to delist. Min 1, max 20. No duplicate `inscriptionId` or `listingId`. |
| `listings[].inscriptionId` | string | yes | Inscription on the listing. |
| `listings[].listingId` | string (UUID) | yes | The listing to cancel. |

```json
{
  "walletBindingId": "55555555-5555-5555-5555-555555555555",
  "listings": [
    {
      "inscriptionId": "abc123...i0",
      "listingId": "77777777-7777-7777-7777-777777777777"
    }
  ]
}
```

### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `listings` | array | Echoes the listings that were taken down. |
| `listings[].inscriptionId` | string |  |
| `listings[].listingId` | string (UUID) |  |

```json
{
  "listings": [
    {
      "inscriptionId": "abc123...i0",
      "listingId": "77777777-7777-7777-7777-777777777777"
    }
  ]
}
```

### Status codes

Same as preflight.

[Previous  
Collections](/reference/collections/) [Next  
Sales](/reference/sales/)
