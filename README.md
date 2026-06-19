# Fine Trader

A React Web3 dapp for automated Bitcoin Ordinals trading. Connect a Bitcoin wallet, browse collections, and run automated buy/sell strategies against marketplace APIs (Satflow, Magic Eden, UniSat, and more).

## Quick Start

**Requirements:** Node.js `>=18.17.1` (see `.nvmrc`)

```bash
npm install
cp .env.example .env   # then add your API keys
npm start
```

The app opens at [http://localhost:3000](http://localhost:3000). No build step is needed for local development — `npm start` runs the CRA dev server with hot reload via CRACO.

For a production build locally:

```bash
npm run build
```

To build and optionally serve the production bundle:

```bash
npm run start:prod          # builds to ./build
npm run start:prod -- --serve   # build + serve on port 3000
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Required | Description |
|---|---|---|
| `MAGIC_EDEN_API_KEY` | Recommended | Magic Eden API key — [get one here](https://magiceden.io/developers) |
| `UNISAT_API_KEY` | Recommended | UniSat Open API key for inscription/UTXO scanning — [get one here](https://developer.unisat.io/) |
| `SATFLOW_API_KEY` | Vercel only | Satflow API key for serverless proxy routes (set in Vercel project env) |

Without API keys, unauthenticated requests may be rate-limited or return 403.

## Deployment (Vercel)

This project is Vercel-ready out of the box:

- `vercel.json` configures the build output (`build/`) and API rewrites for Satflow routes
- `api/` contains serverless functions that proxy marketplace APIs and keep keys server-side
- `npm run vercel-build` (or `npm run build`) produces the static frontend

Deploy by connecting the repo to Vercel. Set `MAGIC_EDEN_API_KEY`, `UNISAT_API_KEY`, and `SATFLOW_API_KEY` in the Vercel project environment settings.

Google App Engine deployment is also supported via `app.yaml` if needed.

## Routes

| Path | Page | Description |
|---|---|---|
| `/` | Splash | Landing / entry screen |
| `/auto-trade` | AutoTrade | Main automated trading interface |
| `/dashboard` | Dashboard | Wallet and portfolio overview |
| `/analytics` | Analytics | Trading analytics and charts |
| `/home` | Homepage | Marketing / info page |
| `/consolidator` | WalletConsolidator | UTXO consolidation tool |
| `/extractor` | OrdinalExtractor | Scan and extract inscription UTXOs |
| `/satflow-stats` | SatflowStats | Satflow collection statistics |

## Project Structure

```
finetrader.com/
├── api/                  # Vercel serverless functions (marketplace API proxies)
│   ├── satflow.js        # Consolidated Satflow router (bids, listings, PSBTs, etc.)
│   ├── unisat.js         # UniSat Open API proxy
│   ├── magiceden-psbt.js # Magic Eden PSBT endpoints
│   ├── collections.js    # Collection data
│   └── ...
├── config/               # Webpack / dev-server config (CRA internals)
├── public/               # Static assets served as-is (index.html, favicon, manifest)
├── scripts/              # Node utility scripts
│   ├── start-prod.js     # Production build (+ optional local serve)
│   ├── build.js          # Build helpers
│   └── ...               # CI / workflow helpers
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
│   └── setupProxy.js     # Dev-only API proxy (mirrors Vercel /api routes locally)
├── craco.config.js       # Webpack overrides (Node polyfills for Bitcoin libs)
├── vercel.json           # Vercel build config + API rewrites
└── app.yaml              # Google App Engine config (optional)
```

### Key `src/` areas

- **`pages/`** — Top-level screens wired in `App.js`. `AutoTrade.jsx` is the core automated trading UI.
- **`components/layout/`** — Trading building blocks: wallet management, collection browser, PSBT creation/signing, buy/sell dispatch.
- **`utils/`** — Business logic separated from UI:
  - `simplifiedAutoTrading.js` / `autoTradingUtils.js` — automated buy/sell strategies
  - `bitcoinUtils.js` — Bitcoin transaction helpers
  - `extractorUtils.js` — inscription UTXO extraction
  - `consolidatorUtils.js` — wallet UTXO consolidation
  - `mempoolProvider.js` — mempool API abstraction
  - `apiClient.js` — frontend API client
- **`api/`** — Server-side proxies used in production on Vercel. In development, `setupProxy.js` routes the same `/api/*` paths to external services.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start dev server (CRACO + hot reload) |
| `npm run build` | Production build to `./build` |
| `npm run vercel-build` | Alias for `build` (used by Vercel) |
| `npm run start:prod` | Build for production; add `-- --serve` to serve locally |
| `npm test` | Run tests (Jest) |
| `npm run test:ci` | CI test run with coverage |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |

## Tech Stack

- **React 18** + Create React App (customized with CRACO)
- **Bitcoin / Ordinals:** `@ordzaar/ord-connect`, `@ordzaar/ordit-sdk`, `bitcoinjs-lib`, `sats-connect`
- **Wallets:** OKX, Magic Eden, Leather, UniSat, Xverse (via OrdConnect)
- **Charts:** Recharts
- **Deployment:** Vercel serverless functions + static hosting

## License

MIT
