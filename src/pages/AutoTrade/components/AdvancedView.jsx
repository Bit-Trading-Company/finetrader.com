/**
 * The dashboard view: everything about the run visible at once.
 *
 * Same session and same engine as the wizard — this lays it out for someone
 * who already knows the flow and wants to watch wallets, adjust the strategy
 * and read the log without stepping through anything.
 */
import React, { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  StatGrid,
  StatTile,
  Tabs,
} from '../../../ui';
import { formatSatsAsBtc } from '../../../lib/format';
import CollectionPicker from './CollectionPicker';
import ConnectWalletPanel from './ConnectWalletPanel';
import CreateWalletsPanel from './CreateWalletsPanel';
import ProxyWalletTable from './ProxyWalletTable';
import RunControls from './RunControls';
import RunConsole from './RunConsole';
import styles from './AdvancedView.module.css';

const AdvancedView = ({
  workspace,
  onOpenDispatch,
  onOpenBids,
  startButton,
}) => {
  const {
    session,
    wallets,
    balances,
    network,
    selectedCollection,
    selectCollection,
    settings,
    isTrading,
    pendingPurchases,
    consoleLogs,
    consoleRef,
    floorPriceSats,
    applyFloorPrice,
    readiness,
  } = workspace;

  const [panel, setPanel] = useState('wallets');

  if (!readiness.hasWallets) {
    return (
      <Card>
        <EmptyState
          title={
            readiness.connected ? 'No proxy wallets yet' : 'Connect a wallet'
          }
          action={null}
        >
          <p className={styles.emptyCopy}>
            The dashboard shows what each proxy wallet holds and what the trader
            is doing with it.{' '}
            {readiness.connected
              ? 'Derive a set to get started'
              : 'Connect the wallet that will fund them to begin'}{' '}
            — the simple view walks through the whole flow if you would rather
            be guided.
          </p>
          {/* Restores the document flow inside EmptyState's centred text. */}
          <div className={styles.emptyForm}>
            {readiness.connected ? (
              <CreateWalletsPanel session={session} />
            ) : (
              <ConnectWalletPanel />
            )}
          </div>
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className={styles.layout}>
      <StatGrid>
        <StatTile
          label="Proxy wallets"
          value={wallets.length}
          hint={`${balances.totals.funded} funded`}
        />
        <StatTile
          label="Total balance"
          value={formatSatsAsBtc(balances.totals.confirmed)}
          hint={
            balances.totals.pending
              ? `${balances.totals.pending > 0 ? '+' : ''}${formatSatsAsBtc(balances.totals.pending)} pending`
              : 'Confirmed'
          }
        />
        <StatTile
          label="Collection"
          value={selectedCollection?.name || '—'}
          hint={
            floorPriceSats
              ? `Floor ${formatSatsAsBtc(floorPriceSats)}`
              : 'No floor price'
          }
        />
        <StatTile
          label="Status"
          value={isTrading ? 'Running' : 'Idle'}
          tone={isTrading ? 'success' : 'default'}
          hint={
            pendingPurchases.length > 0
              ? `${pendingPurchases.length} purchases confirming`
              : readiness.blocker || 'Ready'
          }
        />
      </StatGrid>

      {balances.error && <Alert tone="warning">{balances.error}</Alert>}

      <div className={styles.columns}>
        <div className={styles.main}>
          <Card
            padding="md"
            title={
              <Tabs
                items={[
                  { id: 'wallets', label: 'Wallets' },
                  { id: 'collection', label: 'Collection' },
                ]}
                value={panel}
                onChange={setPanel}
                ariaLabel="Dashboard panels"
              />
            }
            actions={
              panel === 'wallets' ? (
                <div className={styles.walletActions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onOpenDispatch}
                  >
                    Fund wallets
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={balances.refresh}
                    loading={balances.isLoading}
                  >
                    Refresh
                  </Button>
                </div>
              ) : null
            }
          >
            {panel === 'wallets' ? (
              <ProxyWalletTable
                wallets={wallets}
                balances={balances.balances}
                isLoadingBalances={balances.isLoading}
                settings={settings}
                network={network}
                isTrading={isTrading}
              />
            ) : (
              <CollectionPicker
                selected={selectedCollection}
                onSelect={selectCollection}
              />
            )}
          </Card>

          <RunConsole
            logs={consoleLogs}
            consoleRef={consoleRef}
            isTrading={isTrading}
          />
        </div>

        <aside className={styles.side}>
          <Card title="Run" padding="md">
            <div className={styles.runPanel}>
              {startButton}
              <RunControls
                settings={settings}
                isTrading={isTrading}
                floorPriceSats={floorPriceSats}
                applyFloorPrice={applyFloorPrice}
                onOpenBids={onOpenBids}
                compact
              />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default AdvancedView;
