# ord.net API reference (mirror)

Offline copy of the ord.net developer docs, retrieved 2026-09-14.
**ord.net is the source of truth** — re-run the fetch below if anything here
looks stale.

| File | What it covers |
| --- | --- |
| `index.md` | Base URL, JSON shape, the PSBT flow behind every write, pagination |
| `authentication.md` | BIP-322 wallet auth, the 0.01 BTC funding requirement, wallet bindings |
| `collections.md` | Floor stats by slug, cursor-paginated collection inscriptions |
| `listings.md` | `GET /listings`, listing/delisting preflight + submit |
| `buying.md` | Purchase preflight + submit, `spendableUtxos` |
| `offers.md` | The full offer lifecycle (buyer, seller counter, accept, reject) |
| `sales.md` | Sale history |
| `errors-rate-limits.md` | Status codes and the per-IP / per-profile rate limits |
| `openapi.json` | OpenAPI 3.1, 35 operations, 125 schemas — authoritative |
| `llms.txt` | Upstream index that enumerates the doc set |

## Known drift from the published docs

`authentication.md` says the funding floor is **0.01 BTC**. ord.net lowered it
to **0.001 BTC** and has not updated the docs (confirmed with them directly,
2026-09-14). The app uses 0.001 — see `ORDNET_MIN_FUNDING_SATS` in
`src/trading/ordnet/ordnetTrading.js`. If a funded wallet is refused with a
403, check whether it has moved again.

Completeness was checked two ways: `llms.txt` and `sitemap-0.xml` both list the
same eight pages, and all eight are mirrored here.

## Refreshing

The docs site is Astro/Starlight and serves no Markdown variants, so the pages
are converted from HTML. The script used lives in this repo's history; it
fetches each URL above, extracts the article body, converts with Turndown +
GFM tables, strips Starlight's per-heading anchor links, and re-indents the
JSON samples (the site emits them without newlines).

```bash
curl -sS https://developers.ord.net/openapi.json -o docs/reference/ordnet/openapi.json
curl -sS https://developers.ord.net/llms.txt     -o docs/reference/ordnet/llms.txt
```
