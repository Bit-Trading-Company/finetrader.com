/**
 * Runs auto-trading for the AutoTrade page: Start/Stop, the timer-driven
 * trading cycle, pending purchases and the active (optionally shuffled)
 * wallet list. Trading strategies live in trading/autoTradeEngine.js.
 *
 * @param {{ settings: object, wallets: object[], selectedCollection: object|null,
 *   network: string, addConsoleLog: Function }} params
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  buyXFromEachWallet,
  buyItemsFromFloor,
  sellXFromEachWallet,
  processWalletItems,
} from '../../../trading/autoTradeEngine';
import { TRADING_EXCHANGES, getTradingApi } from '../../../trading/exchanges';
import { selectActiveWallets } from '../../../features/wallet/walletSelection';
import { mergePendingPurchases } from '../../../trading/pendingPurchases';

export const useAutoTradeRunner = ({
  settings,
  wallets,
  selectedCollection,
  network,
  addConsoleLog,
}) => {
  const {
    usePriceRange,
    lowerTradePrice,
    upperTradePrice,
    tradePrice,
    useCustomWalletSubset,
    selectedWalletIndices,
    walletRandomizer,
    tradingExchange,
    tradingMode,
    buyXEachAmount,
    useFees,
    prepDelay,
    buyAdditionalItems,
    buyItemsEveryTick,
    purchaseAmount,
    useCustomSellPrice,
    customSellPrice,
    sellXAmount,
    timerIntervalSeconds,
  } = settings;

  const [isTrading, setIsTrading] = useState(false);
  const [pendingPurchases, setPendingPurchases] = useState([]); // Track purchases waiting for confirmation
  const tradingIntervalRef = useRef(null);
  const tradingStopRequestedRef = useRef(false); // Set true when user clicks Stop; checked before setting interval and at each tick
  // Incremented on every Start and Stop so an older run that is still awaiting
  // network calls cannot keep trading (or flip isTrading) after Stop -> Start.
  const tradingRunIdRef = useRef(0);
  const pendingPurchasesRef = useRef([]); // Ref to track latest pending purchases for interval callback
  // Refs for range trading state (to avoid stale closures in interval)
  const usePriceRangeRef = useRef(false);
  const lowerTradePriceRef = useRef(0);
  const upperTradePriceRef = useRef(0);
  const tradePriceRef = useRef(0);

  // Sync refs with state for range trading
  useEffect(() => {
    usePriceRangeRef.current = usePriceRange;
  }, [usePriceRange]);

  useEffect(() => {
    lowerTradePriceRef.current = lowerTradePrice;
  }, [lowerTradePrice]);

  useEffect(() => {
    upperTradePriceRef.current = upperTradePrice;
  }, [upperTradePrice]);

  useEffect(() => {
    tradePriceRef.current = tradePrice;
  }, [tradePrice]);

  // =============================================================================
  // TRADING LOGIC - Uses processWalletItems() from trading/autoTradeEngine.js
  // =============================================================================

  // Get active wallets based on settings
  const getActiveWallets = useCallback(() => {
    let activeWallets = selectActiveWallets(wallets, {
      useCustomSubset: useCustomWalletSubset,
      selectedIndices: selectedWalletIndices,
    });

    // Randomize wallet order if randomizer is enabled
    if (walletRandomizer && activeWallets.length > 1) {
      activeWallets = [...activeWallets].sort(() => Math.random() - 0.5);
    }

    return activeWallets;
  }, [wallets, useCustomWalletSubset, selectedWalletIndices, walletRandomizer]);

  // Start/Stop trading (SIMPLIFIED VERSION)
  const handleStartTrading = async () => {
    if (isTrading) {
      // Stop trading: set flag first so any in-flight start flow or next tick will see it
      tradingStopRequestedRef.current = true;
      tradingRunIdRef.current += 1;
      if (tradingIntervalRef.current != null) {
        clearTimeout(tradingIntervalRef.current);
        tradingIntervalRef.current = null;
      }
      setIsTrading(false);
      addConsoleLog('Auto-trading stopped');
      // Note: We keep pendingPurchases state so they can be checked if trading resumes
    } else {
      // Start trading
      tradingStopRequestedRef.current = false;
      const runId = ++tradingRunIdRef.current;
      // True once Stop was clicked or a newer run has started.
      const isStopped = () =>
        tradingStopRequestedRef.current || runId !== tradingRunIdRef.current;
      // Only the current run may switch the Start/Stop button back.
      const endRun = () => {
        if (runId === tradingRunIdRef.current) setIsTrading(false);
      };
      setIsTrading(true);
      // Initialize pending purchases ref
      pendingPurchasesRef.current = pendingPurchases;
      const exchangeApi = getTradingApi(tradingExchange);
      addConsoleLog(
        exchangeApi.id === TRADING_EXCHANGES.SATFLOW
          ? 'Auto-trading started'
          : `Auto-trading started on ${exchangeApi.label}`
      );

      if (tradingMode === 'bid-accept-bids') {
        endRun();
        addConsoleLog(
          'Use "Open bids for collection" to place or accept bids (auto-trader does not run in this mode).'
        );
        return;
      }

      // Get active wallets based on settings
      const activeWallets = getActiveWallets();

      // Validate
      if (!selectedCollection || activeWallets.length === 0) {
        addConsoleLog('✗ Cannot start trading: Missing collection or wallets');
        endRun();
        return;
      }

      // Buy X per wallet: floor purchases only, then stop (no auto-trader)
      if (tradingMode === 'buy-x-each') {
        if (buyXEachAmount < 1) {
          addConsoleLog(
            '✗ Buy X from each wallet: set at least 1 item per wallet'
          );
          endRun();
          return;
        }

        const targetTotal = buyXEachAmount * activeWallets.length;
        addConsoleLog(
          `\n🛒 Buying ${buyXEachAmount} cheapest floor item(s) per wallet (${activeWallets.length} wallet(s), up to ${targetTotal} total)...\n`
        );

        try {
          const buyEachResult = await buyXFromEachWallet({
            wallets: activeWallets,
            selectedCollection,
            network,
            itemsPerWallet: buyXEachAmount,
            addConsoleLog,
            useFees,
            prepDelay,
            exchange: tradingExchange,
            isStopRequested: isStopped,
          });

          const itemsBought = buyEachResult.itemsBought || 0;
          if (
            buyEachResult.pendingPurchases &&
            buyEachResult.pendingPurchases.length > 0
          ) {
            const merged = mergePendingPurchases(
              pendingPurchasesRef.current,
              buyEachResult.pendingPurchases
            );
            setPendingPurchases(merged);
            pendingPurchasesRef.current = merged;
          }

          if (itemsBought > 0) {
            addConsoleLog(
              `✓ Purchased ${itemsBought} item(s) from floor (target up to ${targetTotal})`
            );
          } else {
            addConsoleLog(
              '⚠ No floor purchases completed. Check balances and listings.'
            );
          }
        } catch (err) {
          addConsoleLog(`✗ Error in buy X per wallet: ${err.message}`);
        }

        endRun();
        return;
      }

      // Validate trade price for range trading
      if (tradingMode === 'range-trading') {
        if (usePriceRange) {
          // Validate price range
          if (lowerTradePrice <= 0 || upperTradePrice <= 0) {
            addConsoleLog(
              '✗ Cannot start range trading: Lower and upper prices must be greater than 0'
            );
            endRun();
            return;
          }
          if (upperTradePrice <= lowerTradePrice) {
            addConsoleLog(
              '✗ Cannot start range trading: Upper price must be higher than lower price'
            );
            endRun();
            return;
          }
        } else {
          // Validate single trade price
          if (tradePrice <= 0) {
            addConsoleLog(
              '✗ Cannot start range trading: Trade price must be greater than 0'
            );
            endRun();
            return;
          }
        }
      }

      // STEP 1: Buy items from floor BEFORE starting auto-trading (if buyAdditionalItems checked and purchaseAmount > 0; not buy-x-each / bid UI)
      if (
        tradingMode !== 'buy-x-each' &&
        tradingMode !== 'bid-accept-bids' &&
        buyAdditionalItems &&
        !buyItemsEveryTick &&
        purchaseAmount > 0
      ) {
        addConsoleLog(
          `\n🛒 Purchasing ${purchaseAmount} item(s) from floor before starting auto-trading...`
        );

        try {
          const floorPurchaseResult = await buyItemsFromFloor({
            wallets: activeWallets,
            selectedCollection,
            network,
            purchaseAmount,
            addConsoleLog,
            useFees,
            prepDelay,
            exchange: tradingExchange,
            isStopRequested: isStopped,
          });

          const itemsBought = floorPurchaseResult.itemsBought || 0;

          // Store pending purchases
          if (
            floorPurchaseResult.pendingPurchases &&
            floorPurchaseResult.pendingPurchases.length > 0
          ) {
            const merged = mergePendingPurchases(
              pendingPurchasesRef.current,
              floorPurchaseResult.pendingPurchases
            );
            setPendingPurchases(merged);
            pendingPurchasesRef.current = merged;
          }

          if (itemsBought > 0) {
            addConsoleLog(
              `✓ Purchased ${itemsBought}/${purchaseAmount} items from floor`
            );
            if (itemsBought < purchaseAmount) {
              addConsoleLog(
                `⚠ Could only purchase ${itemsBought}/${purchaseAmount} items. Will continue with available items.`
              );
            }
          } else {
            addConsoleLog(
              `⚠ Could not purchase any items from floor. Continuing with items already in wallets...`
            );
          }
        } catch (err) {
          addConsoleLog(`✗ Error purchasing from floor: ${err.message}`);
          addConsoleLog('Continuing with items already in wallets...');
        }

        // Small delay before starting auto-trading cycle
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // STEP 2: Handle sell-x-each mode (list items and stop)
      if (tradingMode === 'sell-x-each') {
        addConsoleLog('\n📝 Listing items from each wallet...\n');

        // Convert custom price from BTC to sats if using custom price
        const customPriceSats = useCustomSellPrice
          ? Math.round(customSellPrice * 100000000)
          : 0;

        try {
          const sellResult = await sellXFromEachWallet({
            wallets: activeWallets,
            selectedCollection,
            network,
            sellXAmount,
            addConsoleLog,
            useCustomPrice: useCustomSellPrice,
            customPrice: customPriceSats,
            exchange: tradingExchange,
          });

          const itemsListed = sellResult.itemsListed || 0;

          if (itemsListed > 0) {
            addConsoleLog(
              `\n✓ Successfully listed ${itemsListed} item(s) from wallets`
            );
          } else {
            addConsoleLog(
              `\n⚠ Could not list any items. Check if wallets have unlisted items.`
            );
          }
        } catch (err) {
          addConsoleLog(`✗ Error listing items: ${err.message}`);
        }

        // Stop trading after listing (sell-x-each is a one-time operation)
        endRun();
        return;
      }

      // STEP 3: Start the auto-trading cycle (for other modes)
      addConsoleLog('\n🔄 Starting auto-trading cycle...\n');

      // Determine trade price (convert BTC to sats if range trading)
      let tradePriceSats = null;
      if (tradingMode === 'range-trading') {
        if (usePriceRange) {
          // Generate random price between lower and upper bounds
          if (lowerTradePrice > 0 && upperTradePrice > lowerTradePrice) {
            const randomPrice =
              lowerTradePrice +
              Math.random() * (upperTradePrice - lowerTradePrice);
            tradePriceSats = Math.round(randomPrice * 100000000);
            addConsoleLog(
              `Random trade price: ${randomPrice.toFixed(8)} BTC (range: ${lowerTradePrice.toFixed(8)} - ${upperTradePrice.toFixed(8)} BTC)`
            );
          } else {
            addConsoleLog(
              '✗ Invalid price range. Please set valid lower and upper prices.'
            );
            endRun();
            return;
          }
        } else if (tradePrice > 0) {
          // Use fixed trade price
          tradePriceSats = Math.round(tradePrice * 100000000);
        }
        // Update refs for interval callback
        usePriceRangeRef.current = usePriceRange;
        lowerTradePriceRef.current = lowerTradePrice;
        upperTradePriceRef.current = upperTradePrice;
        tradePriceRef.current = tradePrice;
      }

      // If enabled, buy additional floor items on the startup tick as well.
      if (
        tradingMode !== 'buy-x-each' &&
        tradingMode !== 'bid-accept-bids' &&
        buyAdditionalItems &&
        buyItemsEveryTick &&
        purchaseAmount > 0
      ) {
        addConsoleLog(
          `\n🛒 Purchasing ${purchaseAmount} item(s) from floor (startup tick)...`
        );
        try {
          const floorPurchaseResult = await buyItemsFromFloor({
            wallets: activeWallets,
            selectedCollection,
            network,
            purchaseAmount,
            addConsoleLog,
            useFees,
            prepDelay,
            exchange: tradingExchange,
            isStopRequested: isStopped,
          });

          const itemsBought = floorPurchaseResult.itemsBought || 0;
          if (
            floorPurchaseResult.pendingPurchases &&
            floorPurchaseResult.pendingPurchases.length > 0
          ) {
            const merged = mergePendingPurchases(
              pendingPurchasesRef.current,
              floorPurchaseResult.pendingPurchases
            );
            setPendingPurchases(merged);
            pendingPurchasesRef.current = merged;
          }

          if (itemsBought > 0) {
            addConsoleLog(
              `✓ Purchased ${itemsBought}/${purchaseAmount} items from floor (startup tick)`
            );
          } else {
            addConsoleLog(
              `⚠ Could not purchase any items from floor (startup tick). Continuing...`
            );
          }
        } catch (err) {
          addConsoleLog(
            `✗ Error purchasing from floor (startup tick): ${err.message}`
          );
          addConsoleLog('Continuing with items already in wallets...');
        }

        if (isStopped()) {
          endRun();
          addConsoleLog(
            'Auto-trading stopped (stop requested during startup).'
          );
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Delta neutral + range trading: same processWalletItems (listing fix, delays, sequential buys)
      let initialResult;
      try {
        initialResult = await processWalletItems({
          wallets: activeWallets,
          selectedCollection,
          network,
          addConsoleLog,
          pendingPurchases: pendingPurchasesRef.current,
          useFees,
          tradePrice: tradePriceSats,
          prepDelay,
          exchange: tradingExchange,
          updatePendingPurchases: (newPending) => {
            setPendingPurchases(newPending);
            pendingPurchasesRef.current = newPending;
          },
          isStopRequested: isStopped,
        });
      } catch (err) {
        addConsoleLog(`✗ Auto-trading stopped after an error: ${err.message}`);
        endRun();
        return;
      }

      if (initialResult.shouldStopTrading) {
        addConsoleLog(
          '\n⏹️ All items delisted and no pending purchases. Stopping auto-trader...'
        );
        endRun();
        if (tradingIntervalRef.current != null) {
          clearTimeout(tradingIntervalRef.current);
          tradingIntervalRef.current = null;
        }
        return;
      }

      // If user clicked Stop during buyItemsFromFloor or initial processWalletItems, do not start the loop
      if (isStopped()) {
        endRun();
        addConsoleLog('Auto-trading stopped (stop requested during startup).');
        return;
      }

      // Use setTimeout chain instead of setInterval so only one cycle runs at a time (no overlapping)
      const scheduleNext = () => {
        if (isStopped()) return;
        tradingIntervalRef.current = setTimeout(async function runCycle() {
          tradingIntervalRef.current = null;
          if (isStopped()) return;
          const currentActiveWallets = getActiveWallets();

          let currentTradePriceSats = null;
          if (tradingMode === 'range-trading') {
            const currentUsePriceRange = usePriceRangeRef.current;
            const currentLowerPrice = lowerTradePriceRef.current;
            const currentUpperPrice = upperTradePriceRef.current;
            const currentTradePrice = tradePriceRef.current;

            if (currentUsePriceRange) {
              if (
                currentLowerPrice > 0 &&
                currentUpperPrice > currentLowerPrice
              ) {
                const randomPrice =
                  currentLowerPrice +
                  Math.random() * (currentUpperPrice - currentLowerPrice);
                currentTradePriceSats = Math.round(randomPrice * 100000000);
                addConsoleLog(
                  `Random trade price: ${randomPrice.toFixed(8)} BTC (range: ${currentLowerPrice.toFixed(8)} - ${currentUpperPrice.toFixed(8)} BTC)`
                );
              } else {
                addConsoleLog(
                  '✗ Invalid price range. Please set valid lower and upper prices.'
                );
                endRun();
                return;
              }
            } else if (currentTradePrice > 0) {
              currentTradePriceSats = Math.round(currentTradePrice * 100000000);
            }
          }

          // Optional: buy additional floor items every tick (only if enabled)
          if (
            tradingMode !== 'buy-x-each' &&
            tradingMode !== 'bid-accept-bids' &&
            buyAdditionalItems &&
            buyItemsEveryTick &&
            purchaseAmount > 0
          ) {
            addConsoleLog(
              `\n🛒 Purchasing ${purchaseAmount} item(s) from floor (tick)...`
            );
            try {
              const floorPurchaseResult = await buyItemsFromFloor({
                wallets: currentActiveWallets,
                selectedCollection,
                network,
                purchaseAmount,
                addConsoleLog,
                useFees,
                prepDelay,
                exchange: tradingExchange,
                isStopRequested: isStopped,
              });

              const itemsBought = floorPurchaseResult.itemsBought || 0;
              if (
                floorPurchaseResult.pendingPurchases &&
                floorPurchaseResult.pendingPurchases.length > 0
              ) {
                const merged = mergePendingPurchases(
                  pendingPurchasesRef.current,
                  floorPurchaseResult.pendingPurchases
                );
                setPendingPurchases(merged);
                pendingPurchasesRef.current = merged;
              }

              if (itemsBought > 0) {
                addConsoleLog(
                  `✓ Purchased ${itemsBought}/${purchaseAmount} items from floor (tick)`
                );
              } else {
                addConsoleLog(
                  `⚠ Could not purchase any items from floor (tick). Continuing...`
                );
              }
            } catch (err) {
              addConsoleLog(
                `✗ Error purchasing from floor (tick): ${err.message}`
              );
              addConsoleLog('Continuing with items already in wallets...');
            }

            if (isStopped()) return;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          let result;
          try {
            result = await processWalletItems({
              wallets: currentActiveWallets,
              selectedCollection,
              network,
              addConsoleLog,
              pendingPurchases: pendingPurchasesRef.current,
              useFees,
              // null for delta neutral (floor); range trading sets random/fixed sats each tick
              tradePrice: currentTradePriceSats,
              prepDelay,
              exchange: tradingExchange,
              updatePendingPurchases: (newPending) => {
                setPendingPurchases(newPending);
                pendingPurchasesRef.current = newPending;
              },
              isStopRequested: isStopped,
            });
          } catch (err) {
            addConsoleLog(
              `✗ Auto-trading stopped after an error: ${err.message}`
            );
            endRun();
            return;
          }

          if (isStopped()) return;
          if (result.shouldStopTrading) {
            addConsoleLog(
              '\n⏹️ All items delisted and no pending purchases. Stopping auto-trader...'
            );
            endRun();
            return;
          }
          scheduleNext();
        }, timerIntervalSeconds * 1000);
      };
      scheduleNext();
    }
  };

  // Cleanup on unmount: end the run so an in-flight cycle does not schedule
  // more trading after the page is gone.
  useEffect(() => {
    return () => {
      tradingStopRequestedRef.current = true;
      tradingRunIdRef.current += 1;
      if (tradingIntervalRef.current != null) {
        clearTimeout(tradingIntervalRef.current);
      }
    };
  }, []);

  return { isTrading, pendingPurchases, handleStartTrading };
};
