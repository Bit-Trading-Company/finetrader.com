import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { useWalletConnection } from '../../features/wallet/useWalletConnection';
import WalletManagement from '../../features/wallet/WalletManagement';
import Dispatch from '../../features/wallet/Dispatch';
import OrdinalsCollections from '../../features/marketplace/OrdinalsCollections';
import CollectionOfferModal from '../../features/marketplace/CollectionOfferModal';
import AutoTradeStep from './components/AutoTradeStep';
import TradingControls from './components/TradingControls';
import TradingConsole from './components/TradingConsole';
import AutoTradeSettingsModal from './components/AutoTradeSettingsModal';
import { FINE_TRADING_USE_FEES_KEY, StepStatus } from './constants';
import {
  processWalletItems,
  buyItemsFromFloor,
  buyXFromEachWallet,
  sellXFromEachWallet,
} from '../../trading/autoTradeEngine';
import { checkTransactionConfirmed } from '../../trading/chain';
import { TRADING_EXCHANGES, getTradingApi } from '../../trading/exchanges';
import { mergePendingPurchases } from '../../trading/pendingPurchases';
import {
  MEMPOOL_PROVIDERS,
  getMempoolApiProvider,
  setMempoolApiProvider,
} from '../../lib/mempoolProvider';
import background_6 from '../../assets/images/png/backgrounds/background_6.PNG';
import './AutoTrade.css';
import { useEventHub } from '../../lib/eventHub';
import { CONNECT_WALLET_LIST } from '../../features/wallet/walletOptions';

