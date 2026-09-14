<!--
ord.net API docs — Collections
Source: https://developers.ord.net/reference/collections/
Retrieved: 2026-09-14
Mirrored for offline reference; ord.net is the source of truth.
-->

# Collections

Collection reads let clients fetch floor stats for batches of collections and page through the inscriptions in one collection.

## GET /collection-stats/floors

Returns floor stats for one or more ordinal collections. Unknown slugs are omitted.

### Query parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `slugs` | string | yes |  | Comma-separated collection slugs. Max `100` slugs. |

### Example

Terminal window

```sh
curl "https://ord.net/api/v1/collection-stats/floors?slugs=bitcoin-puppets,omb" \  -H "Authorization: Bearer $ORD_SESSION_TOKEN"
```

### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `success` | boolean | Always `true` on success. |
| `data` | array | Matching floor stats ordered by the requested slug order. |
| `data[].slug` | string | Canonical collection slug. |
| `data[].floor` | integer | null | Floor price in sats. `null` when no floor is available. |
| `data[].listedCount` | integer | Listed item count. |
| `data[].ownerCount` | integer | Owner count from collection rollups. |
| `data[].oneDayChange` | number | null | 24h floor change percentage. |
| `data[].sevenDayChange` | number | null | 7d floor change percentage. |
| `data[].timestamp` | ISO 8601 | Timestamp for the returned collection stats. |

```json
{
  "success": true,
  "data": [
    {
      "slug": "bitcoin-puppets",
      "floor": 4726300,
      "listedCount": 102,
      "ownerCount": 256,
      "oneDayChange": 2.5,
      "sevenDayChange": -1.2,
      "timestamp": "2026-05-01T00:00:00.000Z"
    }
  ]
}
```

### Status codes

-   `200`: floor stats returned.
-   `400`: invalid query parameters.
-   `401`: missing or invalid bearer token.
-   `403`: wallet not allowed.
-   `429`: rate limited.
-   `500`: internal server error.

## GET /collection/:slug/inscriptions

Returns inscriptions in a collection. Cursor-paginated.

### Query parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `limit` | integer | no | `48` | Page size. Min `1`, max `100`. |
| `cursor` | string | no |  | Opaque cursor from `pagination.nextCursor`. |
| `sort` | string | no | `oldest` | `oldest` sorts by ascending inscription sequence. `newest` sorts by descending inscription sequence. |

### Example

Terminal window

```sh
curl "https://ord.net/api/v1/collection/wizards/inscriptions?limit=48" \  -H "Authorization: Bearer $ORD_SESSION_TOKEN"
```

### Response (200)

The response intentionally uses the same item-card payload as the collection page, including media and display fields.

| Field | Type | Description |
| --- | --- | --- |
| `items` | array | Collection inscription rows, ordered by `sort`. |
| `items[].id` | string | Same as `inscriptionId`. |
| `items[].name` | string | Display name. |
| `items[].collection` | string | Primary collection slug for this response. |
| `items[].collectionHref` | string | null | Collection page href. |
| `items[].collections` | string\[\] | Collection slugs attached to the inscription. |
| `items[].image` | string | Media URL for the inscription. |
| `items[].inscription` | integer | Inscription number. |
| `items[].inscriptionId` | string | Inscription id. |
| `items[].listingId` | string (UUID) | null | Current listing id when listed. |
| `items[].listingState` | string | null | One of `buyable`, `hidden_locked`, `pending_public`, or `null`. |
| `items[].priceSats` | integer | null | Current listing price in sats. |
| `items[].price` | number | null | Current listing price in BTC. |
| `items[].listedAt` | ISO 8601 | null | Listing activation time. |
| `items[].listingExpiresAt` | ISO 8601 | null | Listing expiration time. |
| `items[].lastSale` | number | null | Last sale price in BTC, when available. |
| `items[].owner` | string | null | Current owner address. |
| `items[].contentType` | string | One of `image`, `html`, `video`, `text`. |
| `items[].rawContentType` | string | null | Raw content type, if known. |
| `items[].imageRenderingHint` | string | null | `auto` or `pixelated`, when supplied. |
| `items[].cardBackgroundColor` | string | null | Hex color used by item-card renderers. |
| `items[].traits` | array | Collection traits for this inscription. |
| `items[].traits[].type` | string | Trait type. |
| `items[].traits[].value` | string | Trait value. |
| `items[].traits[].count` | integer | undefined | Trait bucket count when included. |
| `items[].traits[].percentage` | number | undefined | Trait bucket percentage when included. |
| `items[].satributes` | string\[\] | Satribute keys. |
| `items[].sat` | integer | null | Sat number, if known. |
| `items[].locationTxid` | string | null | Current outpoint txid. |
| `items[].locationVout` | integer | null | Current outpoint vout. |
| `items[].locationSatpoint` | string | null | Current satpoint. |
| `pagination.pageSize` | integer | Items in this page. |
| `pagination.hasNext` | boolean | `true` if more pages exist. |
| `pagination.nextCursor` | string | null | Cursor for the next call. `null` on the last page. |

```json
{
  "items": [
    {
      "id": "abc123...i0",
      "name": "Inscription 12345",
      "collection": "wizards",
      "collectionHref": "/collection/wizards",
      "collections": [
        "wizards"
      ],
      "image": "https://ord.net/content/abc123...i0",
      "inscription": 12345,
      "inscriptionId": "abc123...i0",
      "listingId": null,
      "listingState": null,
      "priceSats": null,
      "price": null,
      "listedAt": null,
      "listingExpiresAt": null,
      "lastSale": null,
      "owner": "bc1p...",
      "contentType": "image",
      "rawContentType": "image/png",
      "imageRenderingHint": "auto",
      "cardBackgroundColor": null,
      "traits": [
        {
          "type": "Background",
          "value": "Blue"
        }
      ],
      "satributes": [],
      "sat": 123456789,
      "locationTxid": "abc123...",
      "locationVout": 0,
      "locationSatpoint": "abc123...:0:0"
    }
  ],
  "pagination": {
    "pageSize": 48,
    "hasNext": true,
    "nextCursor": "<opaque-cursor>"
  }
}
```

### Status codes

-   `200`: inscriptions returned.
-   `400`: invalid `limit`, `sort`, or `cursor`.
-   `401`: missing or invalid bearer token.
-   `403`: wallet not allowed.
-   `404`: collection not found.
-   `429`: rate limited.
-   `500`: internal server error.

### Pagination notes

The cursor encodes sort and last-seen item. Changing `sort` between calls invalidates the cursor. Start a new pagination from the beginning.

[Previous  
Authentication](/reference/authentication/) [Next  
Listings](/reference/listings/)
