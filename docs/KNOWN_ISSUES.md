# Known issues

Problems found during the 2026-09 refactor that were not fixed because they
need a product decision, real-wallet testing, or a larger change. Fixed bugs
are in the git history.

## Security and deployment

- **Rotate API keys.** Magic Eden, Satflow and Hiro keys were hardcoded before
  the refactor and remain in git history. Rotate the Satflow and Hiro keys;
  revoke the Magic Eden key.
- **Environment variables are required.** There are no hardcoded fallbacks:
  set `SATFLOW_API_KEY` and `UNISAT_API_KEY` in Vercel and in a local `.env`.
  Without `SATFLOW_API_KEY`, Satflow answers 403 and the collection lists show
  "HTTP error! status: 502".
- **Open API relay.** `/api/*` responds with `Access-Control-Allow-Origin: *`
  and has no origin check or rate limit, so anyone can spend the Satflow and
  UniSat quotas through it.
- **Hiro key is public.** `REACT_APP_HIRO_API_KEY` is embedded in the browser
  bundle.
- **Deployment not yet verified.** The new `server/` + `api/` layout passes
  local builds and route tests but has not been deployed to Vercel yet.

## Fund safety

- **Fee inputs and runes.** `feeTransaction.js` (`isOutpointSafeNonOrdinal`)
  trusts the address-level inscription outpoint list when UniSat or Satflow
  returns one; only the per-UTXO fallback checks rune balances. A proxy wallet
  holding runes could spend a rune UTXO as a fee input. It still fails closed
  when no inscription source is reachable.
- **Collection offers use the wrong address.** `CollectionOfferModal` reads
  `connectedAddress.payment` (the field is `payments`) and signs with the
  ordinals address. Fixing it needs payment-input signing and testing with
  real wallets.
- **Empty wallet subset.** With "custom wallet subset" enabled and no wallet
  ticked, `OrdinalExtractor` scans every proxy wallet (read-only), and
  AutoTrade's `getActiveWallets` also falls back to all wallets (its Start
  button is disabled in that state). The Consolidator now selects none.
- **Unused prep helpers.** `waitForPrepsToConfirm`, `getPendingPrep` and
  `addPendingPrep` in `satflowPurchase.js` belong to an older purchase flow.
  Only `removePendingPrep` is still called, so the pending-preps localStorage
  entry is cleaned up but never written.

## Trading and marketplaces

- **Satflow delist is not implemented.** `delistOrdinalWithProxyWallet`
  reports failure. Satflow's v1 API has `POST /cancel`
  (`docs/reference/satflow-openapi.json`).
- **Private Satflow endpoints.** Some operations use Satflow's undocumented
  tRPC backend (`createPsbt.*`, `collections.search`) and can break without
  notice.
- **Manual flows bypass adapters.** Dashboard buy/sell and bids
  (`src/features/marketplace/`) call Satflow directly.
- **Exchange selector is hardcoded.** AutoTrade renders two radio buttons and
  has a few ord.net-specific checks (`TRADING_EXCHANGES.ORDNET`).
- **AutoTrade step 3 never auto-completes.** The dispatch confirmation polling
  in `AutoTrade.jsx` watches `dispatchTxIds`, which is never set because the
  Dispatch modal does not report transaction ids back. A no-op
  `checkForWallets` effect sits next to it.
- **Magic Eden marketplace removed.** Magic Eden shut down its Ordinals
  marketplace, so its trading code was deleted. The Magic Eden _wallet_
  connector stays because proxy wallets are derived from wallet signatures.

## Wallets

- `/home` panels each have their own wallet providers, so connection state is
  not shared between panels.
- Connecting or disconnecting reloads the page.
- The WalletConnect "Portfolio" tab is a placeholder; "Network Login" is
  commented out.

## Legacy workspace (`/home`)

- Window menu toggles do nothing: they call `hide()` / `show()` on Golden
  Layout content items, which version 1.5.9 does not have (only item
  containers do). File, Edit and Settings menu items emit events nothing
  listens to.

## Styles

- **CSS leaks across pages.** All CSS is bundled globally, so page rules apply
  on every route: `body` is redefined by `Splash.css` (margin 0, overflow
  hidden), `WalletConsolidator.css` and `AutoTrade.css` (overflow auto), and
  whichever loads last wins; `Splash.css` sets `h1 { font-size: 4vw }`;
  `Dashboard.css` and `Analytics.css` both override `.component-header`. Fix
  with page-scoped class names or CSS Modules during the redesign.
- **Parallel stylesheets.** `Dashboard.css` and `Analytics.css` share hundreds
  of lines under different class prefixes. Real deduplication needs shared
  class names in the JSX.
- **Inline colors.** Many components still use inline `style` objects with hex
  colors that are not tokenized.

## Code structure follow-ups

- Large files that would benefit from splitting: `CollectionOfferModal.jsx`,
  `SellOrdinal.jsx`, `Analytics.jsx`, `Dispatch.jsx`, `CreatePSBT.jsx`,
  `WalletDetails.jsx`.
- The strategies in `autoTradeEngine.js` repeat the same prepare -> complete ->
  fee -> pending loop; it could become one helper.

## Tooling

- `yarn.lock` is stale (the refactor used npm). Confirm Vercel installs with
  npm, then delete `yarn.lock`.
- Browserslist data (`caniuse-lite`) is out of date; run
  `npx update-browserslist-db@latest` when convenient.
