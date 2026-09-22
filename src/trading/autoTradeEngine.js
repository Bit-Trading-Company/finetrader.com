/**
 * Auto-trade engine: the strategies run by the AutoTrade page.
 *
 * - processWalletItems: one trading cycle (delta neutral and range trading):
 *   list ready items, buy them from the next wallet, confirm pending purchases.
 * - buyItemsFromFloor: buy N floor listings before auto-trading starts.
 * - buyXFromEachWallet: buy up to X floor listings per proxy wallet, then stop.
 * - sellXFromEachWallet: list X items from each proxy wallet, then stop.
 *
 * Marketplace calls go through the adapter returned by
 * requireTradingApi(exchange) (see ./exchanges), which throws rather than
 * falling back: every function here spends real coin, and a missing exchange
 * silently defaulting to Satflow would trade on the wrong marketplace. Token
 * ids, chain lookups, balances and the trading fee transaction are
 * exchange-independent and imported directly.
 */

import { getMempoolTxUrl } from '../lib/mempoolProvider';
import { getBuyerCandidates } from './buyerSelection';
import { checkTransactionConfirmed, fetchWalletBalance } from './chain';
import { requireTradingApi, getItemLink, getExchangeLabel } from './exchanges';
import { estimateAutoTradePurchaseCost } from './fees';
import { sendTradingFee } from './feeTransaction';
import {
  hasPendingTransaction,
  getTokenId,
  getInscriptionId,
} from './ordinals';

/**
 * Process all wallet items: list if needed, buy from next wallet
 *
 * Used for **both** Delta neutral (`auto-buy-sell`) and **Range trading** — same code path.
 * AutoTrade passes `tradePrice: null` (floor) for delta neutral, or a sats price / random range
 * price each cycle for range trading; all listing/purchase behavior below is identical.
 *
 * Includes: queue ordinals with `listed: true` + `listedPrice` after listing (so prepare
 * does not fail with "listing to propagate"), post-listing delay before purchases, sequential
 * prepare → complete+broadcast per item, `prepDelay` between items, and 5s when the same buyer
 * wallet buys again in one cycle.
 *
 * This function handles the auto-trading cycle. It:
 * 1. Fetches items for all wallets
 * 2. Finds items without mempoolTxId (ready to trade)
 * 3. Lists them at trade price (floor or `tradePrice`)
 * 4. Buys them from the next wallet
 * 5. Checks pending purchases for confirmation
 *
 * Note: Floor purchases are handled separately BEFORE trading starts
 *
 * @param {Object} params - Configuration object
 * @param {Array} params.wallets - Array of proxy wallets
 * @param {Object} params.selectedCollection - Selected collection object
 * @param {string} params.network - Network type ('mainnet', 'testnet', etc.)
 * @param {Function} params.addConsoleLog - Logging function
 * @param {Array} params.pendingPurchases - Array of pending purchases waiting for confirmation
 * @param {Function} params.updatePendingPurchases - Function to update pending purchases state
 * @param {boolean} params.useFees - Whether to send trading fees (default: true)
 * @param {number|null} params.tradePrice - Custom trade price in sats (null to use floor price)
 * @param {number} params.prepDelay - Delay between purchase preps in milliseconds (default: 3000)
 * @returns {Promise<Object>} Result object with stats
 */
