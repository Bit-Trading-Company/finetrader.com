<!--
ord.net API docs — Errors and rate limits
Source: https://developers.ord.net/reference/errors-rate-limits/
Retrieved: 2026-09-14
Mirrored for offline reference; ord.net is the source of truth.
-->

# Errors and Rate Limits

When something goes wrong, the [ORD.NET](https://ord.net) API returns a JSON body alongside the HTTP status:

```json
{
  "error": "Human readable error message"
}
```

Trust the HTTP status as the stable signal. The `error` string is for humans and the wording can change.

## Status codes

| Status | Meaning | What to do |
| --- | --- | --- |
| `200` | Success. |  |
| `400` | Invalid route params, query params, or JSON body. | Fix the request. Don’t retry blindly. |
| `401` | Missing, invalid, or expired bearer token. | Re-run the [auth flow](/reference/authentication/). |
| `403` | Not allowed. | Verify wallet ownership, balance requirements during auth, and route permissions. |
| `404` | Collection, listing, inscription, or offer not found. | Check your identifiers. |
| `409` | Trading state changed under you. | Re-fetch listing or offer state and start preflight again. Don’t reuse stale PSBTs. |
| `410` | Auth challenge or flow expired. | Start a fresh `/auth/challenge`. |
| `429` | Rate limited. | Back off and retry. |
| `500` | Unexpected server error. | Retry once, then report. |
| `503` | A required funding check or trading service is temporarily unavailable. | Wait and retry. Do not bypass the auth funding check. |

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

Auth funding-check outages at `503`:

```json
{
  "error": "Trading API wallet eligibility is temporarily unavailable"
}
```

See [Funding requirement](/reference/authentication/#funding-requirement) for the full explanation of `403` and `503` around wallet funding during token issuance.

## Rate limits

All limits use a fixed 60-second window. Every `/api/v1` endpoint belongs to one explicit bucket.

| Bucket | Per IP | Per profile or address |
| --- | --- | --- |
| `POST /auth/challenge` | 20 | 5 per address |
| `POST /auth/verify` | 20 | 5 per address |
| Trading reads | 60 | 30 per profile |
| Trading writes | 20 | 8 per profile |

Profile-scoped quotas key off the bearer token. IP-scoped quotas key off the source IP regardless of authentication.

## CORS

The `/api/v1` surface supports cross-origin browser clients. Preflights respond with:

```http
Access-Control-Allow-Origin: *Access-Control-Allow-Methods: GET, POST, OPTIONSAccess-Control-Allow-Headers: authorization, content-type
```

Send API tokens in the `Authorization` header.

## Retry guidance

-   `400`: fix the request.
-   `401`: re-run `/auth/challenge` and `/auth/verify`.
-   `403`: confirm wallet ownership, the verified payment address balance, and route permissions.
-   `409`: re-fetch listing or offer state and start preflight again.
-   `429`: exponential backoff and retry.
-   `503`: wait and retry. If this happens during `/auth/verify`, start a fresh auth flow before retrying.

[Previous  
Offers](/reference/offers/)
