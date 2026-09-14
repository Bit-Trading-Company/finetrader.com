# UniSat API reference (mirror)

Offline copy of the UniSat docs we depend on, retrieved 2026-09-14.
**UniSat is the source of truth** — refresh with
`node scripts/fetch-vendor-docs.mjs`.

UniSat's `llms.txt` indexes 335 pages covering their whole product. Only the
indexer and collection surfaces this app calls are mirrored here (36 pages),
plus `collection-indexer-swagger.yaml` — their full OpenAPI 3.0.3 spec,
v1.0.4, which is the authoritative reference.

## Audit, 2026-09-14

Every endpoint this app calls exists in the spec and is current:

| Used for | Path |
| --- | --- |
| Inscription UTXOs by address (holdings) | `/v1/indexer/address/{address}/inscription-utxo-data` |
| All UTXOs by address | `/v1/indexer/address/{address}/utxo-data` |
| Per-UTXO inscription check | `/v1/indexer/utxo/{txid}/{index}` |

The API key in `.env` was verified working against the first two on
2026-09-14 (`code: 0, msg: "ok"`). No replacement needed.

Note the proxy in `server/unisat.js` hardcodes the `/v1/indexer/` prefix, so
it cannot currently reach `/v1/collection-indexer/...`. That is deliberate:
UniSat's collection endpoints key on **their** `collectionId`, which has no
cross-walk to an ord.net or Satflow slug, so they are not usable for
per-collection filtering here. See `fetchWalletOrdinals` in
`src/trading/ordnet/ordnetTrading.js` for what we do instead.