export const processWalletItems = async ({
  wallets,
  selectedCollection,
  network,
  addConsoleLog,
  pendingPurchases = [],
  updatePendingPurchases = null,
  useFees = true,
  tradePrice = null,
  isStopRequested = null,
  prepDelay = 3000,
  exchange,
}) => {
  const api = requireTradingApi(exchange);
  if (typeof isStopRequested === 'function' && isStopRequested()) {
    return {
      itemsListed: 0,
      itemsBought: 0,
      itemsDelisted: 0,
      errors: [],
      shouldStopTrading: false,
    };
  }
  if (!selectedCollection || !wallets || wallets.length === 0) {
    return {
      itemsListed: 0,
      itemsBought: 0,
      itemsDelisted: 0,
      errors: [],
      shouldStopTrading: false,
    };
  }

  const collectionSymbol =
    selectedCollection.collectionSymbol ||
    selectedCollection.symbol ||
    selectedCollection.collectionId;

  if (!collectionSymbol) {
    addConsoleLog('⚠ Collection symbol not found');
    return {
      itemsListed: 0,
      itemsBought: 0,
      itemsDelisted: 0,
      errors: ['No collection symbol'],
      shouldStopTrading: false,
    };
  }

  // Get trade price (use custom tradePrice if provided, otherwise use floor price)
  let tradePriceToUse = tradePrice;
  if (!tradePriceToUse) {
    const floorPrice = await api.getFloorPrice(collectionSymbol, true, {
      wallet: wallets[0],
      wallets,
      network,
    });
    if (!floorPrice) {
      addConsoleLog('⚠ Could not determine floor price');
      return {
        itemsListed: 0,
        itemsBought: 0,
        itemsDelisted: 0,
        errors: ['No floor price'],
        shouldStopTrading: false,
      };
    }
    tradePriceToUse = floorPrice;
    addConsoleLog(
      `Floor price: ${(tradePriceToUse / 100000000).toFixed(8)} BTC`
    );
  } else {
    addConsoleLog(
      `Trade price: ${(tradePriceToUse / 100000000).toFixed(8)} BTC`
    );
  }

  let itemsListed = 0;
  let itemsBought = 0;
  let itemsDelisted = 0;
  const errors = [];
  const buyTasks = [];

  // Process each wallet
  for (const wallet of wallets) {
    if (typeof isStopRequested === 'function' && isStopRequested()) break;
    try {
      // Fetch items owned by this wallet (bypass cache for real-time data)
      const items = await api.fetchWalletOrdinals(
        wallet.address,
        collectionSymbol,
        true, // bypass cache
        { wallet, wallets, network }
      );

      if (items.length === 0) {
        continue; // No items in this wallet
      }

      addConsoleLog(`Wallet #${wallet.index + 1} has ${items.length} item(s)`);

      // Find items without pending transactions (ready to trade)
      const readyItems = items.filter((item) => !hasPendingTransaction(item));

      if (readyItems.length === 0) {
        addConsoleLog(
          `  All items have pending transactions, waiting for purchases to be confirmed`
        );
        continue;
      }

      addConsoleLog(
        `  ${readyItems.length} item(s) ready to process (no pending tx)`
      );

      // Process each ready item
      for (const item of readyItems) {
        if (typeof isStopRequested === 'function' && isStopRequested()) break;
        const tokenId = getTokenId(item);
        if (!tokenId) {
          addConsoleLog(`  ⚠ Skipping item: No token ID`);
          continue;
        }

        // Determine if we need to list/update listing
        const needsListing = !item.listed;
        const needsPriceUpdate =
          item.listed && item.listedPrice !== tradePriceToUse;
        let shouldBuy = false;

        if (needsListing || needsPriceUpdate) {
          try {
            const action = needsListing ? 'Listing' : 'Updating listing for';
            addConsoleLog(
              `  ${action} item #${item.inscriptionNumber || tokenId.slice(0, 8)} at ${(tradePriceToUse / 100000000).toFixed(8)} BTC...`
            );

            const listResult = await api.listOrdinalWithProxyWallet(
              item,
              tradePriceToUse,
              wallet,
              network,
              { collectionSymbol, selectedCollection }
            );

            if (listResult.success) {
              addConsoleLog(
                `  ✓ Wallet #${wallet.index + 1} listed item #${item.inscriptionNumber || tokenId.slice(0, 8)}`,
                getItemLink(getInscriptionId(item), exchange)
              );
              itemsListed++;

              // Immediately wait for listing to be available (check every 500ms, max 15 seconds)
              addConsoleLog(`  ⏳ Checking if listing is available...`);
              const isAvailable = await waitForListingAvailable(
                wallet.address,
                collectionSymbol,
                tokenId,
                15000, // 15 second timeout (after initial 5 second delay)
                api,
                { wallet, wallets, network }
              );

              if (isAvailable) {
                shouldBuy = true;
              } else {
                addConsoleLog(`  ⚠ Listing timed out, skipping purchase`);
              }
            } else {
              const errorMsg = `Failed to list: ${listResult.error || 'Unknown error'}`;
              addConsoleLog(`  ✗ ${errorMsg}`);
              errors.push(errorMsg);
            }
          } catch (err) {
            const errorMsg = `Error listing item: ${err.message}`;
            addConsoleLog(`  ✗ ${errorMsg}`);
            errors.push(errorMsg);
          }
        } else if (item.listed && item.listedPrice === tradePriceToUse) {
          // Item is already listed at correct price - buy it!
          addConsoleLog(
            `  Item #${item.inscriptionNumber || tokenId.slice(0, 8)} already listed at trade price`
          );
          shouldBuy = true;
        }

        // Queue purchase; each item is processed sequentially: prepare → complete+broadcast
        // Match the shape returned by fetchWalletOrdinals on a later cycle: after listing,
        // the in-memory `item` is still stale (listed: false) unless we set flags here.
        // prepareSecurePurchase requires ordinal.listed && ordinal.listedPrice.
        if (shouldBuy) {
          buyTasks.push({
            item: {
              ...item,
              listed: true,
              listedPrice: tradePriceToUse,
            },
            sellerWallet: wallet,
          });
        }
      }
    } catch (err) {
      const errorMsg = `Error processing wallet #${wallet.index + 1}: ${err.message}`;
      addConsoleLog(`✗ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  /** Same for delta neutral and range trading — wait after listing before any purchase PSBTs */
  const POST_LISTING_DELAY_MS = 1000;
  if (buyTasks.length > 0 && itemsListed > 0) {
    const stopped = typeof isStopRequested === 'function' && isStopRequested();
    if (!stopped) {
      if (typeof addConsoleLog === 'function') {
        addConsoleLog(
          `  Waiting ${POST_LISTING_DELAY_MS / 1000}s after listing(s) before starting purchases...`
        );
      }
      await new Promise((r) => setTimeout(r, POST_LISTING_DELAY_MS));
    }
  }

  /**
   * Sequential purchases (delta neutral / range trading):
   * For each item: prepare (prep PSBT) → complete (purchase + transfer PSBTs + broadcast).
   * After a successful broadcast, before the next item: prepDelay, then if the first eligible
   * buyer matches the last successful buyer this cycle, wait 5s, then prepare the next purchase.
   */
  if (buyTasks.length > 0) {
    const delistCandidates = [];
    const SAME_BUYER_PURCHASE_DELAY_MS = 5000;
    /** Buyer ordinals address that last completed a purchase this cycle (normalized). */
    let lastSuccessfulBuyerAddress = null;

    for (let i = 0; i < buyTasks.length; i++) {
      const { item, sellerWallet } = buyTasks[i];

      if (typeof isStopRequested === 'function' && isStopRequested()) break;

      // Space out Satflow intent calls between items
      if (i > 0) {
        const delayMs = prepDelay || 3000;
        if (typeof addConsoleLog === 'function') {
          addConsoleLog(
            `  Waiting ${delayMs / 1000}s before next purchase (new item)...`
          );
        }
        await new Promise((r) => setTimeout(r, delayMs));
        if (typeof isStopRequested === 'function' && isStopRequested()) break;
      }

      // After prior broadcast: wait before fetching PSBTs again if same buyer would purchase
      if (lastSuccessfulBuyerAddress) {
        const nextBuyerGuess = await getFirstEligibleBuyerAddress(
          item,
          sellerWallet,
          wallets,
          network,
          useFees
        );
        if (nextBuyerGuess && nextBuyerGuess === lastSuccessfulBuyerAddress) {
          if (typeof addConsoleLog === 'function') {
            addConsoleLog(
              '  Waiting 5s before prepare (same buyer wallet as last purchase this cycle)...'
            );
          }
          await new Promise((r) => setTimeout(r, SAME_BUYER_PURCHASE_DELAY_MS));
          if (typeof isStopRequested === 'function' && isStopRequested()) break;
        }
      }

      const result = await tryPreparePurchaseForItem(
        item,
        sellerWallet,
        wallets,
        network,
        addConsoleLog,
        isStopRequested,
        useFees,
        exchange,
        collectionSymbol,
        selectedCollection
      );

      if (!result.success) {
        if (result.allInsufficientBalance) {
          delistCandidates.push({ sellerWallet, collectionSymbol });
        } else {
          addConsoleLog(
            `  ⚠ Prepare failed for item ${getTokenId(item)?.slice(0, 8)}: ${result.error}`
          );
        }
        continue;
      }

      const buyerWallet = result.buyerWallet;
      const itemPrice = item.listedPrice;
      const buyerAddr =
        buyerWallet?.address != null
          ? String(buyerWallet.address).toLowerCase()
          : null;

      if (result.signedPaymentPrepPSBT && typeof addConsoleLog === 'function') {
        addConsoleLog(
          '  ✓ Prep PSBT signed; fetching purchase + transfer PSBTs and broadcasting...'
        );
      }

      const completeOptions = {};
      if (result.noPrepNeeded && result.intentData) {
        completeOptions.intentData = result.intentData;
      }
      if (result.signedPaymentPrepPSBT) {
        completeOptions.signedPaymentPrepPSBT = result.signedPaymentPrepPSBT;
      }

      const completeResult = await api.completeSecurePurchase(
        item,
        buyerWallet,
        network,
        addConsoleLog,
        isStopRequested,
        { ...completeOptions, collectionSymbol, selectedCollection }
      );

      if (completeResult.success && completeResult.txid) {
        itemsBought++;
        if (buyerAddr) lastSuccessfulBuyerAddress = buyerAddr;

        const mempoolLink = getMempoolTxUrl(
          completeResult.txid,
          network || 'mainnet'
        );
        addConsoleLog(
          `  ✓ Purchase successful! Tx: ${completeResult.txid.slice(0, 16)}...`,
          mempoolLink
        );
        if (useFees && itemPrice > 0 && completeResult.txid) {
          await sendTradingFee(
            buyerWallet,
            itemPrice,
            completeResult.txid,
            network,
            addConsoleLog
          );
        }
      } else {
        addConsoleLog(
          `  ⚠ Complete failed for item ${getTokenId(item)?.slice(0, 8)}: ${completeResult.error || 'Unknown'}`
        );
      }
    }

    for (const { sellerWallet, collectionSymbol: colSym } of delistCandidates) {
      try {
        addConsoleLog(
          `  🗑️ Delisting all items in seller wallet #${sellerWallet.index + 1} (no wallets could afford)...`
        );
        const sellerItems = await api.fetchWalletOrdinals(
          sellerWallet.address,
          colSym,
          true,
          { wallet: sellerWallet, wallets, network }
        );
        const listedItems = sellerItems.filter((i) => i.listed);
        for (const listedItem of listedItems) {
          const dr = await api.delistOrdinalWithProxyWallet(
            listedItem,
            sellerWallet,
            network,
            { collectionSymbol: colSym, selectedCollection }
          );
          if (dr.success) {
            itemsDelisted++;
            addConsoleLog(
              `  ✓ Delisted item #${getTokenId(listedItem)?.slice(0, 8)}`
            );
          }
        }
      } catch (err) {
        addConsoleLog(`  ✗ Error during delist: ${err.message}`);
      }
    }
  }

  // Check pending purchases for confirmation
  let confirmedPurchases = 0;
  let updatedPendingPurchases = [...pendingPurchases]; // Start with current pending purchases

  if (pendingPurchases.length > 0) {
    addConsoleLog(
      `\n⏳ Checking ${pendingPurchases.length} pending purchase(s) for confirmation...`
    );
    updatedPendingPurchases = []; // Reset to build updated list

    for (const pending of pendingPurchases) {
      try {
        // Check if transaction is confirmed first (faster check)
        const txConfirmed = await checkTransactionConfirmed(
          pending.txid,
          network
        );

        if (txConfirmed) {
          // Transaction confirmed, now check if we own the token
          const ownershipConfirmed = await api.checkPurchaseConfirmed(
            pending.tokenId,
            pending.buyerWalletAddress,
            { collectionSymbol, wallet: wallets[0], wallets, network }
          );

          if (ownershipConfirmed) {
            addConsoleLog(
              `✓ Purchase confirmed for item ${pending.tokenId.slice(0, 8)}... (will be processed in next cycle)`
            );
            confirmedPurchases++;
            // Don't add to updatedPendingPurchases - it's confirmed and will be picked up in next cycle
          } else {
            // TX confirmed but ownership not yet transferred - keep waiting
            updatedPendingPurchases.push(pending);
          }
        } else {
          // Transaction not yet confirmed - keep waiting
          updatedPendingPurchases.push(pending);
        }
      } catch (err) {
        addConsoleLog(`⚠ Error checking pending purchase: ${err.message}`);
        // Keep in pending list on error
        updatedPendingPurchases.push(pending);
      }
    }

    if (confirmedPurchases > 0) {
      addConsoleLog(
        `✓ ${confirmedPurchases} purchase(s) confirmed and ready to trade`
      );
    }
  }

  // Update pending purchases state if callback provided
  if (updatePendingPurchases && typeof updatePendingPurchases === 'function') {
    updatePendingPurchases(updatedPendingPurchases);
  }

  // Check if we should stop trading: all items delisted and no pending purchases, or no wallets can afford
  let shouldStopTrading = false;

  // If items were delisted and no items were bought, we should stop (even if items were listed, they were immediately delisted)
  if (
    itemsDelisted > 0 &&
    itemsBought === 0 &&
    updatedPendingPurchases.length === 0
  ) {
    // Verify that all items are actually delisted now (not just that we delisted some)
    let allItemsDelisted = true;
    let hasPendingTransactions = false;
    let totalItems = 0;

    for (const wallet of wallets) {
      try {
        const items = await api.fetchWalletOrdinals(
          wallet.address,
          collectionSymbol,
          true, // bypass cache
          { wallet, wallets, network }
        );
        totalItems += items.length;

        // Check if any items are still listed
        const hasListedItems = items.some((item) => item.listed);
        if (hasListedItems) {
          allItemsDelisted = false;
        }

        // Check if any items have pending transactions
        const hasPending = items.some((item) => hasPendingTransaction(item));
        if (hasPending) {
          hasPendingTransactions = true;
        }
      } catch (err) {
        // If we can't check, assume not all delisted
        allItemsDelisted = false;
        break;
      }
    }

    // Stop if all items are delisted, no pending transactions, no pending purchases, and we have items
    if (
      allItemsDelisted &&
      !hasPendingTransactions &&
      totalItems > 0 &&
      updatedPendingPurchases.length === 0
    ) {
      shouldStopTrading = true;
      addConsoleLog(
        'ℹ️ No wallets could afford items and all items have been delisted. No pending purchases. Stopping auto-trader...'
      );
    }
  } else if (
    updatedPendingPurchases.length === 0 &&
    itemsListed === 0 &&
    itemsBought === 0 &&
    itemsDelisted === 0
  ) {
    // Also check if all items are delisted even if we didn't delist any this cycle
    let allItemsDelisted = true;
    let hasPendingTransactions = false;
    let totalItems = 0;

    for (const wallet of wallets) {
      try {
        const items = await api.fetchWalletOrdinals(
          wallet.address,
          collectionSymbol,
          true, // bypass cache
          { wallet, wallets, network }
        );
        totalItems += items.length;

        // Check if any items are still listed
        const hasListedItems = items.some((item) => item.listed);
        if (hasListedItems) {
          allItemsDelisted = false;
        }

        // Check if any items have pending transactions
        const hasPending = items.some((item) => hasPendingTransaction(item));
        if (hasPending) {
          hasPendingTransactions = true;
        }
      } catch (err) {
        // If we can't check, assume not all delisted
        allItemsDelisted = false;
        break;
      }
    }

    // Stop if all items are delisted, no pending transactions, and we have items
    if (
      allItemsDelisted &&
      !hasPendingTransactions &&
      totalItems > 0 &&
      updatedPendingPurchases.length === 0
    ) {
      shouldStopTrading = true;
      addConsoleLog(
        'ℹ️ All items have been delisted and no pending purchases. Stopping auto-trader...'
      );
    }
  }

  // Summary
  if (itemsListed > 0 || itemsBought > 0 || itemsDelisted > 0) {
    const parts = [];
    if (itemsListed > 0) parts.push(`${itemsListed} listed`);
    if (itemsBought > 0) parts.push(`${itemsBought} purchased`);
    if (itemsDelisted > 0) parts.push(`${itemsDelisted} delisted`);
    addConsoleLog(
      `✓ Processed: ${parts.join(', ')}${itemsBought > 0 ? ' (wallet-to-wallet)' : ''}`
    );
  } else if (confirmedPurchases > 0) {
    addConsoleLog(
      `✓ ${confirmedPurchases} purchase(s) confirmed and ready to trade`
    );
  } else if (!shouldStopTrading) {
    addConsoleLog('No items needed processing');
  }

  return {
    itemsListed,
    itemsBought,
    itemsDelisted,
    confirmedPurchases,
    errors,
    shouldStopTrading,
  };
};

