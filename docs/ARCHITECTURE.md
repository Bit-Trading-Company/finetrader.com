# Architecture

Fine Trader is a single-page React app for trading Bitcoin Ordinals with
"proxy wallets" (hot wallets derived from the user's own wallet). It runs as a
static Create React App build plus a handful of API functions on Vercel. In
development the same API handlers run inside the CRA dev server.

For setup and scripts see the [README](../README.md). For open problems see
[KNOWN_ISSUES.md](KNOWN_ISSUES.md). To add a marketplace see
[ADDING_A_MARKETPLACE.md](ADDING_A_MARKETPLACE.md).

## Runtime layout

```
Browser (React app)
 ├─ /api/*  ──> Vercel functions (production) or src/setupProxy.js (dev)
 │             └─ server/ handlers ──> Satflow v1 API + Satflow tRPC backend
 │                                    UniSat Open API (inscription/UTXO index)
 │                                    ord.net API
 ├─ mempool.space / blockstream.info  (fees, UTXOs, broadcast, confirmations)
 ├─ ordinals.com                      (inscription content and metadata)
 └─ Hiro API                          (inscriptions panel on /home)
```

API keys (`SATFLOW_API_KEY`, `UNISAT_API_KEY`) are read only on the server
(`server/lib/env.js`). Calls that need a key go through `/api/*`; public data
sources are called from the browser directly.

## Source map

| Path                                           | Responsibility                                                                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.js`                                 | Entry point: MetaMask injection guards, global tokens and fonts, root providers (`ErrorBoundary` > `BrowserRouter` > `OrdConnectProvider`)               |
| `src/app/`                                     | App shell: routes (`App.jsx`, wraps routes in `BitprintProvider`), `ErrorBoundary`, theme context                                                        |
| `src/pages/<Route>/`                           | One folder per route with its CSS and page-only helpers, components and hooks                                                                            |
| `src/components/`                              | Shared UI primitives used by several pages (`WizardStep`)                                                                                                |
| `src/features/wallet/`                         | Wallet connect, connection state (`useWalletConnection`), proxy wallet generation and selection (`WalletManagement`), funding proxy wallets (`Dispatch`) |
| `src/features/marketplace/`                    | Collection browser, collection details and bids, manual buy/sell (Satflow)                                                                               |
| `src/features/psbt/`, `src/features/explorer/` | PSBT create/sign tools and inscription/UTXO explorers (legacy `/home` workspace)                                                                         |
| `src/trading/`                                 | Trading logic with no UI: marketplace adapters, auto-trade engine, fees, chain lookups                                                                   |
| `src/lib/`                                     | UI-free helpers: key derivation and PSBT signing (`bitcoinUtils`), mempool provider URLs, UniSat proxy URLs, formatting, event hub, encoding             |
| `src/styles/`                                  | `tokens.css` (color palette), `fonts.css` (`@font-face`), `global.css` (shared styles)                                                                   |
| `server/`                                      | API handlers shared by Vercel and the dev server, plus `lib/` (HTTP relay and validation, env-only keys, TTL cache)                                      |
| `api/`                                         | Vercel function entrypoints, one line each (`module.exports = require('../server/...')`)                                                                 |
| `docs/reference/`                              | Upstream API specs (Satflow OpenAPI)                                                                                                                     |

## Routes

| Path             | Page                 | Notes                                                 |
| ---------------- | -------------------- | ----------------------------------------------------- |
| `/`              | `Splash`             | Landing screen                                        |
| `/auto-trade`    | `AutoTrade`          | Main product: 5-step wizard ending in the auto-trader |
| `/dashboard`     | `Dashboard`          | Wallets, collections, manual buy/sell                 |
| `/analytics`     | `Analytics`          | Wallet and trading analytics                          |
| `/consolidator`  | `WalletConsolidator` | Sweep BTC from proxy wallets to one address           |
| `/extractor`     | `OrdinalExtractor`   | Scan wallets for inscription UTXOs and move them      |
| `/satflow-stats` | `SatflowStats`       | Satflow collection statistics                         |
| `/home`          | `Homepage`           | Legacy Golden Layout multi-panel workspace            |

## Wallets

**Connected wallet.** `OrdConnectProvider` (from `@ordzaar/ord-connect`) at the
root holds the connected browser wallet (OKX, UniSat, Xverse, Magic Eden
Wallet, Leather). Pages use `useWalletConnection` for connect / disconnect;
both reload the page on success so components holding wallet-derived state
start fresh. `bitprint.tsx` keeps a small "explicitly disconnected" flag.

**Proxy wallets.** Trading happens from proxy wallets, not from the connected
wallet. `WalletManagement` asks the connected wallet to sign a message and
derives a deterministic list of Taproot key pairs from that signature
(`generateDeterministicWallets` in `src/lib/bitcoinUtils.js`; each key is
`sha256(sha256(signature) || index)`). The same wallet always produces the
same proxy wallets, so funds can be recovered by signing again.
`src/lib/bitcoinUtils.test.js` pins this derivation; changing it would strand
funds. Proxy wallets sign PSBTs locally (`signPsbtWithProxyWallet`, Taproot
key-path) and are funded through `Dispatch`.

**Cross-component events.** Pages create an event hub (`useEventHub` in
`src/lib/eventHub.js`) and pass it to feature components as `glEventHub` (the
name dates from Golden Layout). Common events: `wallets-generated`,
`wallet-selected`, `wallet-connection-changed`, `collection-selected`.

## Trading

```
AutoTrade page
 ├─ hooks/useAutoTradeSettings   settings state (mode, exchange, timer, prices, fees, wallet subset)
 ├─ hooks/useAutoTradeRunner     Start/Stop, timer-driven cycles, pending purchases
 └─ hooks/useTradingConsole      console log
      │
      ▼
trading/autoTradeEngine.js       strategies: processWalletItems, buyItemsFromFloor,
      │                          buyXFromEachWallet, sellXFromEachWallet
      ├─ trading/exchanges.js    getTradingApi(exchange) -> MarketplaceAdapter
      │    ├─ satflow/           satflowApi, satflowListing, satflowPurchase, satflowAdapter
      │    └─ ordnet/            ordnetTrading, ordnetAdapter
      ├─ trading/buyerSelection.js   which proxy wallet buys a listing (never the seller)
      ├─ trading/pendingPurchases.js pending purchase bookkeeping
      ├─ trading/ordinals.js     token / inscription id helpers
      ├─ trading/chain.js        confirmations, mempool presence, balances
      ├─ trading/fees.js         trading fee amounts and cost estimates
      └─ trading/feeTransaction.js  builds and broadcasts the trading fee tx
```

**Marketplace adapters.** The engine never calls a marketplace directly. Each
adapter implements the `MarketplaceAdapter` typedef in `exchanges.js` (fetch
listings, floor price, wallet items, list, delist, prepare and complete a
purchase, purchase confirmation).

**A trading cycle** (`processWalletItems`, used by delta-neutral and range
trading): check pending purchases for confirmation, list each wallet's ready
items, then have another proxy wallet buy them (prepare, then complete and
broadcast), send the trading fee, and record the purchase as pending until the
buyer owns the item. `useAutoTradeRunner` repeats cycles on a timer; each Start
gets a run id so a stopped run cannot keep trading.

**Satflow purchases** use the secure-purchase flow: the buyer signs a payment
prep PSBT, then purchase and transfer PSBTs, and all are broadcast together via
Satflow. **ord.net** requires a BIP-322 sign-in session per wallet; the
`/api/ordnet` proxy forwards the session token.

**Trading fee.** After a purchase the engine sends a fee (see `fees.js`) from
the buyer's proxy wallet. `feeTransaction.js` only spends UTXOs it can confirm
carry no inscriptions, and fails closed when it cannot check.

## Server and API

- `server/routes.js` is the route table. `src/setupProxy.js` mounts every
  entry on the dev server; in production each route is an `api/` function or a
  `vercel.json` rewrite onto one (Satflow operations share `api/satflow.js`
  and are selected with `?op=`).
- `server/satflow.js` maps operations to Satflow v1 endpoints and the Satflow
  tRPC backend. `server/unisat.js` and `server/ordnet.js` are validated
  pass-through proxies (`safeSubpath` rejects path traversal).
- `server/lib/http.js` holds shared CORS, method checks, body parsing and
  response relaying. `server/routes.test.js` keeps the route table, `api/` and
  `vercel.json` in sync.

## Legacy workspace (`/home`)

`Homepage` uses Golden Layout 1.5.9. Every panel is mounted as a separate
React root, outside the app's provider tree, so `Homepage` wraps each panel in
its own `BitprintProvider` and `OrdConnectProvider` (panels therefore have
isolated wallet state) and unmounts the root when Golden Layout destroys the
panel. Panels talk through Golden Layout's event hub. `MenuBar` sits above the
layout.

## Styles

All CSS is plain global CSS bundled into one stylesheet, because every page is
imported statically by `App.jsx`. Page CSS is co-located with its page but
applies app-wide, so class names are prefixed per page (`auto-trade-*`,
`consolidator-*`, `dashboard-*`). Colors come from `src/styles/tokens.css`
(`var(--color-*)`); fonts from `src/styles/fonts.css`. Some rules still leak
across pages (see KNOWN_ISSUES.md).

## Testing and checks

- `npm test`: Jest over `src/` and `server/`: proxy key derivation and PSBT
  signing, fee math, the marketplace registry, buyer rotation, pending
  purchase merging, server routes and handlers, HTTP helpers, formatting, the
  event hub, encoding.
- `npm run lint`: ESLint (with Prettier) over `src/`, `api/` and `server/`;
  `CI=true npm run build` treats warnings as errors.
- Wallet connection, signing and real trades cannot be covered by automated
  tests. Check them by hand with small amounts after changes to `src/lib`,
  `src/trading` or `src/features/wallet`.

## Conventions

- JavaScript with JSDoc for contracts (adapter typedef, hook parameters).
- Each module starts with a short header comment saying what it owns.
- `pages/` compose; reusable UI goes to `components/` or `features/<domain>/`;
  logic without UI goes to `trading/` or `lib/`.
- API keys never reach the browser bundle; add server routes for keyed APIs.
