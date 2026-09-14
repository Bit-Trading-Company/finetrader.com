<!--
ord.net API docs — Overview
Source: https://developers.ord.net/
Retrieved: 2026-09-14
Mirrored for offline reference; ord.net is the source of truth.
-->

# ORD.NET API

[ORD.NET](https://ord.net) is a Bitcoin ordinals marketplace. The API lets wallet clients read the order book, list inscriptions for sale, buy listings, and negotiate offers.

## Base URL

```text
https://ord.net/api/v1
```

Requests and responses are JSON unless a route says otherwise.

Machine-readable OpenAPI 3.1 is available at [`/openapi.json`](/openapi.json).

## Authentication

The API is wallet-authenticated. There are no API keys. A wallet signs a challenge, the server verifies it, and you get a bearer token. The payment address that signs the challenge must hold **0.01 BTC confirmed** for the token to issue. See [Authentication](/reference/authentication/) for the full flow.

## Request format

Every request and response body is JSON. Requests carry the bearer token and the JSON content type:

```http
Authorization: Bearer <sessionToken>Content-Type: application/json
```

The token is scoped to this API only. Web-session cookies and social-login sessions are rejected on this surface.

## The PSBT flow

Every trading write (creating a listing, buying, making or accepting an offer) follows the same shape: a preflight + submit exchange between the server and the user’s wallet.

1.  The client calls the route’s `preflight` endpoint. The server returns one or more PSBTs, plus per-input signing instructions.
2.  The wallet signs every step. Each input lists a `signerAddress`, `signingIndexes`, and an optional `sigHash` you must honor.
3.  The client submits the signed payload to the matching `submit` endpoint. The server verifies, broadcasts, and returns settlement information.

A few rules apply across all flows:

-   The same `walletBindingId` from `/auth/verify` or `GET /me` is sent on every preflight and submit.
-   Submit must reuse the exact request fields you sent at preflight (`inscriptionId`, `priceSats`, optional `validityHours`, etc.). Do not substitute values.
-   Hold onto the handles the server returns at preflight (`anchorUtxoId`, `purchaseAnchorUtxoId`, `selectedPaymentUtxos`, `expectedSettlementTxid`, etc.) and resend them at submit.
-   For PSBTs that have multiple `signingIndexes`, sign every listed index.

## Pagination

Two patterns are in play:

-   **Cursor pagination** is used by `GET /listings`, `GET /sales`, `GET /collection/:slug/inscriptions`, and `GET /me/offers`. Pass an opaque `cursor` from the previous response. The cursor encodes the sort key and the last seen item, so changing `sort` or any filter between calls invalidates the cursor.
-   **Page pagination** is used by `GET /inscriptions/:id/offers/history`. Pass `page` (zero-indexed). Page size is fixed at 25.

## Reference

-   [Authentication](/reference/authentication/): wallet challenges, bearer tokens, funding requirement.
-   [Collections](/reference/collections/): fetch all inscriptions in a collection.
-   [Listings](/reference/listings/): read the order book, create listings, cancel listings.
-   [Sales](/reference/sales/): read confirmed internal and external sales.
-   [Buying](/reference/buying/): preflight and submit purchases.
-   [Offers](/reference/offers/): buyer, seller, and counter offer flows; your offers.
-   [Errors and rate limits](/reference/errors-rate-limits/): status codes, CORS, retry guidance.

## For AI agents

A machine-readable index lives at [/llms.txt](/llms.txt) following the [llmstxt.org](https://llmstxt.org/) convention. It enumerates the reference pages with one-line summaries, plus the API base URL and core conventions.

[Next  
Authentication](/reference/authentication/)
