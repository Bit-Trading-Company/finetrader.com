<!--
ord.net API docs — Authentication
Source: https://developers.ord.net/reference/authentication/
Retrieved: 2026-09-14
Mirrored for offline reference; ord.net is the source of truth.
-->

# Authentication

The [ORD.NET](https://ord.net) API is wallet-authenticated. There are no API keys. You do not register an app or apply for credentials. The wallet signs a fresh challenge, the server verifies it, and you get a bearer token to use on subsequent requests.

## The flow

1.  Ask the server for a challenge: `POST /auth/challenge`.
2.  Have the wallet sign every message in the challenge.
3.  Submit the signatures: `POST /auth/verify`.
4.  Use the returned `sessionToken` as a bearer token on subsequent requests.

## POST /auth/challenge

Creates a new auth flow with one challenge per address that needs to sign.

### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `ordinalsAddress` | string | yes | Wallet’s ordinals address. |
| `paymentAddress` | string | yes | Wallet’s payment address. This is the address checked for the funding requirement during `/auth/verify`. |

Provider and wallet visibility are not request fields. When this flow links a new wallet binding to an existing signed-in profile, the new binding follows that profile’s existing public/private wallet visibility default.

```json
{
  "ordinalsAddress": "bc1p...",
  "paymentAddress": "bc1q..."
}
```

### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `authRequestId` | string (UUID) | Pass back to `/auth/verify`. |
| `challenges` | array | One entry per address that needs to sign. At least one. |
| `challenges[].challengeId` | string (UUID) | Pass back to `/auth/verify`. |
| `challenges[].message` | string | The exact text to sign. |
| `challenges[].address` | string | Wallet address that should sign this message. |
| `challenges[].role` | string | One of `ordinals`, `payment`. |

```json
{
  "authRequestId": "11111111-1111-1111-1111-111111111111",
  "challenges": [
    {
      "challengeId": "22222222-2222-2222-2222-222222222222",
      "message": "Sign in to ord.net at 2026-05-08T18:00:00Z (nonce: ...)",
      "address": "bc1p...",
      "role": "ordinals"
    },
    {
      "challengeId": "33333333-3333-3333-3333-333333333333",
      "message": "Sign in to ord.net at 2026-05-08T18:00:00Z (nonce: ...)",
      "address": "bc1q...",
      "role": "payment"
    }
  ]
}
```

### Status codes

-   `200`: challenge created.
-   `400`: malformed addresses or request body.
-   `401`: signed-in browser session is stale.
-   `403`: signed-in browser request came from an invalid origin.
-   `409`: wallet is already linked or cannot be linked to this profile.
-   `429`: rate limited.

See [Errors and rate limits](/reference/errors-rate-limits/) for response shapes.

## POST /auth/verify

Verifies one or more signed challenges and issues a session token on success.

### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `authRequestId` | string (UUID) | yes | The `authRequestId` from `/auth/challenge`. |
| `verifications` | array | yes (min 1, max 2) | One entry per signed challenge. |
| `verifications[].challengeId` | string (UUID) | yes | The `challengeId` from `/auth/challenge`. |
| `verifications[].signature` | string | yes | Hex-encoded BIP-322 simple signature for `message`. Max 8192 characters. |
| `verifications[].address` | string | yes | The address that produced the signature. |

```json
{
  "authRequestId": "11111111-1111-1111-1111-111111111111",
  "verifications": [
    {
      "challengeId": "22222222-2222-2222-2222-222222222222",
      "signature": "<hex-signature>",
      "address": "bc1p..."
    },
    {
      "challengeId": "33333333-3333-3333-3333-333333333333",
      "signature": "<hex-signature>",
      "address": "bc1q..."
    }
  ]
}
```

### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `profile` | object | Your profile metadata. |
| `profile.id` | string | Stable profile id. |
| `profile.username` | string | null | Profile username. |
| `profile.displayName` | string | null | Profile display name. |
| `profile.bio` | string | null | Profile bio. |
| `profile.avatarUrl` | string | null | Profile avatar image URL. |
| `profile.bannerUrl` | string | null | Profile banner image URL. |
| `walletBindings` | array | Wallet bindings available to this API session. |
| `walletBindings[].walletBindingId` | string (UUID) | Send this as `walletBindingId` on writes. |
| `walletBindings[].label` | string | Display label for the binding. |
| `walletBindings[].provider` | string | Wallet provider recorded for the binding. |
| `walletBindings[].ordinalsAddress` | string | Ordinals address in the binding. |
| `walletBindings[].paymentAddress` | string | Payment address in the binding. |
| `walletBindings[].isPublic` | boolean | Whether this binding is public on the profile. |
| `sessionToken` | string | The bearer token. |
| `expiresAt` | ISO 8601 datetime | When the token stops being accepted. Tokens are currently valid for 1 hour. |

```json
{
  "profile": {
    "id": "44444444-4444-4444-4444-444444444444",
    "username": "alice",
    "displayName": "Alice",
    "bio": null,
    "avatarUrl": null,
    "bannerUrl": null
  },
  "walletBindings": [
    {
      "walletBindingId": "55555555-5555-5555-5555-555555555555",
      "label": "Trading Wallet",
      "provider": "unknown",
      "ordinalsAddress": "bc1p...",
      "paymentAddress": "bc1q...",
      "isPublic": true
    }
  ],
  "sessionToken": "<bearer-token>",
  "expiresAt": "2026-05-08T19:00:00.000Z"
}
```

### Status codes

-   `200`: verification succeeded.
-   `400`: missing or malformed fields.
-   `401`: signature is invalid.
-   `403`: verified payment address does not meet the funding requirement, or the wallet is otherwise not allowed.
-   `404`: challenge was not found.
-   `409`: challenge flow is invalid or wallet ownership changed before verification completed.
-   `410`: challenge or flow expired. Start a fresh `/auth/challenge`.
-   `429`: rate limited.
-   `503`: funding check temporarily unavailable. Wait and retry with a fresh auth flow.

## Using the bearer token

Send the token on every request:

```http
Authorization: Bearer <sessionToken>Content-Type: application/json
```

Choose one entry from `walletBindings` and send its `walletBindingId` on writes.

The token has these properties:

-   It is an API session token. Only `/api/v1` bearer auth accepts it.
-   Web session cookies and social-login sessions are not accepted on this surface.
-   The token expires at `expiresAt`, currently 1 hour after issuance. Re-run the challenge and verify flow to refresh.
-   v1 tokens are not independently revocable or scoped per operation.

## GET /me

Returns the profile and wallet bindings without starting a new auth flow.

### Response (200)

| Field | Type | Description |
| --- | --- | --- |
| `profile` | object | Your profile metadata. |
| `walletBindings` | array | Same shape as `/auth/verify`. |

```json
{
  "profile": {
    "id": "44444444-4444-4444-4444-444444444444",
    "username": "alice",
    "displayName": "Alice",
    "bio": null,
    "avatarUrl": null,
    "bannerUrl": null
  },
  "walletBindings": [
    {
      "walletBindingId": "55555555-5555-5555-5555-555555555555",
      "label": "Trading Wallet",
      "provider": "unknown",
      "ordinalsAddress": "bc1p...",
      "paymentAddress": "bc1q...",
      "isPublic": true
    }
  ]
}
```

## Funding requirement

To issue a `sessionToken`, `/auth/verify` checks the verified `paymentAddress` from the auth flow for at least **0.01 BTC confirmed**. Pick the wallet address that should satisfy this requirement when you call `/auth/challenge`.

| Status | When |
| --- | --- |
| `403` | The verified payment address does not meet the funded threshold, or the wallet is otherwise not allowed. |
| `503` | The funding check is temporarily unavailable. Wait and retry with a fresh auth flow; do not work around the check. |

The `503` body looks like this:

```json
{
  "error": "Trading API wallet eligibility is temporarily unavailable"
}
```

## Bearer auth errors

Missing token:

```json
{
  "error": "Bearer session token required"
}
```

Invalid or expired token:

```json
{
  "error": "Invalid or expired bearer session token"
}
```

[Previous  
Overview](/) [Next  
Collections](/reference/collections/)
