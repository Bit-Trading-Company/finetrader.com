# ord.net API reference (mirror)

Offline copy of the ord.net developer docs, retrieved 2026-10-07.
**ord.net is the source of truth** — re-run the fetch below if anything here
looks stale.

| File | What it covers |
| --- | --- |
| `index.md` | Base URL, JSON shape, the PSBT flow behind every write, pagination |
| `authentication.md` | BIP-322 wallet auth, the 0.001 BTC funding requirement, wallet bindings |
| `collections.md` | Floor stats by slug, cursor-paginated collection inscriptions |
| `listings.md` | `GET /listings`, listing/delisting preflight + submit |
| `buying.md` | Purchase preflight + submit, `spendableUtxos` |
| `offers.md` | The full offer lifecycle (buyer, seller counter, accept, reject) |
| `sales.md` | Sale history |
| `trading.md` | Public P2P trade proposals (`GET /trading`, read-only; unused by the app) |
| `errors-rate-limits.md` | Status codes and the per-IP / per-profile rate limits |
| `openapi.json` | OpenAPI 3.1, 36 operations, 132 schemas — authoritative |
| `llms.txt` | Upstream index that enumerates the doc set |

## Known drift from the published docs

None at the last refresh. The funding floor that used to differ (docs said
0.01 BTC, ord.net enforced 0.001) is now documented as 0.001 BTC, matching
`ORDNET_MIN_FUNDING_SATS` in `src/trading/ordnet/ordnetTrading.js`.

## Not in the docs, learned from mainnet

The listing escrow behind step `1` and the recovery PSBT is a script-path
output, not a key-path one:

    P2TR(internal key = seller's output key,
         leaf = <seller> CHECKSIG <ord.net> CHECKSIGADD 2 NUMEQUAL)

Read off settlement `c2067d514c85029b3117ead8baf4d75d0a7afb6cb687bddf0d67da4b4506e51b`
(input 2 spends the escrow made by `b6d8eee1…15c5`). The seller key in the
leaf is the address's output key, so the seller signs that leaf with the
tweaked key. The listing transfer (step `0`) is not broadcast at listing
time: it goes out in the same package as the settlement, so a listed
inscription stays at the seller's address until it sells.

## What changed at the 2026-10-07 refresh

- `durationDays` on listing submit is optional; omitting it makes a
  non-expiring listing. The app still sends 30.
- Listing preflight/submit return `409` when an active offer is priced above
  the ask. The app reports that in plain words.
- Purchases gained an opt-in `roundUpDonation` (default off; the app leaves it
  off) and `donationSats` / `donationInitiative` in the preflight response.
- Offers: `validityHours` accepts `6`; seller acceptance submit now requires
  `targetFeeRateSatVb` (1–20). The app does not use ord.net offers.
- New read-only `GET /trading` (P2P proposals) and `trading.md`.

Completeness was checked two ways: `llms.txt` and `sitemap-0.xml` both list the
same nine pages, and all nine are mirrored here.

## Refreshing

The docs site is Astro/Starlight and serves no Markdown variants, so the pages
are converted from HTML by `fetch-docs.mjs` (this directory). It fetches each
page, extracts the article body, converts with Turndown + GFM tables, strips
Starlight's per-heading anchor links, and re-indents the JSON samples (the
site emits them without newlines). Its dependencies are not app dependencies,
so run it from a scratch directory:

```bash
npm i turndown turndown-plugin-gfm domino
node fetch-docs.mjs <path-to>/docs/reference/ordnet
curl -sS https://developers.ord.net/openapi.json -o docs/reference/ordnet/openapi.json
curl -sS https://developers.ord.net/llms.txt     -o docs/reference/ordnet/llms.txt
```
