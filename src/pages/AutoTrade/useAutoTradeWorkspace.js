/**
 * Everything the auto-trader needs, assembled once.
 *
 * The simple wizard and the advanced dashboard are two presentations of the
 * same session: the same wallets, the same collection, the same settings and
 * the same running engine. Switching views must never interrupt a run, so all
 * of that state lives here, above both of them.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWalletConnection } from '../../features/wallet/useWalletConnection';
import { useWalletSession } from '../../features/wallet/WalletSession';
import { useProxyWalletBalances } from '../../features/wallet/useProxyWalletBalances';
import { getCollectionSlug } from '../../features/marketplace/collectionsApi';
import { getTradingApi } from '../../trading/exchanges';
import { useActivityLog } from '../../lib/useActivityLog';
import { useRunSettings } from '../../features/trading/RunSettingsContext';
import { useAutoTradeRunner } from './hooks/useAutoTradeRunner';
import { findTradingMode } from './constants';

const SATS_PER_BTC = 100000000;

/** Remembers which view the user prefers between visits. */
const VIEW_KEY = 'fine-trading-auto-trade-view';

const readView = () => {
  try {
    const stored = window.localStorage.getItem(VIEW_KEY);
    return stored === 'advanced' ? 'advanced' : 'simple';
  } catch {
    return 'simple';
  }
};

export const useAutoTradeWorkspace = () => {
  const { network } = useWalletConnection();
  const session = useWalletSession();
  const { wallets } = session;

  const [view, setViewState] = useState(readView);
  const [selectedCollection, setSelectedCollection] = useState(null);

  const setView = useCallback((next) => {
    setViewState(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* a remembered preference is optional */
    }
  }, []);

  const { consoleLogs, addConsoleLog, clearConsole, consoleRef } =
    useActivityLog();
  const baseSettings = useRunSettings();

  /*
   * The trading engine reads the wallet subset off `settings`, but the subset
   * itself belongs to the session so it survives navigation. Merge it in
   * under the keys the engine already expects rather than teaching the engine
   * about the session.
   */
  const settings = useMemo(
    () => ({
      ...baseSettings,
      useCustomWalletSubset: session.useCustomSubset,
      selectedWalletIndices: session.activeIndices,
      setUseCustomWalletSubset: (on) =>
        on ? session.activateNone() : session.activateAll(),
      setSelectedWalletIndices: (indices) =>
        session.setActiveWalletIndices(indices),
    }),
    [baseSettings, session]
  );
  const { isTrading, pendingPurchases, handleStartTrading } =
    useAutoTradeRunner({
      settings,
      wallets,
      selectedCollection,
      network,
      addConsoleLog,
    });

  // Balances drive the dashboard and tell the wizard whether funding is done.
  // They are not worth fetching while a run is hammering the same endpoints.
  const balances = useProxyWalletBalances(wallets, {
    network,
    enabled: wallets.length > 0 && !isTrading,
  });

  const collectionSlug = useMemo(
    () => getCollectionSlug(selectedCollection),
    [selectedCollection]
  );

  const mode = findTradingMode(settings.tradingMode);

  /*
   * Range trading needs a starting price. Fetch the floor once per collection
   * so the user is not typing in a number they have to look up elsewhere; a
   * price they have already set is never overwritten.
   */
  const [floorPriceSats, setFloorPriceSats] = useState(null);
  const {
    tradingExchange,
    setTradePrice,
    setLowerTradePrice,
    setUpperTradePrice,
  } = settings;

  useEffect(() => {
    if (!collectionSlug) {
      setFloorPriceSats(null);
      return undefined;
    }

    const api = getTradingApi(tradingExchange);
    // ord.net (and any marketplace that signs in for reads) cannot answer
    // until a proxy wallet exists to sign with.
    if (api.needsWalletForReads && wallets.length === 0) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const sats = await api.getFloorPrice(collectionSlug, true, {
          wallet: wallets[0],
          wallets,
          network,
        });
        if (cancelled || !sats) return;
        setFloorPriceSats(sats);
      } catch {
        if (!cancelled) setFloorPriceSats(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [collectionSlug, tradingExchange, wallets, network]);

  /** Fill the range-trading prices from the floor the user can see. */
  const applyFloorPrice = useCallback(() => {
    if (!floorPriceSats) return;
    const btc = floorPriceSats / SATS_PER_BTC;
    setTradePrice(btc);
    setLowerTradePrice(btc);
    setUpperTradePrice(btc * 1.1);
    addConsoleLog(
      `Prices set from floor: ${btc.toFixed(8)} BTC (range up to ${(btc * 1.1).toFixed(8)} BTC)`
    );
  }, [
    floorPriceSats,
    setTradePrice,
    setLowerTradePrice,
    setUpperTradePrice,
    addConsoleLog,
  ]);

  const selectCollection = useCallback(
    (collection) => {
      setSelectedCollection(collection);
      if (collection) {
        addConsoleLog(
          `Collection selected: ${collection.name || getCollectionSlug(collection)}`
        );
      }
    },
    [addConsoleLog]
  );

  /**
   * What the user still has to do, in order. The wizard renders this as five
   * steps; the dashboard uses it to disable Start and say why.
   */
  const readiness = useMemo(() => {
    const funded = balances.totals.funded > 0;
    return {
      connected: session.isWalletConnected,
      hasWallets: wallets.length > 0,
      funded,
      hasCollection: Boolean(selectedCollection),
      /** The first unmet requirement, or null when ready to trade. */
      blocker: !session.isWalletConnected
        ? 'Connect a wallet'
        : wallets.length === 0
          ? 'Create proxy wallets'
          : !funded
            ? 'Fund at least one wallet'
            : !selectedCollection
              ? 'Choose a collection'
              : null,
    };
  }, [
    session.isWalletConnected,
    wallets.length,
    balances.totals.funded,
    selectedCollection,
  ]);

  return {
    view,
    setView,
    network,
    session,
    wallets,
    balances,
    selectedCollection,
    selectCollection,
    collectionSlug,
    settings,
    mode,
    isTrading,
    pendingPurchases,
    handleStartTrading,
    consoleLogs,
    addConsoleLog,
    clearConsole,
    consoleRef,
    floorPriceSats,
    applyFloorPrice,
    readiness,
  };
};
