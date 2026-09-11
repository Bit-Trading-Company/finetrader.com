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

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Description |
|---|---|---|
| `SATFLOW_API_KEY` | Yes | Satflow API key used by every `/api/satflow-*` route |
| `UNISAT_API_KEY` | Yes | UniSat Open API key for inscription/UTXO scanning — [get one here](https://developer.unisat.io/) |
| `REACT_APP_HIRO_API_KEY` | Optional | Hiro API key for the inscriptions panel. Embedded in the browser bundle, so treat it as public |

API keys are only read on the server (`server/`): from `.env` during development and from the Vercel project settings in production. Without them, upstream requests are unauthenticated and usually fail with 401/403/429.

## Deployment (Vercel)

This project deploys to Vercel:

- `vercel.json` configures the build output (`build/`) and rewrites the public `/api/satflow-*` URLs onto the Satflow function
- `api/` holds one-line function entrypoints; the handlers live in `server/`
- `npm run build` produces the static frontend

Deploy by connecting the repo to Vercel. Set `SATFLOW_API_KEY` and `UNISAT_API_KEY` in the Vercel project environment settings.

## Routes

| Path | Page | Description |
|---|---|---|
| `/` | Splash | Landing / entry screen |
| `/auto-trade` | AutoTrade | Main automated trading interface |
| `/dashboard` | Dashboard | Wallet and portfolio overview |
| `/analytics` | Analytics | Trading analytics and charts |
| `/home` | Homepage | Legacy Golden Layout workspace |
| `/consolidator` | WalletConsolidator | UTXO consolidation tool |
| `/extractor` | OrdinalExtractor | Scan and extract inscription UTXOs |
| `/satflow-stats` | SatflowStats | Satflow collection statistics |

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
├── docs/reference/       # Upstream API specs (Satflow OpenAPI)
├── public/               # Static assets served as-is (index.html, favicon, manifest)
├── src/
│   ├── pages/            # Route-level views (one per URL)
│   ├── components/       # Reusable UI
│   │   └── layout/       # Trading UI: wallets, collections, PSBT signing, dispatch
│   ├── context/          # React context (theme, app state)
│   ├── hooks/            # Custom hooks (wallet connect, localStorage)
│   ├── modules/          # Feature modules (bitprint wallet integration)
│   ├── utils/            # Core logic: auto-trading, Bitcoin/PSBT, mempool, APIs
│   ├── assets/           # Images, fonts, SVGs
│   ├── App.js            # Route definitions
│   ├── index.js          # App entry point + wallet providers
│   └── setupProxy.js     # Dev server: mounts server/ handlers on /api/*
├── craco.config.js       # Webpack/Jest overrides (Node polyfills, ESM transforms)
└── vercel.json           # Vercel build config + API rewrites
```

### Key `src/` areas

- **`pages/`** — Top-level screens wired in `App.js`. `AutoTrade.jsx` is the core automated trading UI.
- **`components/layout/`** — Trading building blocks: wallet management, collection browser, PSBT creation/signing, buy/sell dispatch.
- **`utils/`** — Business logic separated from UI:
  - `simplifiedAutoTrading.js` / `autoTradingUtils.js` — automated buy/sell strategies (Satflow)
  - `ordNetTradingUtils.js` — ord.net exchange integration
  - `tradingFeeUtils.js` — trading fee constants and cost estimates
  - `bitcoinUtils.js` — Bitcoin key derivation and PSBT signing
  - `extractorUtils.js` — inscription UTXO extraction
  - `consolidatorUtils.js` — wallet UTXO consolidation
  - `mempoolProvider.js` — mempool API abstraction
  - `unisatProxy.js` — `/api/unisat` URL builder

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start dev server (CRACO + hot reload) |
| `npm run build` | Production build to `./build` |
| `npm test` | Run tests (Jest; `src/` and `server/`) |
| `npm run test:ci` | CI test run with coverage |
| `npm run lint` | ESLint check (`src/`, `api/`, `server/`) |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |

## Tech Stack

- **React 18** + Create React App (customized with CRACO)
- **Bitcoin / Ordinals:** `@ordzaar/ord-connect`, `@ordzaar/ordit-sdk`, `bitcoinjs-lib`, `@scure/btc-signer`
- **Wallets:** OKX, Magic Eden Wallet, Leather, UniSat, Xverse (via OrdConnect)
- **Marketplaces:** Satflow, ord.net
- **Charts:** Recharts
- **Deployment:** Vercel serverless functions + static hosting

## License

MIT
