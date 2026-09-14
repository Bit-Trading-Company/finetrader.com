# Satflow API reference (mirror)

Offline copy of the Satflow docs, retrieved 2026-09-14. **Satflow is the
source of truth** — refresh with `node scripts/fetch-vendor-docs.mjs`.

40 reference pages plus the changelog, mirrored from the `llms.txt` index.
The site serves a `.md` variant of every page, so these are the vendor's own
Markdown rather than a conversion.

## Audit, 2026-09-14

We are on the **current** API. Every endpoint this app calls matches the
documented set on the documented base URL (`https://api.satflow.com/v1`),
with the camelCase parameter names v1.1.0 introduced:

`/item`, `/list`, `/cancel`, `/collection-stats`, `/collection-stats/floors`,
`/address/wallet-contents`, `/activity/listings`, `/activity/bids`,
`/bid/place`, `/intent/sell`, `/intent/secure-purchase`,
`/intent/satflow-purchase`, `/purchase/broadcast`.

Two things to know:

- `changelog/v110.md` describes a `/rest/` path prefix. That is Satflow's
  internal dev naming; the published OpenAPI in these docs declares
  `https://api.satflow.com/v1`, which is what we use. Do not "migrate" to
  `/rest/` on the strength of the changelog alone.
- The external-marketplace endpoints (`/intent/external-sell`,
  `/list-external`, `/intent/external-purchase`, `/purchase/external`) are
  documented as deprecated Magic Eden paths, blocked by default. We do not
  call them, and should not start.

`server/satflow.js` also reaches `backend.satflow.com/trpc` for the bidding
wallet setup, which is not part of these public docs and could change without
notice.
