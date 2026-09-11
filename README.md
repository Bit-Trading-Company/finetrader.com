# Fine Trader

A React Web3 dapp for automated Bitcoin Ordinals trading. Connect a Bitcoin wallet, browse collections, and run automated buy/sell strategies against marketplace APIs (Satflow and ord.net).

## Quick Start

**Requirements:** Node.js `>=20.19.0` (see `.nvmrc`)

```bash
npm install
cp .env.example .env   # then add your API keys
npm start
```

The app opens at [http://localhost:3000](http://localhost:3000). `npm start` runs the CRA dev server (via CRACO) with hot reload, and `src/setupProxy.js` mounts the same `/api/*` handlers the Vercel functions use in production.

For a production build locally:

```bash
npm run build
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the app, API layer, wallets and trading engine fit together
- [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) — open problems, including security and fund-safety notes (read before deploying)
- [docs/ADDING_A_MARKETPLACE.md](docs/ADDING_A_MARKETPLACE.md) — the marketplace adapter contract and steps

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable                 | Required | Description                                                                                      |
| ------------------------ | -------- | ------------------------------------------------------------------------------------------------ |
| `SATFLOW_API_KEY`        | Yes      | Satflow API key used by every `/api/satflow-*` route                                             |
| `UNISAT_API_KEY`         | Yes      | UniSat Open API key for inscription/UTXO scanning — [get one here](https://developer.unisat.io/) |
| `REACT_APP_HIRO_API_KEY` | Optional | Hiro API key for the inscriptions panel. Embedded in the browser bundle, so treat it as public   |

API keys are only read on the server (`server/`): from `.env` during development and from the Vercel project settings in production. Without them, upstream requests are unauthenticated and usually fail with 401/403/429.

## Deployment (Vercel)

This project deploys to Vercel:

- `vercel.json` configures the build output (`build/`) and rewrites the public `/api/satflow-*` URLs onto the Satflow function
- `api/` holds one-line function entrypoints; the handlers live in `server/`
- `npm run build` produces the static frontend

Deploy by connecting the repo to Vercel. Set `SATFLOW_API_KEY` and `UNISAT_API_KEY` in the Vercel project environment settings.

## Routes

| Path             | Page               | Description                        |
| ---------------- | ------------------ | ---------------------------------- |
| `/`              | Splash             | Landing / entry screen             |
| `/auto-trade`    | AutoTrade          | Main automated trading interface   |
| `/dashboard`     | Dashboard          | Wallet and portfolio overview      |
| `/analytics`     | Analytics          | Trading analytics and charts       |
| `/home`          | Homepage           | Legacy Golden Layout workspace     |
| `/consolidator`  | WalletConsolidator | UTXO consolidation tool            |
| `/extractor`     | OrdinalExtractor   | Scan and extract inscription UTXOs |
| `/satflow-stats` | SatflowStats       | Satflow collection statistics      |

## Project Structure

```
finetrader.com/
├── api/                  # Vercel function entrypoints (one line each; logic in server/)
├── server/               # API handlers shared by Vercel (api/) and the dev server (src/setupProxy.js)
│   ├── routes.js         # Public /api route table (a test keeps it in sync with vercel.json)
│   ├── satflow.js        # Satflow v1 API + tRPC handlers (?op=...)
│   ├── unisat.js         # UniSat indexer proxy
│   ├── ordnet.js         # ord.net proxy
│   └── lib/              # HTTP relay/validation, env-only API keys, TTL cache
├── docs/                 # Architecture, known issues, adding a marketplace
│   └── reference/        # Upstream API specs (Satflow OpenAPI)
├── public/               # Static assets served as-is (index.html, favicon, manifest)
├── src/
│   ├── index.js          # Entry point: MetaMask guards, global tokens/fonts, root providers
│   ├── setupProxy.js     # Dev server: mounts server/ handlers on /api/*
│   ├── app/              # App shell: routes (App.jsx), ErrorBoundary, theme context
│   ├── pages/            # One folder per route, with its CSS and page-only helpers, components and hooks
│   ├── components/       # Shared UI primitives (WizardStep)
│   ├── features/
│   │   ├── wallet/       # Wallet connect, proxy wallet generation/selection, funding (Dispatch)
│   │   ├── marketplace/  # Collection browser, collection bids, manual buy/sell (Satflow)
│   │   ├── psbt/         # PSBT create/sign tools (legacy /home workspace)
│   │   └── explorer/     # Inscription and UTXO explorers (legacy /home workspace)
│   ├── trading/          # Auto-trade engine + marketplace adapters (Satflow, ord.net)
│   ├── lib/              # UI-free helpers: keys & PSBT signing, mempool URLs, UniSat proxy URLs
│   ├── styles/           # tokens.css (color palette), fonts.css, global.css; all CSS applies app-wide
│   └── assets/           # Images, fonts, SVGs
├── craco.config.js       # Webpack/Jest overrides (Node polyfills, ESM transforms)
└── vercel.json           # Vercel build config + API rewrites
```

### Key `src/` areas

- **`pages/`** — Route screens wired in `app/App.jsx`. `AutoTrade/` is the core automated trading UI (`components/` for the step UI, `hooks/` for settings, the trading run and the console); `Homepage/` is the legacy Golden Layout workspace.
- **`components/`** — Shared UI primitives, e.g. `WizardStep` for the AutoTrade, Consolidator and Extractor wizards.
- **`features/`** — UI shared across pages, grouped by domain (wallet, marketplace, PSBT tools, explorers).
- **`trading/`** — Business logic for trading:
  - `exchanges.js` — marketplace registry and the `MarketplaceAdapter` contract; `getTradingApi(exchange)` returns an adapter
  - `autoTradeEngine.js` — auto-trade strategies (trading cycles, floor buys, buy/sell X per wallet)
  - `satflow/` — Satflow adapter: API reads, listing, secure purchase
  - `ordnet/` — ord.net adapter and trading integration
  - `ordinals.js`, `chain.js` — exchange-independent token helpers and chain lookups (confirmations, balances)
  - `fees.js`, `feeTransaction.js` — trading fee amounts and the fee transaction
  - Adding a marketplace: [docs/ADDING_A_MARKETPLACE.md](docs/ADDING_A_MARKETPLACE.md)
- **`lib/`** — `bitcoinUtils.js` (proxy wallet key derivation, PSBT signing), `mempoolProvider.js` (mempool.space / Blockstream URLs), `unisatProxy.js` (`/api/unisat` URLs)

## Scripts

| Command            | Description                              |
| ------------------ | ---------------------------------------- |
| `npm start`        | Start dev server (CRACO + hot reload)    |
| `npm run build`    | Production build to `./build`            |
| `npm test`         | Run tests (Jest; `src/` and `server/`)   |
| `npm run test:ci`  | CI test run with coverage                |
| `npm run lint`     | ESLint check (`src/`, `api/`, `server/`) |
| `npm run lint:fix` | ESLint auto-fix                          |
| `npm run format`   | Prettier format                          |

## Tech Stack

- **React 18** + Create React App (customized with CRACO)
- **Bitcoin / Ordinals:** `@ordzaar/ord-connect`, `@ordzaar/ordit-sdk`, `bitcoinjs-lib`, `@scure/btc-signer`
- **Wallets:** OKX, Magic Eden Wallet, Leather, UniSat, Xverse (via OrdConnect)
- **Marketplaces:** Satflow, ord.net
- **Charts:** Recharts
- **Deployment:** Vercel serverless functions + static hosting

## License

MIT
