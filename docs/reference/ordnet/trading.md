<!--
ord.net API docs — P2P proposals
Source: https://developers.ord.net/reference/trading/
Retrieved: 2026-10-07
Mirrored for offline reference; ord.net is the source of truth.
-->

# P2P Proposals

P2P proposal reads return active public trade proposals ordered newest first. The API is read only: creating, accepting, and viewing private proposals or completed trades are not available.

## GET /trading

Returns a cursor-paginated feed of public proposals that are active and unexpired.

### Query parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `limit` | integer | no | `50` | Page size. Min `1`, max `100`. |
| `cursor` | string | no |  | Opaque cursor from `pagination.nextCursor`. |
| `collectionSlug` | string | no |  | Restrict to proposals that offer an inscription from the collection or want the collection. Case-insensitive. Letters, numbers, hyphens, and underscores are allowed. |

### Example

Terminal window

```sh
curl "https://ord.net/api/v1/trading?collectionSlug=wizards&limit=25" \  -H "Authorization: Bearer $ORD_SESSION_TOKEN"
```

### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `proposals` | array | Active public proposals, newest first. |
| `proposals[].id` | string (UUID) | Proposal identifier. |
| `proposals[].creatorAddress` | string | Creator’s ordinals address. |
| `proposals[].visibility` | string | Always `public`. |
| `proposals[].status` | string | `active` when selected. May be `expired` if the proposal expires during the request. |
| `proposals[].offeredBtcSats` | integer | BTC offered by the creator, in sats. |
| `proposals[].requestedBtcSats` | integer | BTC requested from the counterparty, in sats. |
| `proposals[].estimatedOfferedValueSats` | integer | Estimated value of the offered inscriptions and BTC, in sats. |
| `proposals[].estimatedRequestedValueSats` | integer | Estimated value of the wanted inscriptions and BTC, in sats. |
| `proposals[].marketplaceFeeSats` | integer | Marketplace fee in sats. |
| `proposals[].offeredItems` | array | Offered inscriptions. Up to 50. |
| `proposals[].offeredItems[].inscriptionId` | string | Offered inscription id. |
| `proposals[].offeredItems[].inscriptionSequenceNumber` | string | Inscription sequence number as a string. |
| `proposals[].offeredItems[].inscriptionUtxoValueSats` | integer | Value of the output holding the inscription, in sats. |
| `proposals[].offeredItems[].inscriptionTitle` | string | Display name. Optional. |
| `proposals[].offeredItems[].rawContentType` | string | Content type. Optional. |
| `proposals[].offeredItems[].imageRenderingHint` | string | null | One of `auto`, `pixelated`. Optional. |
| `proposals[].offeredItems[].collection` | object | null | Collection summary, if any. |
| `proposals[].wantedLegs` | array | Wanted collection criteria. Up to 50. |
| `proposals[].wantedLegs[].id` | string (UUID) | Leg identifier. |
| `proposals[].wantedLegs[].collection` | object | Collection summary. |
| `proposals[].wantedLegs[].quantity` | integer | Number of inscriptions wanted. Min `1`, max `50`. |
| `proposals[].wantedLegs[].target` | object | Which inscriptions qualify. See [Wanted leg targets](#wanted-leg-targets). |
| `proposals[].wantedLegs[].specificItems` | array | Display records for an `inscriptions` target. Each has `inscriptionId`, integer `inscriptionNumber`, and the optional display fields of offered items. |
| `proposals[].wantedLegs[].estimatedUnitValueSats` | integer | null | Estimated value per wanted inscription, in sats. |
| `proposals[].createdAt` | ISO 8601 datetime | Creation time. |
| `proposals[].expiresAt` | ISO 8601 datetime | Expiry time. |
| `filterCollection` | object | null | Collection summary for a recognized `collectionSlug`. `null` with no filter or an unknown collection. |
| `pagination.pageSize` | integer | Requested page size. |
| `pagination.hasNext` | boolean | `true` if more pages exist. |
| `pagination.nextCursor` | string | null | Cursor for the next call. `null` on the last page. |

Collection summaries contain `id` (UUID), `slug`, `name`, and nullable `cardBackgroundColor`. Optional fields are `previewInscriptionId`, `previewContentType`, and nullable `imageRenderingHint`.

Valuations are estimates, not guarantees that the requested assets remain available. The feed does not include private offers, wallet-binding identifiers, offer counts, or accepted-offer identifiers.

```json
{
  "proposals": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "creatorAddress": "bc1p...",
      "visibility": "public",
      "status": "active",
      "offeredBtcSats": 0,
      "requestedBtcSats": 10000,
      "estimatedOfferedValueSats": 50000,
      "estimatedRequestedValueSats": 55000,
      "marketplaceFeeSats": 1000,
      "offeredItems": [
        {
          "inscriptionId": "abc123...i0",
          "inscriptionSequenceNumber": "12345",
          "inscriptionTitle": "Wizard #12",
          "rawContentType": "image/png",
          "imageRenderingHint": "pixelated",
          "inscriptionUtxoValueSats": 546,
          "collection": {
            "id": "22222222-2222-4222-8222-222222222222",
            "slug": "wizards",
            "name": "Wizards",
            "cardBackgroundColor": null
          }
        }
      ],
      "wantedLegs": [
        {
          "id": "33333333-3333-4333-8333-333333333333",
          "collection": {
            "id": "44444444-4444-4444-8444-444444444444",
            "slug": "goblins",
            "name": "Goblins",
            "cardBackgroundColor": null
          },
          "quantity": 1,
          "target": {
            "kind": "traits",
            "traits": [
              {
                "type": "Hat",
                "values": [
                  "Blue"
                ]
              }
            ]
          },
          "specificItems": [],
          "estimatedUnitValueSats": 45000
        }
      ],
      "createdAt": "2026-05-08T18:00:00.000Z",
      "expiresAt": "2026-05-15T18:00:00.000Z"
    }
  ],
  "filterCollection": {
    "id": "22222222-2222-4222-8222-222222222222",
    "slug": "wizards",
    "name": "Wizards",
    "cardBackgroundColor": null
  },
  "pagination": {
    "pageSize": 25,
    "hasNext": true,
    "nextCursor": "<opaque-cursor>"
  }
}
```

### Wanted leg targets

-   `{ "kind": "all" }`: any eligible inscription in the collection.
-   `{ "kind": "traits", "traits": [{ "type": "Hat", "values": ["Blue"] }] }`: inscriptions matching the trait criteria.
-   `{ "kind": "inscriptions", "inscriptionIds": ["<inscription-id>"] }`: specific inscriptions, described in `specificItems`.

### Status codes

-   `200`: proposals returned.
-   `400`: invalid `limit`, `cursor`, or `collectionSlug`.
-   `401`: missing or invalid bearer token.
-   `403`: wallet not allowed.
-   `429`: rate limited.
-   `500`: internal server error.

### Pagination notes

The cursor encodes the last seen proposal. Pass it unchanged: it keeps the timestamp precision needed to order proposals created in the same millisecond. Changing `collectionSlug` between calls invalidates the cursor. Start a new pagination from the beginning.

This is a live feed. Proposals that expire or change status between calls may drop out of later pages.

Each proposal appears once, even when both sides match `collectionSlug`. Unknown `collectionSlug` filters return an empty page with `filterCollection: null`, not `404`.

[Previous  
Sales](/reference/sales/)[Next  
Buying](/reference/buying/)
