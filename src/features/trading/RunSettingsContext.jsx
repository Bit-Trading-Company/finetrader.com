/**
 * Run settings: trading mode and exchange, timer, prices and amounts, fees,
 * prep delay, wallet randomizer and the mempool provider.
 *
 * Held above the router rather than inside the auto-trader page, because the
 * settings dialog is reachable from the sidebar on every screen and has to
 * show the same values the running engine is using. It also means a run's
 * settings survive navigating away and back.
 *
 * Which wallets take part is NOT here — that lives in the wallet session, so
 * the choice holds across pages. `useAutoTradeWorkspace` merges it in under
 * the keys the trading engine expects.
 */
import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
} from 'react';
import {
  getMempoolApiProvider,
  setMempoolApiProvider,
  MEMPOOL_PROVIDERS,
} from '../../lib/mempoolProvider';
import { TRADING_EXCHANGES } from '../../trading/exchanges';

/** localStorage key for the "Pay the app fee" setting ('1' / '0'). */
const FINE_TRADING_USE_FEES_KEY = 'fine-trading-use-fees';

const useRunSettingsState = () => {
  // Step 5: Auto Trading
  const [tradingMode, setTradingMode] = useState('auto-buy-sell'); // Trading mode
  const [tradingExchange, setTradingExchange] = useState(
    TRADING_EXCHANGES.SATFLOW
  );
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
  const [tradePrice, setTradePrice] = useState(0); // Trade price for range trading (in BTC)
  const [usePriceRange, setUsePriceRange] = useState(false); // Toggle between single price and price range
  const [lowerTradePrice, setLowerTradePrice] = useState(0); // Lower trade price for range trading (in BTC)
  const [upperTradePrice, setUpperTradePrice] = useState(0); // Upper trade price for range trading (in BTC)
  const [mempoolProvider, setMempoolProviderState] = useState(
    getMempoolApiProvider()
  );
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

  return {
    tradingMode,
    setTradingMode,
    tradingExchange,
    setTradingExchange,
    timerHours,
    setTimerHours,
    timerMinutes,
    setTimerMinutes,
    timerSeconds,
    setTimerSeconds,
    timerIntervalSeconds,
    buyAdditionalItems,
    setBuyAdditionalItems,
    buyItemsEveryTick,
    setBuyItemsEveryTick,
    purchaseAmount,
    setPurchaseAmount,
    tradePrice,
    setTradePrice,
    usePriceRange,
    setUsePriceRange,
    lowerTradePrice,
    setLowerTradePrice,
    upperTradePrice,
    setUpperTradePrice,
    mempoolProvider,
    walletRandomizer,
    setWalletRandomizer,
    useFees,
    setUseFees,
    prepDelay,
    setPrepDelay,
    sellXAmount,
    setSellXAmount,
    buyXEachAmount,
    setBuyXEachAmount,
    useCustomSellPrice,
    setUseCustomSellPrice,
    customSellPrice,
    setCustomSellPrice,
    handleMempoolProviderChange,
  };
};

const RunSettingsContext = createContext(null);

export const RunSettingsProvider = ({ children }) => {
  const settings = useRunSettingsState();
  const [runActive, setRunActive] = useState(false);

  /*
   * Not memoised: the settings object is rebuilt every render anyway, as it
   * was when this was a plain hook inside the page.
   */
  const value = { ...settings, runActive, setRunActive };

  return (
    <RunSettingsContext.Provider value={value}>
      {children}
    </RunSettingsContext.Provider>
  );
};

/** Every run setting, shared by the auto-trader and the settings dialog. */
export const useRunSettings = () => {
  const context = useContext(RunSettingsContext);
  if (!context) {
    throw new Error('useRunSettings must be used inside a RunSettingsProvider');
  }
  return context;
};
