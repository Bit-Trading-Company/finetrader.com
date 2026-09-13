/**
 * Auto-trader: the page the app exists for.
 *
 * Two presentations of one session — a guided five-step flow, and a dashboard
 * — sharing the wallets, collection, settings and running engine held by
 * `useAutoTradeWorkspace`. Switching between them never interrupts a run.
 *
 * Funding (`Dispatch`) and bidding (`CollectionOfferModal`) are still the
 * pre-redesign components. They learn about wallets through an event hub, so
 * the session is mirrored onto one for them (see `useWalletSessionBridge`).
 */
import React, { useCallback, useState } from 'react';
import Dispatch from '../../features/wallet/Dispatch';
import CollectionOfferModal from '../../features/marketplace/CollectionOfferModal';
import { useEventHub } from '../../lib/eventHub';
import { useWalletSessionBridge } from '../../features/wallet/WalletSession';
import { Alert, Button, PageHeader, Tabs } from '../../ui';
import AdvancedView from './components/AdvancedView';
import SimpleFlow from './components/SimpleFlow';
import RunSettingsModal from './components/RunSettingsModal';
import { useAutoTradeWorkspace } from './useAutoTradeWorkspace';
import styles from './AutoTrade.module.css';

const VIEWS = [
  { id: 'simple', label: 'Simple' },
  { id: 'advanced', label: 'Advanced' },
];

/**
 * Start / Stop, plus the reason it cannot start yet. Rendered by both views,
 * so it is built once here and handed down.
 */
const StartButton = ({ workspace }) => {
  const { isTrading, handleStartTrading, readiness, mode } = workspace;

  // Bidding is driven by hand from its own modal; there is no run to start.
  if (mode?.id === 'bid-accept-bids') return null;

  const blocked = Boolean(readiness.blocker) && !isTrading;
  const label = isTrading
    ? 'Stop trading'
    : mode?.runs
      ? 'Start trading'
      : `Run ${mode?.label?.toLowerCase() || 'once'}`;

  return (
    <div className={styles.start}>
      <Button
        size="lg"
        fullWidth
        variant={isTrading ? 'danger' : 'primary'}
        disabled={blocked}
        onClick={handleStartTrading}
      >
        {label}
      </Button>
      {blocked && <p className={styles.blocker}>{readiness.blocker} first.</p>}
    </div>
  );
};

const AutoTrade = () => {
  const workspace = useAutoTradeWorkspace();
  const {
    view,
    setView,
    wallets,
    session,
    collectionSlug,
    settings,
    isTrading,
  } = workspace;

  const [showDispatch, setShowDispatch] = useState(false);
  const [showBids, setShowBids] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Legacy funding and bidding panels listen on a hub rather than the
  // session, so keep one fed for them.
  const glEventHub = useEventHub();
  useWalletSessionBridge(glEventHub);

  const openBids = useCallback(() => {
    // The bid panel signs with the selected proxy wallet; if the user has not
    // picked one, act as the first rather than failing silently.
    if (!session.selectedWallet && wallets.length > 0) {
      session.selectWallet(wallets[0]);
    }
    setShowBids(true);
  }, [session, wallets]);

  const startButton = <StartButton workspace={workspace} />;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Auto-trader"
        description="Run a collection from your proxy wallets."
        actions={
          <div className={styles.headerActions}>
            <Tabs
              items={VIEWS}
              value={view}
              onChange={setView}
              variant="pills"
              ariaLabel="Auto-trader views"
            />
            <Button variant="ghost" onClick={() => setShowSettings(true)}>
              Settings
            </Button>
          </div>
        }
      />

      {isTrading && (
        <Alert tone="info">
          A run is in progress. Leaving this page stops it.
        </Alert>
      )}

      {view === 'simple' ? (
        <SimpleFlow
          workspace={workspace}
          onOpenDispatch={() => setShowDispatch(true)}
          onOpenBids={openBids}
          startButton={startButton}
        />
      ) : (
        <AdvancedView
          workspace={workspace}
          onOpenDispatch={() => setShowDispatch(true)}
          onOpenBids={openBids}
          startButton={startButton}
        />
      )}

      <Dispatch
        isOpen={showDispatch}
        onClose={() => setShowDispatch(false)}
        proxyWallets={wallets}
      />

      <CollectionOfferModal
        glEventHub={glEventHub}
        collectionSymbol={collectionSlug || ''}
        isOpen={showBids}
        onClose={() => setShowBids(false)}
      />

      <RunSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        isTrading={isTrading}
      />
    </div>
  );
};

export default AutoTrade;
