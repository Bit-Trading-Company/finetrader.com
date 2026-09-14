# Known issues

Problems found during the 2026-09 refactor that were not fixed because they
need a product decision, real-wallet testing, or a larger change. Fixed bugs
are in the git history.

## Security and deployment

- **Old API keys in git history.** Keys were hardcoded before the refactor. The
  Satflow key only ever lived in server-side code (the old `src/setupProxy.js`)
  in this private repository, and it cannot be replaced, so keep the repository
  private and scrub the history before ever making it public. The Magic Eden
  and Hiro keys did ship in the public browser bundle: revoke both (neither is
  used any more).
- **Environment variables are required.** There are no hardcoded fallbacks:
  set `SATFLOW_API_KEY` and `UNISAT_API_KEY` in Vercel and in a local `.env`.
  Without `SATFLOW_API_KEY`, Satflow answers 403 and the collection lists show
  "HTTP error! status: 502".
- **API rate limiting.** `/api/*` now answers only requests from the site's own
  origin (or `ALLOWED_ORIGINS`), which stops other websites from spending the
  Satflow and UniSat quotas through their visitors' browsers. Scripts can still
  forge those headers, so add a rate-limit rule for `/api/*` in the Vercel
  firewall — the Satflow key cannot be replaced if it gets abused.
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
- **Pending-prep storage is never written.** `satflowPurchase.js` still clears
  `fine-trading-pending-secure-preps` (`removePendingPrep`), but nothing writes
  it since the older "broadcast the prep, wait, then complete" flow was
  dropped.

## Trading and marketplaces

- **Satflow delist is not implemented.** `delistOrdinalWithProxyWallet`
  reports failure. Satflow's v1 API has `POST /cancel`
  (`docs/reference/satflow-openapi.json`).
- **Private Satflow endpoints.** Some operations use Satflow's undocumented
  tRPC backend (`createPsbt.*`, `collections.search`) and can break without
  notice.
- **Manual flows bypass adapters.** Dashboard buy/sell and bids
  (`src/features/marketplace/`) call Satflow directly.
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

- **Legacy typography still forces fonts.** `global.css` sets the app font on
  every element (so fonts do not inherit) and paints `<p>` white. Those rules
  now skip anything inside an element with `class="ds-root"`, so redesigned UI
  inherits normally; delete them once no legacy page is left.
- **Generic legacy class names.** `global.css` styles names like
  `.wallet-item`, `.pagination` and `.loading-spinner` app-wide, and every page
  stylesheet is bundled on every route. New components should use CSS Modules
  (`*.module.css`, supported out of the box) so they cannot collide.
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