/**
 * Helper: Wait for a new listing to become visible on the exchange.
 * Polls the exchange's wallet contents until the item shows as listed.
 */
const waitForListingAvailable = async (
  walletAddress,
  collectionSymbol,
  tokenId,
  timeout = 10000,
  api,
  walletContext = {}
) => {
  const startTime = Date.now();
  const pollInterval = 500; // Check every 500ms

  while (Date.now() - startTime < timeout) {
    try {
      // Fetch fresh wallet items
      const items = await api.fetchWalletOrdinals(
        walletAddress,
        collectionSymbol,
        true, // bypass cache
        walletContext
      );

      // Find the specific item
      const item = items.find((i) => getTokenId(i) === tokenId);

      // Check if it's listed and has a price
      if (item && item.listed && item.listedPrice) {
        return true; // Listing is available!
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (err) {
      // Continue polling even if there's an error
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  return false; // Timeout
};

/**
 * First buyer wallet that tryPreparePurchaseForItem would try (balance only, no API call).
 * Used to wait before the next prepare when the same wallet would purchase again.
 */
const getFirstEligibleBuyerAddress = async (
  item,
  sellerWallet,
  wallets,
  network,
  useFees = true
) => {
  const itemPrice = item.listedPrice || 0;
  const totalCost = estimateAutoTradePurchaseCost(itemPrice, useFees);

  for (const buyerWallet of getBuyerCandidates(wallets, sellerWallet)) {
    const balance = await fetchWalletBalance(buyerWallet.address, network);
    if (balance >= totalCost && buyerWallet?.address) {
      return String(buyerWallet.address).toLowerCase();
    }
  }
  return null;
};

/**
 * Try to prepare a secure purchase for one item by trying each buyer wallet (excluding seller).
 * @returns {{ success: boolean, prepTxid?: string, noPrepNeeded?: boolean, intentData?: object, buyerWallet?: object, allInsufficientBalance?: boolean, error?: string }}
 */
const tryPreparePurchaseForItem = async (
  item,
  sellerWallet,
  wallets,
  network,
  addConsoleLog,
  isStopRequested,
  useFees = true,
  exchange,
  collectionSymbol = null,
  selectedCollection = null
) => {
  const api = requireTradingApi(exchange);
  const itemPrice = item.listedPrice || 0;
  const totalCost = estimateAutoTradePurchaseCost(itemPrice, useFees);
  const tokenId = getTokenId(item);
  const itemId = item.inscriptionNumber || tokenId?.slice(0, 8) || 'Unknown';
  let lastError = '';
  let hadAnyWithBalance = false;

  for (const buyerWallet of getBuyerCandidates(wallets, sellerWallet)) {
    if (typeof isStopRequested === 'function' && isStopRequested()) {
      return { success: false, error: 'Trading stopped by user' };
    }

    const balance = await fetchWalletBalance(buyerWallet.address, network);
    if (balance < totalCost) continue;
    hadAnyWithBalance = true;

    addConsoleLog(
      `  Wallet #${buyerWallet.index + 1} buying item #${itemId}...`
    );

    // Retry logic for UTXO conflicts
    const maxRetries = 2;
    for (let retryAttempt = 0; retryAttempt <= maxRetries; retryAttempt++) {
      if (retryAttempt > 0) {
        const retryDelay = 3000 * retryAttempt; // 3s, 6s
        if (typeof addConsoleLog === 'function') {
          addConsoleLog(
            `  ⏳ Retry ${retryAttempt}/${maxRetries} after ${retryDelay / 1000}s delay (UTXO conflict)...`
          );
        }
        await new Promise((r) => setTimeout(r, retryDelay));
      }

      const prepareResult = await api.prepareSecurePurchase(
        item,
        buyerWallet,
        network,
        addConsoleLog,
        isStopRequested,
        { collectionSymbol, selectedCollection }
      );

      if (prepareResult.success) {
        return {
          success: true,
          prepTxid: prepareResult.prepTxid || null,
          noPrepNeeded: prepareResult.noPrepNeeded || false,
          intentData: prepareResult.intentData || null,
          signedPaymentPrepPSBT: prepareResult.signedPaymentPrepPSBT || null,
          buyerWallet,
        };
      }

      lastError = prepareResult.error || 'Unknown error';

      // Check if error is UTXO-related and retry
      const isUtxoConflict =
        lastError &&
        (lastError.includes('bip125-replacement') ||
          lastError.includes('UTXO') ||
          lastError.includes('inputs-missingorspent') ||
          lastError.includes('txn-mempool-conflict'));

      if (isUtxoConflict && retryAttempt < maxRetries) {
        continue; // Retry with delay
      }

      // Non-UTXO error or out of retries - try next wallet
      break;
    }

    addConsoleLog(
      `  ⚠ Wallet #${buyerWallet.index + 1} prepare failed: ${lastError}, trying next wallet...`
    );
  }

  return {
    success: false,
    allInsufficientBalance: !hadAnyWithBalance,
    error: lastError || 'All wallets tried but prepare failed',
  };
};

/**
 * Prepare secure purchase for one floor listing using a single buyer wallet (UTXO retries).
 * @returns {{ success: boolean, buyerWallet?: object, insufficientBalance?: boolean, ... }}
 */
const tryPreparePurchaseFromFloorForBuyer = async (
  item,
  buyerWallet,
  network,
  addConsoleLog,
  isStopRequested,
  useFees = true,
  exchange,
  collectionSymbol = null,
  selectedCollection = null
) => {
  const api = requireTradingApi(exchange);
  const itemPrice = item.listedPrice || 0;
  const totalCost = estimateAutoTradePurchaseCost(itemPrice, useFees);
  const tokenId = getTokenId(item);
  const itemId = item.inscriptionNumber || tokenId?.slice(0, 8) || 'Unknown';
  let lastError = '';

  if (typeof isStopRequested === 'function' && isStopRequested()) {
    return { success: false, error: 'Trading stopped by user' };
  }

  const balance = await fetchWalletBalance(buyerWallet.address, network);
  if (balance < totalCost) {
    return {
      success: false,
      insufficientBalance: true,
      error: 'Insufficient balance',
    };
  }

  addConsoleLog(
    `  Wallet #${buyerWallet.index + 1} buying floor item #${itemId}...`
  );

  const maxRetries = 2;
  for (let retryAttempt = 0; retryAttempt <= maxRetries; retryAttempt++) {
    if (retryAttempt > 0) {
      const retryDelay = 3000 * retryAttempt;
      if (typeof addConsoleLog === 'function') {
        addConsoleLog(
          `  ⏳ Retry ${retryAttempt}/${maxRetries} after ${retryDelay / 1000}s delay (UTXO conflict)...`
        );
      }
      await new Promise((r) => setTimeout(r, retryDelay));
    }

    if (typeof isStopRequested === 'function' && isStopRequested()) {
      return { success: false, error: 'Trading stopped by user' };
    }

    const prepareResult = await api.prepareSecurePurchase(
      item,
      buyerWallet,
      network,
      addConsoleLog,
      isStopRequested,
      { collectionSymbol, selectedCollection }
    );

    if (prepareResult.success) {
      return {
        success: true,
        prepTxid: prepareResult.prepTxid || null,
        noPrepNeeded: prepareResult.noPrepNeeded || false,
        intentData: prepareResult.intentData || null,
        signedPaymentPrepPSBT: prepareResult.signedPaymentPrepPSBT || null,
        buyerWallet,
      };
    }

    lastError = prepareResult.error || 'Unknown error';

    const isUtxoConflict =
      lastError &&
      (lastError.includes('bip125-replacement') ||
        lastError.includes('UTXO') ||
        lastError.includes('inputs-missingorspent') ||
        lastError.includes('txn-mempool-conflict'));

    if (isUtxoConflict && retryAttempt < maxRetries) {
      continue;
    }

    break;
  }

  return {
    success: false,
    error: lastError || 'Prepare failed',
  };
};

/**
 * Prepare secure purchase for a marketplace (floor) listing: try each proxy wallet in order.
 * Same prepare/retry behavior as tryPreparePurchaseForItem, without seller-wallet exclusion.
 */
const tryPreparePurchaseFromFloor = async (
  item,
  wallets,
  network,
  addConsoleLog,
  isStopRequested,
  useFees = true,
  exchange,
  collectionSymbol = null,
  selectedCollection = null
) => {
  const itemPrice = item.listedPrice || 0;
  const totalCost = estimateAutoTradePurchaseCost(itemPrice, useFees);
  let lastError = '';
  let hadAnyWithBalance = false;

  for (const buyerWallet of wallets) {
    if (typeof isStopRequested === 'function' && isStopRequested()) {
      return { success: false, error: 'Trading stopped by user' };
    }

    const balance = await fetchWalletBalance(buyerWallet.address, network);
    if (balance < totalCost) continue;
    hadAnyWithBalance = true;

    const one = await tryPreparePurchaseFromFloorForBuyer(
      item,
      buyerWallet,
      network,
      addConsoleLog,
      isStopRequested,
      useFees,
      exchange,
      collectionSymbol,
      selectedCollection
    );

    if (one.success) {
      return one;
    }

    lastError = one.error || lastError;
    addConsoleLog(
      `  ⚠ Wallet #${buyerWallet.index + 1} prepare failed: ${one.error || 'unknown'}, trying next wallet...`
    );
  }

  return {
    success: false,
    allInsufficientBalance: !hadAnyWithBalance,
    error: lastError || 'All wallets tried but prepare failed',
  };
};

/**
 * Buy items from floor price - BEFORE starting auto-trading
 *
 * Key improvements:
 * - Filters out items we already own (checks against wallet addresses)
 * - Filters out items with pending transactions (mempoolTxId)
 * - Tries different wallets for the same item on insufficient balance
 * - Retries with next item if all wallets fail
 * - Tracks total purchases to not exceed purchaseAmount
 *
 * @param {Object} params - Configuration object
 * @param {Array} params.wallets - Array of proxy wallets
 * @param {Object} params.selectedCollection - Selected collection object
 * @param {string} params.network - Network type
 * @param {number} params.purchaseAmount - Number of NEW items to buy
 * @param {Function} params.addConsoleLog - Logging function
 * @param {boolean} params.useFees - Whether to send trading fees (default: true)
 * @param {Function} [params.isStopRequested] - Optional: returns true if user stopped trading
 * @param {number} [params.prepDelay] - Ms between floor purchases (default 3000)
 * @returns {Promise<Object>} Result with itemsBought and pendingPurchases
 */
export const buyItemsFromFloor = async ({
  wallets,
  selectedCollection,
  network,
  purchaseAmount,
  addConsoleLog,
  useFees = true,
  isStopRequested = null,
  prepDelay = 3000,
  exchange,
}) => {
  const api = requireTradingApi(exchange);
  const collectionSymbol =
    selectedCollection.collectionSymbol ||
    selectedCollection.symbol ||
    selectedCollection.collectionId;

  if (!collectionSymbol) {
    addConsoleLog('⚠ Cannot buy from floor: Collection symbol not found');
    return { itemsBought: 0, pendingPurchases: [], errors: [] };
  }

  // Get all wallet addresses to filter out items we own
  const walletAddresses = new Set(wallets.map((w) => w.address.toLowerCase()));

  // Fetch floor listings (Satflow activity/listings, cheapest first).
  // Important: listings can be stale ("No available orders"). We paginate so we can
  // skip stale rows without running out of candidates before hitting purchaseAmount.
  addConsoleLog(
    `📋 Fetching floor listings from ${getExchangeLabel(exchange)}...`
  );
  const pageSize = Math.min(250, Math.max(50, purchaseAmount * 10));
  let page = 1;
  const addedTokenIds = new Set();
  const unavailableTokenIds = new Set();
  let availableItems = [];

  const isItemEligible = (item) => {
    const tokenId = getTokenId(item);
    if (!tokenId) return false;
    if (unavailableTokenIds.has(tokenId)) return false;
    if (addedTokenIds.has(tokenId)) return false;
    if (!item.listed || !item.listedPrice) return false;
    if (hasPendingTransaction(item)) return false;
    const owner = item.owner || item.ownerAddress;
    if (owner && walletAddresses.has(owner.toLowerCase())) return false;
    return true;
  };

  const fetchNextPage = async () => {
    if (typeof isStopRequested === 'function' && isStopRequested()) return 0;
    const floorItems = await api.fetchCollectionItems(collectionSymbol, true, {
      pageSize,
      page,
      wallet: wallets[0],
      wallets,
      network,
    });
    page++;
    if (!Array.isArray(floorItems) || floorItems.length === 0) return 0;

    const newlyEligible = [];
    for (const item of floorItems) {
      if (isItemEligible(item)) {
        const tokenId = getTokenId(item);
        if (!tokenId) continue;
        addedTokenIds.add(tokenId);
        newlyEligible.push(item);
      }
    }

    if (newlyEligible.length > 0) {
      availableItems = [...availableItems, ...newlyEligible].sort(
        (a, b) => (a.listedPrice || 0) - (b.listedPrice || 0)
      );
    }
    return floorItems.length;
  };

  const firstCount = await fetchNextPage();
  if (firstCount === 0) {
    addConsoleLog('⚠ No items available on floor');
    return { itemsBought: 0, pendingPurchases: [], errors: [] };
  }

  if (availableItems.length === 0) {
    addConsoleLog('⚠ No available items on floor (all owned or pending)');
    return { itemsBought: 0, pendingPurchases: [], errors: [] };
  }

  addConsoleLog(
    `Found ${availableItems.length} eligible floor item(s) (page size ${pageSize})`
  );

  let itemsBought = 0;
  const pendingPurchases = [];
  const errors = [];
  let itemIndex = 0;
  const SAME_BUYER_FLOOR_DELAY_MS = 5000;
  let lastSuccessfulBuyerAddress = null;

  // Keep trying until we buy purchaseAmount items or run out of items/wallets
  while (itemsBought < purchaseAmount) {
    if (typeof isStopRequested === 'function' && isStopRequested()) {
      addConsoleLog('Floor purchases stopped by user.');
      break;
    }

    // If we've consumed current eligible list, try to page in more listings.
    if (itemIndex >= availableItems.length) {
      const fetched = await fetchNextPage();
      if (fetched === 0 || itemIndex >= availableItems.length) {
        // No more pages / no more eligible items.
        break;
      }
      addConsoleLog(
        `Loaded more listings. Eligible candidates: ${availableItems.length}`
      );
    }

    const item = availableItems[itemIndex];
    const tokenId = getTokenId(item);

    if (!tokenId) {
      itemIndex++;
      continue;
    }

    const itemPrice = item.listedPrice || 0;

    if (itemsBought > 0) {
      const delayMs = prepDelay || 3000;
      addConsoleLog(
        `  Waiting ${delayMs / 1000}s before next floor purchase...`
      );
      await new Promise((r) => setTimeout(r, delayMs));
      if (typeof isStopRequested === 'function' && isStopRequested()) break;
    }

    addConsoleLog(
      `🛒 Floor item #${item.inscriptionNumber || tokenId.slice(0, 8)} at ${(itemPrice / 100000000).toFixed(8)} BTC (prepare → complete, Satflow secure purchase)...`
    );

    if (lastSuccessfulBuyerAddress) {
      const totalCost = estimateAutoTradePurchaseCost(itemPrice, useFees);
      let nextGuess = null;
      for (const w of wallets) {
        const bal = await fetchWalletBalance(w.address, network);
        if (bal >= totalCost) {
          nextGuess = String(w.address).toLowerCase();
          break;
        }
      }
      if (nextGuess && nextGuess === lastSuccessfulBuyerAddress) {
        addConsoleLog(
          '  Waiting 5s before prepare (same buyer wallet as last floor purchase)...'
        );
        await new Promise((r) => setTimeout(r, SAME_BUYER_FLOOR_DELAY_MS));
        if (typeof isStopRequested === 'function' && isStopRequested()) break;
      }
    }

    try {
      const prepareResult = await tryPreparePurchaseFromFloor(
        item,
        wallets,
        network,
        addConsoleLog,
        isStopRequested,
        useFees,
        exchange,
        collectionSymbol,
        selectedCollection
      );

      if (!prepareResult.success) {
        const rawError = String(prepareResult.error || '');
        const isNotAvailable =
          /not currently available|no available orders/i.test(rawError);

        if (isNotAvailable) {
          // This listing is stale; skip it without consuming one of the desired purchases.
          unavailableTokenIds.add(tokenId);
          addConsoleLog(
            `  ⚠ Listing not available for item ${tokenId.slice(0, 8)}; skipping to next item...`
          );
        } else {
          const errorMsg = prepareResult.allInsufficientBalance
            ? `Insufficient balance on all wallets for item ${tokenId.slice(0, 8)}`
            : rawError || `Prepare failed for item ${tokenId.slice(0, 8)}`;
          addConsoleLog(`  ✗ ${errorMsg}`);
          errors.push(errorMsg);
        }
      } else {
        const buyerWallet = prepareResult.buyerWallet;
        const buyerAddr =
          buyerWallet?.address != null
            ? String(buyerWallet.address).toLowerCase()
            : null;

        if (
          prepareResult.signedPaymentPrepPSBT &&
          typeof addConsoleLog === 'function'
        ) {
          addConsoleLog(
            '  ✓ Prep PSBT signed; fetching purchase + transfer PSBTs and broadcasting...'
          );
        }

        const completeOptions = {};
        if (prepareResult.noPrepNeeded && prepareResult.intentData) {
          completeOptions.intentData = prepareResult.intentData;
        }
        if (prepareResult.signedPaymentPrepPSBT) {
          completeOptions.signedPaymentPrepPSBT =
            prepareResult.signedPaymentPrepPSBT;
        }

        const completeResult = await api.completeSecurePurchase(
          item,
          buyerWallet,
          network,
          addConsoleLog,
          isStopRequested,
          { ...completeOptions, collectionSymbol, selectedCollection }
        );

        if (completeResult.success && completeResult.txid) {
          const mempoolLink = getMempoolTxUrl(
            completeResult.txid,
            network || 'mainnet'
          );
          addConsoleLog(
            `✓ Floor purchase successful! Tx: ${completeResult.txid.slice(0, 16)}...`,
            mempoolLink
          );

          itemsBought++;
          if (buyerAddr) lastSuccessfulBuyerAddress = buyerAddr;

          pendingPurchases.push({
            tokenId,
            buyerWalletAddress: buyerWallet.address,
            txid: completeResult.txid,
            timestamp: Date.now(),
            price: itemPrice,
          });

          if (useFees && itemPrice > 0 && completeResult.txid) {
            await sendTradingFee(
              buyerWallet,
              itemPrice,
              completeResult.txid,
              network,
              addConsoleLog
            );
          }
        } else {
          const errorMsg = completeResult.error || 'Complete/broadcast failed';
          addConsoleLog(`  ✗ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    } catch (err) {
      addConsoleLog(`  ✗ Error during floor purchase: ${err.message}`);
      errors.push(err.message || String(err));
    }

    itemIndex++;
  }

  if (itemsBought > 0) {
    addConsoleLog(
      `✓ Bought ${itemsBought} item(s) from floor (waiting for confirmation...)`
    );
  } else {
    addConsoleLog('✗ Could not purchase any items from floor');
  }

  if (itemsBought < purchaseAmount) {
    addConsoleLog(
      `⚠ Only purchased ${itemsBought}/${purchaseAmount} items (insufficient balance or no items available)`
    );
  }

  return { itemsBought, pendingPurchases, errors };
};

/**
 * Buy up to X cheapest floor items per proxy wallet (Satflow secure purchase), then stop.
 * Same listing fetch and prepare → complete flow as buyItemsFromFloor, but each wallet only
 * buys for itself; walks the shared cheapest-first list without reusing listings.
 *
 * @param {Object} params
 * @param {number} params.itemsPerWallet - Max items to buy per wallet
 * @returns {Promise<{ itemsBought: number, itemsBoughtByWallet: Record<number, number>, pendingPurchases: Array, errors: string[] }>}
 */
export const buyXFromEachWallet = async ({
  wallets,
  selectedCollection,
  network,
  itemsPerWallet,
  addConsoleLog,
  useFees = true,
  isStopRequested = null,
  prepDelay = 3000,
  exchange,
}) => {
  const api = requireTradingApi(exchange);
  const collectionSymbol =
    selectedCollection.collectionSymbol ||
    selectedCollection.symbol ||
    selectedCollection.collectionId;

  if (!collectionSymbol) {
    addConsoleLog('⚠ Cannot buy from floor: Collection symbol not found');
    return {
      itemsBought: 0,
      itemsBoughtByWallet: {},
      pendingPurchases: [],
      errors: [],
    };
  }

  const perWallet = Math.max(1, Math.floor(Number(itemsPerWallet) || 0));
  const walletCount = wallets.length;
  const maxNeeded = perWallet * walletCount;

  addConsoleLog(
    `📋 Fetching floor listings from ${getExchangeLabel(exchange)} (buy per wallet)...`
  );
  const listPageSize = Math.min(250, Math.max(50, maxNeeded * 5));
  const floorItems = await api.fetchCollectionItems(collectionSymbol, true, {
    pageSize: listPageSize,
    wallet: wallets[0],
    wallets,
    network,
  });

  if (floorItems.length === 0) {
    addConsoleLog('⚠ No items available on floor');
    return {
      itemsBought: 0,
      itemsBoughtByWallet: {},
      pendingPurchases: [],
      errors: [],
    };
  }

  const walletAddresses = new Set(wallets.map((w) => w.address.toLowerCase()));

  const availableItems = floorItems
    .filter((item) => {
      const tokenId = getTokenId(item);
      if (!tokenId) return false;
      if (!item.listed || !item.listedPrice) return false;
      if (hasPendingTransaction(item)) return false;
      const owner = item.owner || item.ownerAddress;
      if (owner && walletAddresses.has(owner.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => (a.listedPrice || 0) - (b.listedPrice || 0));

  if (availableItems.length === 0) {
    addConsoleLog('⚠ No available items on floor (all owned or pending)');
    return {
      itemsBought: 0,
      itemsBoughtByWallet: {},
      pendingPurchases: [],
      errors: [],
    };
  }

  addConsoleLog(
    `Found ${availableItems.length} available floor item(s); target ${perWallet} per wallet (${walletCount} wallet(s))`
  );

  let itemIndex = 0;
  let totalBought = 0;
  const itemsBoughtByWallet = {};
  const pendingPurchases = [];
  const errors = [];
  const SAME_BUYER_FLOOR_DELAY_MS = 5000;
  let lastSuccessfulBuyerAddress = null;

  for (const wallet of wallets) {
    if (typeof isStopRequested === 'function' && isStopRequested()) {
      addConsoleLog('Floor purchases stopped by user.');
      break;
    }

    addConsoleLog(
      `\n👛 Wallet #${wallet.index + 1}: buying up to ${perWallet} floor item(s)...`
    );
    let boughtForWallet = 0;

    while (boughtForWallet < perWallet && itemIndex < availableItems.length) {
      if (typeof isStopRequested === 'function' && isStopRequested()) {
        break;
      }

      const item = availableItems[itemIndex];
      const tokenId = getTokenId(item);
      if (!tokenId) {
        itemIndex++;
        continue;
      }

      const itemPrice = item.listedPrice || 0;

      if (totalBought > 0) {
        const delayMs = prepDelay || 3000;
        addConsoleLog(
          `  Waiting ${delayMs / 1000}s before next floor purchase...`
        );
        await new Promise((r) => setTimeout(r, delayMs));
        if (typeof isStopRequested === 'function' && isStopRequested()) break;
      }

      const walletAddr = String(wallet.address).toLowerCase();
      if (
        lastSuccessfulBuyerAddress &&
        lastSuccessfulBuyerAddress === walletAddr
      ) {
        addConsoleLog(
          '  Waiting 5s before prepare (same buyer wallet as last purchase)...'
        );
        await new Promise((r) => setTimeout(r, SAME_BUYER_FLOOR_DELAY_MS));
        if (typeof isStopRequested === 'function' && isStopRequested()) break;
      }

      addConsoleLog(
        `🛒 Floor item #${item.inscriptionNumber || tokenId.slice(0, 8)} at ${(itemPrice / 100000000).toFixed(8)} BTC (wallet #${wallet.index + 1} only)...`
      );

      try {
        const prepareResult = await tryPreparePurchaseFromFloorForBuyer(
          item,
          wallet,
          network,
          addConsoleLog,
          isStopRequested,
          useFees,
          exchange,
          collectionSymbol,
          selectedCollection
        );

        if (!prepareResult.success) {
          if (prepareResult.insufficientBalance) {
            addConsoleLog(
              `  ⚠ Wallet #${wallet.index + 1} insufficient balance for remaining listings; skipping rest for this wallet.`
            );
            break;
          }
          const errorMsg =
            prepareResult.error ||
            `Prepare failed for item ${tokenId.slice(0, 8)}`;
          addConsoleLog(`  ✗ ${errorMsg}`);
          errors.push(errorMsg);
          itemIndex++;
          continue;
        }

        const buyerWallet = prepareResult.buyerWallet;

        if (
          prepareResult.signedPaymentPrepPSBT &&
          typeof addConsoleLog === 'function'
        ) {
          addConsoleLog(
            '  ✓ Prep PSBT signed; fetching purchase + transfer PSBTs and broadcasting...'
          );
        }

        const completeOptions = {};
        if (prepareResult.noPrepNeeded && prepareResult.intentData) {
          completeOptions.intentData = prepareResult.intentData;
        }
        if (prepareResult.signedPaymentPrepPSBT) {
          completeOptions.signedPaymentPrepPSBT =
            prepareResult.signedPaymentPrepPSBT;
        }

        const completeResult = await api.completeSecurePurchase(
          item,
          buyerWallet,
          network,
          addConsoleLog,
          isStopRequested,
          { ...completeOptions, collectionSymbol, selectedCollection }
        );

        if (completeResult.success && completeResult.txid) {
          const mempoolLink = getMempoolTxUrl(
            completeResult.txid,
            network || 'mainnet'
          );
          addConsoleLog(
            `✓ Floor purchase successful! Tx: ${completeResult.txid.slice(0, 16)}...`,
            mempoolLink
          );

          totalBought++;
          boughtForWallet++;
          itemsBoughtByWallet[wallet.index] = boughtForWallet;
          lastSuccessfulBuyerAddress = walletAddr;

          pendingPurchases.push({
            tokenId,
            buyerWalletAddress: buyerWallet.address,
            txid: completeResult.txid,
            timestamp: Date.now(),
            price: itemPrice,
          });

          if (useFees && itemPrice > 0 && completeResult.txid) {
            await sendTradingFee(
              buyerWallet,
              itemPrice,
              completeResult.txid,
              network,
              addConsoleLog
            );
          }

          itemIndex++;
        } else {
          const errorMsg = completeResult.error || 'Complete/broadcast failed';
          addConsoleLog(`  ✗ ${errorMsg}`);
          errors.push(errorMsg);
          itemIndex++;
        }
      } catch (err) {
        addConsoleLog(`  ✗ Error during floor purchase: ${err.message}`);
        errors.push(err.message || String(err));
        itemIndex++;
      }
    }

    if (boughtForWallet < perWallet) {
      addConsoleLog(
        `  ⚠ Wallet #${wallet.index + 1}: purchased ${boughtForWallet}/${perWallet} item(s)`
      );
    }
  }

  if (totalBought > 0) {
    addConsoleLog(
      `\n✓ Bought ${totalBought} item(s) from floor total (per-wallet target ${perWallet}; waiting for confirmation...)`
    );
  } else {
    addConsoleLog('\n✗ Could not complete any floor purchases');
  }

  return {
    itemsBought: totalBought,
    itemsBoughtByWallet,
    pendingPurchases,
    errors,
  };
};

/**
 * Sell X items from each wallet - list items at floor price or custom price
 *
 * @param {Object} params - Configuration object
 * @param {Array} params.wallets - Array of proxy wallets
 * @param {Object} params.selectedCollection - Selected collection object
 * @param {string} params.network - Network type
 * @param {number} params.sellXAmount - Number of items to list from each wallet
 * @param {Function} params.addConsoleLog - Logging function
 * @param {boolean} params.useCustomPrice - Whether to use custom price (default: false)
 * @param {number} params.customPrice - Custom price in sats (only used if useCustomPrice is true)
 * @returns {Promise<Object>} Result with itemsListed and errors
 */
export const sellXFromEachWallet = async ({
  wallets,
  selectedCollection,
  network,
  sellXAmount,
  addConsoleLog,
  useCustomPrice = false,
  customPrice = 0,
  exchange,
}) => {
  const api = requireTradingApi(exchange);
  const collectionSymbol =
    selectedCollection.collectionSymbol ||
    selectedCollection.symbol ||
    selectedCollection.collectionId;

  if (!collectionSymbol) {
    addConsoleLog('⚠ Cannot sell items: Collection symbol not found');
    return { itemsListed: 0, errors: [] };
  }

  // Determine listing price
  let listingPrice;

  if (useCustomPrice && customPrice > 0) {
    // Use custom price
    listingPrice = customPrice;
    addConsoleLog(
      `Using custom listing price: ${(listingPrice / 100000000).toFixed(8)} BTC`
    );
  } else {
    // Get floor price for listing
    addConsoleLog('📋 Fetching floor price...');
    const floorPrice = await api.getFloorPrice(collectionSymbol, true, {
      wallet: wallets[0],
      wallets,
      network,
    });

    if (!floorPrice) {
      addConsoleLog('⚠ Could not determine floor price');
      return { itemsListed: 0, errors: ['No floor price'] };
    }

    listingPrice = floorPrice;
    addConsoleLog(`Floor price: ${(listingPrice / 100000000).toFixed(8)} BTC`);
  }

  let itemsListed = 0;
  const errors = [];

  // Process each wallet
  for (const wallet of wallets) {
    try {
      // Fetch items owned by this wallet
      const items = await api.fetchWalletOrdinals(
        wallet.address,
        collectionSymbol,
        true, // bypass cache
        { wallet, wallets, network }
      );

      if (items.length === 0) {
        addConsoleLog(`Wallet #${wallet.index + 1} has no items to list`);
        continue;
      }

      // Find unlisted items (not already listed and no pending transactions)
      const unlistedItems = items.filter(
        (item) => !item.listed && !hasPendingTransaction(item)
      );

      if (unlistedItems.length === 0) {
        addConsoleLog(
          `Wallet #${wallet.index + 1} has no unlisted items (all ${items.length} items already listed or pending)`
        );
        continue;
      }

      // Determine how many to list
      const itemsToList = Math.min(sellXAmount, unlistedItems.length);
      addConsoleLog(
        `Wallet #${wallet.index + 1}: Listing ${itemsToList} item(s) out of ${unlistedItems.length} available`
      );

      // List items
      for (let i = 0; i < itemsToList; i++) {
        const item = unlistedItems[i];
        const tokenId = getTokenId(item);

        if (!tokenId) {
          addConsoleLog(`  ⚠ Skipping item: No token ID`);
          continue;
        }

        try {
          addConsoleLog(
            `  Listing item #${item.inscriptionNumber || tokenId.slice(0, 8)} at ${(listingPrice / 100000000).toFixed(8)} BTC...`
          );

          const listResult = await api.listOrdinalWithProxyWallet(
            item,
            listingPrice,
            wallet,
            network,
            { collectionSymbol, selectedCollection }
          );

          if (listResult.success) {
            addConsoleLog(
              `  ✓ Wallet #${wallet.index + 1} listed item #${item.inscriptionNumber || tokenId.slice(0, 8)}`,
              getItemLink(getInscriptionId(item), exchange)
            );
            itemsListed++;

            // Small delay between listings to avoid rate limits
            if (i < itemsToList - 1) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          } else {
            const errorMsg = `Failed to list: ${listResult.error || 'Unknown error'}`;
            addConsoleLog(`  ✗ ${errorMsg}`);
            errors.push(errorMsg);
          }
        } catch (err) {
          const errorMsg = `Error listing item: ${err.message}`;
          addConsoleLog(`  ✗ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    } catch (err) {
      const errorMsg = `Error processing wallet #${wallet.index + 1}: ${err.message}`;
      addConsoleLog(`✗ ${errorMsg}`);
      errors.push(errorMsg);
    }

    // Small delay between wallets
    if (wallets.indexOf(wallet) < wallets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  if (itemsListed > 0) {
    addConsoleLog(`✓ Listed ${itemsListed} item(s) total across all wallets`);
  } else {
    addConsoleLog('✗ Could not list any items');
  }

  return { itemsListed, errors };
};
