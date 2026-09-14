/**
 * Auto-trader: the page the app exists for.
 *
 * Two presentations of one session — a guided five-step flow, and a dashboard
 * — sharing the wallets, collection, settings and running engine held by
 * `useAutoTradeWorkspace`. Switching between them never interrupts a run.
 *
 * Bidding (`CollectionOfferModal`) is still a pre-redesign component. It
 * learns about wallets through an event hub, so the session is mirrored onto
 * one for it (see `useWalletSessionBridge`). Funding and the wallets manager
 * are app-level dialogs owned by the shell, so this page only asks for them.
 */
import React, { useCallback, useEffect } from 'react';
import CollectionOfferModal from '../../features/marketplace/CollectionOfferModal';
import { useEventHub } from '../../lib/eventHub';
import { useWalletSessionBridge } from '../../features/wallet/WalletSession';
import { DIALOG, useDialogs } from '../../app/DialogContext';
import { Alert, Button, IconButton, Page, PageHeader, Toggle } from '../../ui';
import { SettingsIcon } from '../../ui/icons';
import AdvancedView from './components/AdvancedView';
import SimpleFlow from './components/SimpleFlow';
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

  const { isDialogOpen, openDialog, closeDialog } = useDialogs();

  // Both views offer "Run settings"; they land on the section, not the dialog.
  const openRunSettings = useCallback(
    () => openDialog(DIALOG.settings, 'run'),
    [openDialog]
  );

  /*
   * The settings dialog is mounted by the shell and has no view of the
   * engine, so tell the shared settings whether a run is going — that is what
   * locks the fields the runner is reading.
   */
  const { setRunActive } = settings;
  useEffect(() => {
    setRunActive(isTrading);
    return () => setRunActive(false);
  }, [isTrading, setRunActive]);

  // The legacy bidding panel listens on a hub rather than the session, so
  // keep one fed for it.
  const glEventHub = useEventHub();
  useWalletSessionBridge(glEventHub);

  const openBids = useCallback(() => {
    // The bid panel signs with the selected proxy wallet; if the user has not
    // picked one, act as the first rather than failing silently.
    if (!session.selectedWallet && wallets.length > 0) {
      session.selectWallet(wallets[0]);
    }
    openDialog(DIALOG.bids);
  }, [session, wallets, openDialog]);

  const startButton = <StartButton workspace={workspace} />;

  return (
    <Page
      variant="trade"
      overlays={
        <>
          <CollectionOfferModal
            glEventHub={glEventHub}
            collectionSymbol={collectionSlug || ''}
            isOpen={isDialogOpen(DIALOG.bids)}
            onClose={closeDialog}
          />
        </>
      }
    >
      <PageHeader
        title="Auto-trader"
        actions={
          <div className={styles.headerActions}>
            <Toggle
              options={VIEWS}
              value={view}
              onChange={setView}
              ariaLabel="Auto-trader view"
            />
            <IconButton
              label="Settings"
              active={isDialogOpen(DIALOG.settings)}
              onClick={() => openDialog(DIALOG.settings)}
            >
              <SettingsIcon />
            </IconButton>
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
          onOpenDispatch={() => openDialog(DIALOG.funding)}
          onOpenBids={openBids}
          onOpenWallets={() => openDialog(DIALOG.wallets)}
          onOpenRunSettings={openRunSettings}
          startButton={startButton}
        />
      ) : (
        <AdvancedView
          workspace={workspace}
          onOpenDispatch={() => openDialog(DIALOG.funding)}
          onOpenBids={openBids}
          onOpenWallets={() => openDialog(DIALOG.wallets)}
          onOpenRunSettings={openRunSettings}
          startButton={startButton}
        />
      )}
    </Page>
  );
};

export default AutoTrade;
