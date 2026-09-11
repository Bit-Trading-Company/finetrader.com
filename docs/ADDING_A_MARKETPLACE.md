# Adding a marketplace

Auto-trading reaches marketplaces only through **adapters** registered in
[`src/trading/exchanges.js`](../src/trading/exchanges.js). Satflow
(`src/trading/satflow/`) and ord.net (`src/trading/ordnet/`) are the two
working examples.

## What an adapter is

An object that implements the `MarketplaceAdapter` typedef in `exchanges.js`:

| Member                                                        | Used for                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `id`                                                          | Value stored in AutoTrade settings (`TRADING_EXCHANGES`)                                            |
| `label`                                                       | Name shown in the trading console                                                                   |
| `getItemUrl(inscriptionId)`                                   | Link printed in the trading console                                                                 |
| `fetchCollectionItems`                                        | Floor listings, cheapest first                                                                      |
| `getFloorPrice`                                               | Floor price in sats (also used to pre-fill AutoTrade prices)                                        |
| `fetchWalletOrdinals`                                         | Items a proxy wallet holds (and whether they are listed)                                            |
| `checkPurchaseConfirmed`                                      | Whether a bought item has reached the buyer                                                         |
| `listOrdinalWithProxyWallet` / `delistOrdinalWithProxyWallet` | Listing management                                                                                  |
| `prepareSecurePurchase` / `completeSecurePurchase`            | Two-step purchase: prepare signs any setup step without broadcasting; complete signs and broadcasts |

The engine (`src/trading/autoTradeEngine.js`) passes a trailing `options`
object to every method (`{ wallet, wallets, network, collectionSymbol,
selectedCollection, ... }`). Use it when the marketplace needs a signed-in
session or wallet context (ord.net does); ignore it otherwise (Satflow does).

Items returned by the fetch methods must look like the existing ones:

- an inscription id readable by `getTokenId` / `getInscriptionId`
  (`src/trading/ordinals.js`)
- `listed` (boolean) and `listedPrice` (sats)
- `mempoolTxId`: `''` when nothing is pending, otherwise the pending txid
- `owner`, `collectionSymbol`, and display fields (`inscriptionNumber`,
  `contentURI`, `meta.name`)

See `normalizeListing` in `src/trading/ordnet/ordnetTrading.js` for a compact
mapping from a marketplace's API rows to this shape.

Token helpers, chain lookups (confirmations, balances) and the trading-fee
transaction are exchange-independent. Import them from `ordinals.js`,
`chain.js` and `feeTransaction.js` rather than re-implementing them.

## Steps

1. **API access.** If the marketplace needs an API key or blocks browser CORS,
   add a server proxy:
   - `server/<name>.js`: the handler (use the helpers in `server/lib/http.js`;
     read keys through `server/lib/env.js`)
   - `api/<name>.js`: one line, `module.exports = require('../server/<name>').handle<Name>;`
   - `server/routes.js`: add the route to `DEV_ROUTES` so `npm start` serves it
   - `.env.example`: document any new environment variable, then set it in Vercel
   - `server/routes.test.js` fails if `api/` and the dev routes drift apart
2. **Trading module.** Create `src/trading/<name>/` with the API calls and
   signing flows (for example `<name>Trading.js`).
3. **Adapter.** Add `src/trading/<name>/<name>Adapter.js` exporting an object
   annotated `/** @type {import('../exchanges').MarketplaceAdapter} */`.
4. **Register it.** Import the adapter in `exchanges.js` and add it to
   `ADAPTERS`. `TRADING_EXCHANGES` gets a matching entry.
5. **UI.** Nothing to do: the AutoTrade exchange selector renders from
   `TRADING_EXCHANGE_OPTIONS`, so registering the adapter adds its radio
   button and its label to the trading console messages. If the marketplace
   needs a signed-in wallet even for reads (as ord.net does), set
   `needsWalletForReads: true` on the adapter and the page will wait for a
   proxy wallet before asking for floor prices.
6. **Test.** Start with a small amount on one proxy wallet: floor price →
   list → delist → buy one item → confirmation → trading fee.

## Current gaps

- Satflow's `delistOrdinalWithProxyWallet` is not implemented and reports
  failure. Satflow's v1 API has `POST /cancel` (see
  `docs/reference/satflow-openapi.json`).
- The manual Dashboard flows (`src/features/marketplace/`) call Satflow
  directly and do not use adapters yet.
