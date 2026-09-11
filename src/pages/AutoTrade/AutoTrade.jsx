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
import WizardStep from '../../components/WizardStep';
import TradingControls from './components/TradingControls';
import TradingConsole from './components/TradingConsole';
import AutoTradeSettingsModal from './components/AutoTradeSettingsModal';
import { StepStatus } from './constants';
import { useTradingConsole } from './hooks/useTradingConsole';
import { useAutoTradeSettings } from './hooks/useAutoTradeSettings';
import { useAutoTradeRunner } from './hooks/useAutoTradeRunner';
import { checkTransactionConfirmed } from '../../trading/chain';
import { TRADING_EXCHANGES, getTradingApi } from '../../trading/exchanges';
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
  const { consoleLogs, addConsoleLog, consoleRef } = useTradingConsole();
  const settings = useAutoTradeSettings({ wallets });
  const {
    tradingMode,
    tradingExchange,
    tradePrice,
    setTradePrice,
    setLowerTradePrice,
    setUpperTradePrice,
    setSelectedWalletIndices,
  } = settings;
  const { isTrading, handleStartTrading } = useAutoTradeRunner({
    settings,
    wallets,
    selectedCollection,
    network,
    addConsoleLog,
  });

  // Settings state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCollectionOfferModal, setShowCollectionOfferModal] =
    useState(false);

  // Create a shared event hub
  const glEventHub = useEventHub();

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
  }, [glEventHub, stepStatuses, setSelectedWalletIndices]);

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
    setTradePrice,
    setLowerTradePrice,
    setUpperTradePrice,
    addConsoleLog,
    wallets,
    network,
  ]);

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

  const selectedCollectionSlug = useMemo(() => {
    if (!selectedCollection) return null;
    return (
      selectedCollection.collectionSymbol ||
      selectedCollection.symbol ||
      selectedCollection.collectionId ||
      null
    );
  }, [selectedCollection]);

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
        <WizardStep
          classPrefix="auto-trade"
          headerStyle={{ cursor: 'pointer' }}
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
        </WizardStep>

        {/* Step 2: Create Fine Trading Wallets */}
        <WizardStep
          classPrefix="auto-trade"
          headerStyle={{ cursor: 'pointer' }}
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
        </WizardStep>

        {/* Step 3: Dispatch BTC */}
        <WizardStep
          classPrefix="auto-trade"
          headerStyle={{ cursor: 'pointer' }}
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
        </WizardStep>

        {/* Step 4: Select Collection */}
        <WizardStep
          classPrefix="auto-trade"
          headerStyle={{ cursor: 'pointer' }}
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
        </WizardStep>

        {/* Step 5: Start Auto-Trading */}
        <WizardStep
          classPrefix="auto-trade"
          headerStyle={{ cursor: 'pointer', position: 'relative' }}
          number={5}
          title="Start Auto Trading"
          isActive={currentStep === 5}
          isComplete={stepStatuses[5] === StepStatus.COMPLETE}
          onSelect={() => handleStepClick(5)}
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
            settings={settings}
            isTrading={isTrading}
            selectedCollectionSlug={selectedCollectionSlug}
            setShowCollectionOfferModal={setShowCollectionOfferModal}
            wallets={wallets}
            handleStartTrading={handleStartTrading}
            selectedCollection={selectedCollection}
          />

          <TradingConsole consoleRef={consoleRef} consoleLogs={consoleLogs} />
        </WizardStep>

        {/* Settings Modal */}
        {showSettingsModal && (
          <AutoTradeSettingsModal
            onClose={() => setShowSettingsModal(false)}
            settings={settings}
            isTrading={isTrading}
            wallets={wallets}
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
