<!--
ord.net API docs — Sales
Source: https://developers.ord.net/reference/sales/
Retrieved: 2026-09-14
Mirrored for offline reference; ord.net is the source of truth.
-->

# Sales

Sales reads return confirmed sales ordered newest first.

## GET /sales

Returns a cursor-paginated feed of confirmed sales.

### Query parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `limit` | integer | no | `50` | Page size. Min `1`, max `100`. |
| `cursor` | string | no |  | Opaque cursor from `pagination.nextCursor`. |
| `collectionSlug` | string | no |  | Restrict to one collection. Case-insensitive. Letters, numbers, hyphens, and underscores are allowed. |

### Example

Terminal window

```sh
curl "https://ord.net/api/v1/sales?collectionSlug=wizards&limit=25" \  -H "Authorization: Bearer $ORD_SESSION_TOKEN"
```

### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `sales` | array | Confirmed sale rows, newest first. |
| `sales[].saleId` | string | Sale event identifier. |
| `sales[].saleType` | string | `internal` for ORD.NET-settled sales, `external` for off-market sales detected from chain data. |
| `sales[].txid` | string | null | Settlement transaction id. |
| `sales[].inscriptionId` | string | Sold inscription id. |
| `sales[].inscriptionNumber` | string | Inscription number as a string. |
| `sales[].inscriptionName` | string | Display name of the inscription. |
| `sales[].collection.slug` | string | null | Collection slug, if any. |
| `sales[].collection.name` | string | null | Collection display name. |
| `sales[].collection.kind` | string | null | One of `parent_child`, `gallery`. |
| `sales[].collection.verificationStatus` | string | null | One of `verified`, `unverified`. |
| `sales[].sellerAddress` | string | null | Seller ordinals address. |
| `sales[].buyerAddress` | string | null | Buyer ordinals address. |
| `sales[].priceSats` | integer | Sale price in sats. |
| `sales[].price` | number | Sale price in BTC. |
| `sales[].priceUsd` | number | null | Sale price in USD using the block-time BTC/USD quote, when available. |
| `sales[].soldAt` | ISO 8601 datetime | Sale confirmation time. |
| `sales[].blockHeight` | integer | Sale block height. |
| `pagination.pageSize` | integer | Items in this page. |
| `pagination.hasNext` | boolean | `true` if more pages exist. |
| `pagination.nextCursor` | string | null | Cursor for the next call. `null` on the last page. |

```json
{
  "sales": [
    {
      "saleId": "99",
      "saleType": "external",
      "txid": "abc123...",
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
      "buyerAddress": "bc1p...",
      "priceSats": 50000,
      "price": 0.0005,
      "priceUsd": 50,
      "soldAt": "2026-05-08T18:00:00.000Z",
      "blockHeight": 900101
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

-   `200`: sales returned.
-   `400`: invalid `limit`, `cursor`, or `collectionSlug`.
-   `401`: missing or invalid bearer token.
-   `403`: wallet not allowed.
-   `429`: rate limited.
-   `500`: internal server error.

### Pagination notes

The cursor encodes the last seen sale. Changing `collectionSlug` between calls invalidates the cursor. Start a new pagination from the beginning.

Unknown `collectionSlug` filters return an empty page, not `404`.

[Previous  
Listings](/reference/listings/) [Next  
Buying](/reference/buying/)