const AutoTrade = () => {
  // Step states
  const [currentStep, setCurrentStep] = useState(1);
  const [stepStatuses, setStepStatuses] = useState({
    1: null, // Connect Wallet
    2: null, // Create Wallets
    3: null, // Dispatch BTC
    4: null, // Select Collection
    5: null, // Start Trading
  });

  // Wallet connection state (connect/disconnect reload the page on success)
  const {
    network,
    address: connectedAddress,
    isWalletConnected,
    connect,
    disconnect,
  } = useWalletConnection();

  // Step 2: Wallet Management
  const [wallets, setWallets] = useState([]);

  // Check for wallets in localStorage (from WalletManagement)
  useEffect(() => {
    const checkForWallets = () => {
      // WalletManagement stores selected wallet, but we need all wallets
      // For now, we'll rely on the wallet-selected event to indicate wallets exist
      // In a full implementation, WalletManagement would emit a 'wallets-generated' event
    };
    checkForWallets();
  }, []);

  // Step 3: Dispatch
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchTxIds] = useState([]);
  const [dispatchStatuses, setDispatchStatuses] = useState({});

  // Step 4: Collection Selection
  const [selectedCollection, setSelectedCollection] = useState(null);

  // Step 5: Auto Trading
  const [tradingMode, setTradingMode] = useState('auto-buy-sell'); // Trading mode
  const [tradingExchange, setTradingExchange] = useState(
    TRADING_EXCHANGES.SATFLOW
  );
  const [isTrading, setIsTrading] = useState(false);
  const [timerHours, setTimerHours] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(1);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerIntervalSeconds = useMemo(() => {
    const h = Number.isFinite(timerHours) ? timerHours : 0;
    const m = Number.isFinite(timerMinutes) ? timerMinutes : 0;
    const s = Number.isFinite(timerSeconds) ? timerSeconds : 0;
    const total = h * 3600 + m * 60 + s;
    // Preserve prior minimum (10 seconds) to avoid extremely tight loops.
    return Math.max(10, total || 60);
  }, [timerHours, timerMinutes, timerSeconds]);
  const [buyAdditionalItems, setBuyAdditionalItems] = useState(false); // Checkbox for buying additional items
  const [buyItemsEveryTick, setBuyItemsEveryTick] = useState(false); // Only available when buyAdditionalItems is enabled
  const [purchaseAmount, setPurchaseAmount] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [pendingPurchases, setPendingPurchases] = useState([]); // Track purchases waiting for confirmation
  const [tradePrice, setTradePrice] = useState(0); // Trade price for range trading (in BTC)
  const [usePriceRange, setUsePriceRange] = useState(false); // Toggle between single price and price range
  const [lowerTradePrice, setLowerTradePrice] = useState(0); // Lower trade price for range trading (in BTC)
  const [upperTradePrice, setUpperTradePrice] = useState(0); // Upper trade price for range trading (in BTC)
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
  const [mempoolProvider, setMempoolProviderState] = useState(
    getMempoolApiProvider()
  );

  // Settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCollectionOfferModal, setShowCollectionOfferModal] =
    useState(false);
  const [useCustomWalletSubset, setUseCustomWalletSubset] = useState(false);
  const [selectedWalletIndices, setSelectedWalletIndices] = useState(new Set());
  const [walletRandomizer, setWalletRandomizer] = useState(false);
  const [useFees, setUseFees] = useState(() => {
    try {
      if (typeof window === 'undefined') return true;
      const v = window.localStorage.getItem(FINE_TRADING_USE_FEES_KEY);
      if (v === '0' || v === 'false') return false;
      if (v === '1' || v === 'true') return true;
      return true;
    } catch {
      return true;
    }
  });
  const [prepDelay, setPrepDelay] = useState(3000); // 3 second delay between prep attempts (default)
  const [sellXAmount, setSellXAmount] = useState(1); // Number of items to sell from each wallet
  const [buyXEachAmount, setBuyXEachAmount] = useState(1); // Floor items to buy per wallet (buy-x-each mode)
  const [useCustomSellPrice, setUseCustomSellPrice] = useState(false); // Use custom price for sell-x-each mode
  const [customSellPrice, setCustomSellPrice] = useState(0); // Custom sell price in BTC

  // Removed unused state - simplified logic doesn't need these anymore

  // Create a shared event hub
  const glEventHub = useEventHub();

  // Add console log (defined early so it can be used in useEffect hooks)
  const addConsoleLog = useCallback((message, link = null) => {
    setConsoleLogs((prev) => {
      const newLogs = [
        ...prev,
        { message, link, timestamp: new Date().toLocaleTimeString() },
      ];
      // Keep only last 1000 logs to prevent memory issues
      return newLogs.slice(-1000);
    });
  }, []);

  // Listen for wallet connection changes
  useEffect(() => {
    const handleConnectionChange = (newConnectionState) => {
      if (newConnectionState.isConnected) {
        setStepStatuses((prev) => ({ ...prev, 1: StepStatus.COMPLETE }));
        if (currentStep === 1) {
          setCurrentStep(2);
        }
      } else {
        setStepStatuses((prev) => ({ ...prev, 1: null }));
      }
    };

    if (glEventHub) {
      glEventHub.on('wallet-connection-changed', handleConnectionChange);
      return () => {
        glEventHub.off('wallet-connection-changed', handleConnectionChange);
      };
    }
  }, [glEventHub, currentStep]);

  // Listen for wallet generation and selection
  useEffect(() => {
    const handleWalletsGenerated = (generatedWallets) => {
      // Store all generated wallets
      setWallets(generatedWallets);
      // Initialize selected wallet indices to all wallets (all selected by default)
      if (generatedWallets.length > 0) {
        setSelectedWalletIndices(
          new Set(generatedWallets.map((_, index) => index))
        );
      }
      // Mark step 2 as complete when wallets are generated
      setStepStatuses((prev) => ({ ...prev, 2: StepStatus.COMPLETE }));
    };

    const handleWalletSelect = () => {
      // When a wallet is selected, it means wallets exist
      // Mark step 2 as complete if not already
      if (!stepStatuses[2]) {
        setStepStatuses((prev) => ({ ...prev, 2: StepStatus.COMPLETE }));
      }
    };

    if (glEventHub) {
      glEventHub.on('wallets-generated', handleWalletsGenerated);
      glEventHub.on('wallet-selected', handleWalletSelect);
      return () => {
        glEventHub.off('wallets-generated', handleWalletsGenerated);
        glEventHub.off('wallet-selected', handleWalletSelect);
      };
    }
  }, [glEventHub, stepStatuses]);

  // Update selected wallet indices when wallets change
  useEffect(() => {
    if (wallets.length > 0 && !useCustomWalletSubset) {
      // If custom subset is disabled, ensure all wallets are selected
      const allIndices = new Set(wallets.map((_, index) => index));
      setSelectedWalletIndices((prev) => {
        // Only update if the sets don't match
        if (
          prev.size !== allIndices.size ||
          !Array.from(allIndices).every((i) => prev.has(i))
        ) {
          return allIndices;
        }
        return prev; // Return previous value to avoid unnecessary updates
      });
    }
  }, [wallets, useCustomWalletSubset]);

  // Listen for collection selection
  useEffect(() => {
    const handleCollectionSelect = (collection) => {
      setSelectedCollection(collection);
      setStepStatuses((prev) => ({ ...prev, 4: StepStatus.COMPLETE }));
      if (currentStep === 4) {
        setCurrentStep(5);
      }
    };

    if (glEventHub) {
      glEventHub.on('collection-selected', handleCollectionSelect);
      return () => {
        glEventHub.off('collection-selected', handleCollectionSelect);
      };
    }
  }, [glEventHub, currentStep]);

  // Fetch floor price when range trading is selected (only once)
  const hasFetchedFloorPriceRef = useRef(false);
  useEffect(() => {
    const fetchFloorPriceForRangeTrading = async () => {
      if (
        tradingMode === 'range-trading' &&
        selectedCollection &&
        tradePrice === 0 &&
        !hasFetchedFloorPriceRef.current
      ) {
        const collectionSymbol =
          selectedCollection.collectionSymbol ||
          selectedCollection.symbol ||
          selectedCollection.collectionId;

        if (collectionSymbol) {
          if (
            tradingExchange === TRADING_EXCHANGES.ORDNET &&
            wallets.length === 0
          ) {
            return;
          }
          hasFetchedFloorPriceRef.current = true;
          try {
            const floorPriceSats = await getTradingApi(
              tradingExchange
            ).getFloorPrice(collectionSymbol, true, {
              wallet: wallets[0],
              wallets,
              network,
            });
            if (floorPriceSats) {
              // Convert from sats to BTC
              const floorPriceBTC = floorPriceSats / 100000000;
              const upperPriceBTC = floorPriceBTC * 1.1; // +10% of floor price
              setTradePrice(floorPriceBTC);
              setLowerTradePrice(floorPriceBTC);
              setUpperTradePrice(upperPriceBTC);
              // Update refs
              tradePriceRef.current = floorPriceBTC;
              lowerTradePriceRef.current = floorPriceBTC;
              upperTradePriceRef.current = upperPriceBTC;
              addConsoleLog(
                `Floor price fetched for range trading: ${floorPriceBTC.toFixed(8)} BTC (range: ${floorPriceBTC.toFixed(8)} - ${upperPriceBTC.toFixed(8)} BTC)`
              );
            }
          } catch (err) {
            console.error('Error fetching floor price:', err);
            addConsoleLog('⚠ Could not fetch floor price for range trading');
          }
        }
      }
    };

    fetchFloorPriceForRangeTrading();
  }, [
    tradingMode,
    tradingExchange,
    selectedCollection,
    tradePrice,
    addConsoleLog,
    wallets,
    network,
  ]);

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

  // Reset fetch flag when trading mode changes away from range trading
  useEffect(() => {
    if (tradingMode !== 'range-trading') {
      hasFetchedFloorPriceRef.current = false;
    }
  }, [tradingMode]);

  // Update step 1 status based on wallet connection
  useEffect(() => {
    if (isWalletConnected) {
      setStepStatuses((prev) => ({ ...prev, 1: StepStatus.COMPLETE }));
    } else {
      setStepStatuses((prev) => ({ ...prev, 1: null }));
    }
  }, [isWalletConnected]);

  // Sync mempool provider state from localStorage on mount
  useEffect(() => {
    setMempoolProviderState(getMempoolApiProvider());
  }, []);

  // If user disables "Buy additional items", also disable "Buy items every tick"
  useEffect(() => {
    if (!buyAdditionalItems && buyItemsEveryTick) {
      setBuyItemsEveryTick(false);
    }
  }, [buyAdditionalItems, buyItemsEveryTick]);

  const handleMempoolProviderChange = (provider) => {
    setMempoolApiProvider(provider);
    setMempoolProviderState(provider);
  };

  // On load, if using mempool.space, test connectivity and fall back to blockstream.info on failure
  useEffect(() => {
    const testMempool = async () => {
      // Only test when mempool.space is selected
      if (mempoolProvider !== MEMPOOL_PROVIDERS.MEMPOOL_SPACE) return;

      try {
        const response = await fetch(
          'https://mempool.space/api/block-height/1'
        );
        if (!response.ok) {
          // Switch to blockstream if mempool.space is not responding correctly
          handleMempoolProviderChange(MEMPOOL_PROVIDERS.BLOCKSTREAM);
        }
      } catch (err) {
        // Network error or other failure – also switch provider
        handleMempoolProviderChange(MEMPOOL_PROVIDERS.BLOCKSTREAM);
      }
    };

    testMempool();
    // We intentionally depend only on mempoolProvider so we re-test
    // when the user manually switches back to mempool.space.
  }, [mempoolProvider]);

  // Handle wallet connection (the page reloads on success)
  const handleConnect = async (wallet) => {
    try {
      await connect(wallet);
    } catch (error) {
      console.error('Wallet connection error:', error);
    }
  };

  // Handle disconnect (the page reloads)
  const handleDisconnect = () => {
    try {
      disconnect();
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  // Poll transaction status (kept for dispatch, but using utility function for trading)
  const pollTransactionStatus = useCallback(async (txId, network) => {
    return await checkTransactionConfirmed(txId, network);
  }, []);

  // Poll dispatch transactions
  useEffect(() => {
    if (dispatchTxIds.length === 0) return;

    const interval = setInterval(async () => {
      const newStatuses = { ...dispatchStatuses };
      let allConfirmed = true;

      for (const txId of dispatchTxIds) {
        if (!newStatuses[txId] || !newStatuses[txId].confirmed) {
          const confirmed = await pollTransactionStatus(txId, network);
          newStatuses[txId] = { confirmed, txId };
          if (!confirmed) {
            allConfirmed = false;
          }
        }
      }

      setDispatchStatuses(newStatuses);

      if (allConfirmed && dispatchTxIds.length > 0) {
        setStepStatuses((prev) => ({ ...prev, 3: StepStatus.COMPLETE }));
        if (currentStep === 3) {
          setCurrentStep(4);
        }
      } else if (dispatchTxIds.length > 0) {
        setStepStatuses((prev) => ({ ...prev, 3: StepStatus.IN_PROGRESS }));
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [
    dispatchTxIds,
    dispatchStatuses,
    network,
    currentStep,
    pollTransactionStatus,
  ]);

  // Auto-scroll console to bottom when new logs are added
  const consoleRef = useRef(null);
  useEffect(() => {
    if (consoleRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (consoleRef.current) {
          consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
      });
    }
  }, [consoleLogs]);

  // =============================================================================
  // TRADING LOGIC - Uses processWalletItems() from trading/autoTradeEngine.js
  // =============================================================================

  // Get active wallets based on settings
  const getActiveWallets = useCallback(() => {
    let activeWallets = wallets;

    // Filter to selected subset if custom wallet subset is enabled
    if (useCustomWalletSubset && selectedWalletIndices.size > 0) {
      activeWallets = wallets.filter((_, index) =>
        selectedWalletIndices.has(index)
      );
    }

    // Randomize wallet order if randomizer is enabled
    if (walletRandomizer && activeWallets.length > 1) {
      activeWallets = [...activeWallets].sort(() => Math.random() - 0.5);
    }

    return activeWallets;
  }, [wallets, useCustomWalletSubset, selectedWalletIndices, walletRandomizer]);

  const selectedCollectionSlug = useMemo(() => {
    if (!selectedCollection) return null;
    return (
      selectedCollection.collectionSymbol ||
      selectedCollection.symbol ||
      selectedCollection.collectionId ||
      null
    );
  }, [selectedCollection]);

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
      if (tradingExchange === TRADING_EXCHANGES.ORDNET) {
        addConsoleLog('Auto-trading started on ord.net');
      } else {
        addConsoleLog('Auto-trading started');
      }

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

  // Step handlers - allow clicking on any step at any time
  const handleStepClick = (step) => {
    setCurrentStep(step);
  };

  return (
    <div
      className="auto-trade-container"
      style={{
        backgroundImage: `url(${background_6})`,
        position: 'relative',
      }}
    >
      <div className="auto-trade-content">
        <h1 className="auto-trade-title">Fine auto-trader</h1>

        {/* Global Settings Button - Top Left */}
        <button
          onClick={() => setShowSettingsModal(true)}
          className="auto-trade-button"
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            backgroundColor: '#4a5568',
            border: '1px solid #718096',
            padding: '6px 10px',
            fontSize: '14px',
            zIndex: 10,
          }}
        >
          ⚙
        </button>

        {/* Step 1: Connect Wallet */}
        <AutoTradeStep
          number={1}
          title="Connect Wallet"
          isActive={currentStep === 1}
          isComplete={stepStatuses[1] === StepStatus.COMPLETE}
          onSelect={() => handleStepClick(1)}
        >
          {!isWalletConnected ? (
            <div className="auto-trade-wallet-list">
              {CONNECT_WALLET_LIST.map((walletItem, i) => (
                <button
                  key={i}
                  className="auto-trade-wallet-item"
                  onClick={() => handleConnect(walletItem.wallet)}
                >
                  <img
                    src={walletItem.icon}
                    alt={`${walletItem.wallet} icon`}
                    className="auto-trade-wallet-icon"
                  />
                  <span>{walletItem.wallet}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="auto-trade-step-complete">
              <p>
                Wallet connected: {connectedAddress?.ordinals?.slice(0, 8)}
                ...
              </p>
              <button
                onClick={handleDisconnect}
                className="auto-trade-button"
                style={{ marginTop: '8px' }}
              >
                Disconnect Wallet
              </button>
            </div>
          )}
        </AutoTradeStep>

        {/* Step 2: Create Fine Trading Wallets */}
        <AutoTradeStep
          number={2}
          title="Create Fine Trading Wallets"
          isActive={currentStep === 2}
          isComplete={stepStatuses[2] === StepStatus.COMPLETE}
          onSelect={() => handleStepClick(2)}
        >
          <WalletManagement glEventHub={glEventHub} />
          {stepStatuses[2] === StepStatus.COMPLETE && (
            <button
              onClick={() => setCurrentStep(3)}
              className="auto-trade-button"
              style={{ marginTop: '16px' }}
            >
              Continue to Step 3
            </button>
          )}
        </AutoTradeStep>

        {/* Step 3: Dispatch BTC */}
        <AutoTradeStep
          number={3}
          title="Dispatch BTC"
          isActive={currentStep === 3}
          isComplete={stepStatuses[3] === StepStatus.COMPLETE}
          onSelect={() => handleStepClick(3)}
        >
          <p style={{ color: '#a0aec0', marginBottom: '16px' }}>
            Dispatch BTC to your proxy wallets. Transactions will be monitored
            for confirmation.
          </p>
          <button
            onClick={() => setShowDispatchModal(true)}
            className="auto-trade-button"
          >
            Open Dispatch Modal
          </button>
          {stepStatuses[3] === StepStatus.IN_PROGRESS && (
            <div style={{ marginTop: '16px', color: '#ed8936' }}>
              ⏳ Waiting for transaction confirmation...
            </div>
          )}
          {stepStatuses[3] === StepStatus.COMPLETE && (
            <div style={{ marginTop: '16px', color: '#48bb78' }}>
              ✓ Dispatch transactions confirmed!
            </div>
          )}
          <Dispatch
            isOpen={showDispatchModal}
            onClose={() => setShowDispatchModal(false)}
            proxyWallets={wallets}
          />
        </AutoTradeStep>

        {/* Step 4: Select Collection */}
        <AutoTradeStep
          number={4}
          title="Select Collection to Trade"
          isActive={currentStep === 4}
          isComplete={stepStatuses[4] === StepStatus.COMPLETE}
          onSelect={() => handleStepClick(4)}
        >
          <OrdinalsCollections glEventHub={glEventHub} />
          {selectedCollection && (
            <div className="auto-trade-selected-collection">
              <h3>Selected Collection:</h3>
              <p>
                {selectedCollection.name || selectedCollection.collectionSymbol}
              </p>
              {selectedCollection.image && (
                <img
                  src={selectedCollection.image}
                  alt={selectedCollection.name}
                  className="auto-trade-collection-image"
                />
              )}
              <button
                onClick={() => setCurrentStep(5)}
                className="auto-trade-button"
                style={{ marginTop: '16px' }}
              >
                Continue to Step 5
              </button>
            </div>
          )}
        </AutoTradeStep>

        {/* Step 5: Start Auto-Trading */}
        <AutoTradeStep
          number={5}
          title="Start Auto Trading"
          isActive={currentStep === 5}
          isComplete={stepStatuses[5] === StepStatus.COMPLETE}
          onSelect={() => handleStepClick(5)}
          headerStyle={{ position: 'relative' }}
          headerExtra={
            // Settings button (top right of the step header)
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSettingsModal(true);
              }}
              className="auto-trade-button"
              disabled={isTrading}
              style={{
                position: 'absolute',
                top: '92px',
                right: '8px',
                backgroundColor: '#4a5568',
                border: '1px solid #718096',
                padding: '8px 12px',
                fontSize: '18px',
              }}
              title="Settings"
            >
              ⚙️
            </button>
          }
        >
          {/* Trading Mode Selection */}
          <TradingControls
            tradingExchange={tradingExchange}
            setTradingExchange={setTradingExchange}
            isTrading={isTrading}
            tradingMode={tradingMode}
            setTradingMode={setTradingMode}
            timerHours={timerHours}
            setTimerHours={setTimerHours}
            timerMinutes={timerMinutes}
            setTimerMinutes={setTimerMinutes}
            timerSeconds={timerSeconds}
            setTimerSeconds={setTimerSeconds}
            timerIntervalSeconds={timerIntervalSeconds}
            selectedCollectionSlug={selectedCollectionSlug}
            setShowCollectionOfferModal={setShowCollectionOfferModal}
            usePriceRange={usePriceRange}
            setUsePriceRange={setUsePriceRange}
            tradePrice={tradePrice}
            setTradePrice={setTradePrice}
            lowerTradePrice={lowerTradePrice}
            setLowerTradePrice={setLowerTradePrice}
            upperTradePrice={upperTradePrice}
            setUpperTradePrice={setUpperTradePrice}
            buyXEachAmount={buyXEachAmount}
            setBuyXEachAmount={setBuyXEachAmount}
            useCustomWalletSubset={useCustomWalletSubset}
            selectedWalletIndices={selectedWalletIndices}
            wallets={wallets}
            sellXAmount={sellXAmount}
            setSellXAmount={setSellXAmount}
            useCustomSellPrice={useCustomSellPrice}
            setUseCustomSellPrice={setUseCustomSellPrice}
            customSellPrice={customSellPrice}
            setCustomSellPrice={setCustomSellPrice}
            buyAdditionalItems={buyAdditionalItems}
            setBuyAdditionalItems={setBuyAdditionalItems}
            setPurchaseAmount={setPurchaseAmount}
            setBuyItemsEveryTick={setBuyItemsEveryTick}
            purchaseAmount={purchaseAmount}
            buyItemsEveryTick={buyItemsEveryTick}
            handleStartTrading={handleStartTrading}
            selectedCollection={selectedCollection}
          />

          <TradingConsole consoleRef={consoleRef} consoleLogs={consoleLogs} />
        </AutoTradeStep>

        {/* Settings Modal */}
        {showSettingsModal && (
          <AutoTradeSettingsModal
            onClose={() => setShowSettingsModal(false)}
            mempoolProvider={mempoolProvider}
            handleMempoolProviderChange={handleMempoolProviderChange}
            isTrading={isTrading}
            useFees={useFees}
            setUseFees={setUseFees}
            prepDelay={prepDelay}
            setPrepDelay={setPrepDelay}
            useCustomWalletSubset={useCustomWalletSubset}
            setUseCustomWalletSubset={setUseCustomWalletSubset}
            setSelectedWalletIndices={setSelectedWalletIndices}
            wallets={wallets}
            selectedWalletIndices={selectedWalletIndices}
            walletRandomizer={walletRandomizer}
            setWalletRandomizer={setWalletRandomizer}
          />
        )}

        <CollectionOfferModal
          glEventHub={glEventHub}
          collectionSymbol={selectedCollectionSlug || ''}
          isOpen={showCollectionOfferModal}
          onClose={() => setShowCollectionOfferModal(false)}
        />
      </div>
    </div>
  );
};

export default AutoTrade;
