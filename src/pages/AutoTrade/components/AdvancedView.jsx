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
  Badge,
  Button,
  Card,
  EmptyState,
  StatGrid,
  StatTile,
  Tabs,
} from '../../../ui';
import { formatCompactNumber, formatSatsAsBtc } from '../../../lib/format';
import { getCollectionSlug } from '../../../features/marketplace/collectionsApi';
import CollectionPicker from './CollectionPicker';
import ConnectWalletPanel from './ConnectWalletPanel';
import CreateWalletsPanel from './CreateWalletsPanel';
import PendingPurchases from './PendingPurchases';
import ProxyWalletTable from './ProxyWalletTable';
import RunControls from './RunControls';
import RunConsole from './RunConsole';
import styles from './AdvancedView.module.css';

/**
 * Everything the API reports about the collection being traded. The picker
 * table shows the same fields for every collection; this pins them for the
 * one actually selected, next to the live floor the engine will use.
 */
const CollectionSummary = ({ collection, floorPriceSats }) => {
  const rows = [
    ['Floor (live)', floorPriceSats ? formatSatsAsBtc(floorPriceSats) : '—'],
    ['Floor (listed)', collection.fp ? formatSatsAsBtc(collection.fp) : '—'],
    [
      'Listed',
      collection.listedCount != null
        ? formatCompactNumber(collection.listedCount)
        : '—',
    ],
    [
      'Supply',
      collection.totalSupply
        ? formatCompactNumber(collection.totalSupply)
        : '—',
    ],
    [
      'Volume 24h',
      collection.vol1d != null ? formatSatsAsBtc(collection.vol1d) : '—',
    ],
    [
      'Volume 7d',
      collection.vol7d != null ? formatSatsAsBtc(collection.vol7d) : '—',
    ],
    [
      'Volume 30d',
      collection.vol30d != null ? formatSatsAsBtc(collection.vol30d) : '—',
    ],
    [
      'Total volume',
      collection.totalVol ? formatSatsAsBtc(collection.totalVol) : '—',
    ],
  ];

  return (
    <div className={styles.summary}>
      <div className={styles.summaryHead}>
        {collection.image && (
          <img src={collection.image} alt="" className={styles.summaryThumb} />
        )}
        <div>
          <div className={styles.summaryName}>{collection.name}</div>
          <code className={styles.summarySlug}>
            {getCollectionSlug(collection)}
          </code>
        </div>
        <Badge tone="success">Trading this</Badge>
      </div>

      <dl className={styles.summaryStats}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.summaryStat}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

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
    clearConsole,
    consoleRef,
    floorPriceSats,
    applyFloorPrice,
    readiness,
  } = workspace;

  const [panel, setPanel] = useState('wallets');

  /*
   * The dashboard renders whether or not wallets exist. Gating the whole view
   * behind them meant you could not look at collections, set a strategy or
   * even see what the dashboard was for until after signing — the empty state
   * belongs inside the wallets panel, not in front of everything.
   */
  const walletsPanel = readiness.hasWallets ? (
    <ProxyWalletTable
      wallets={wallets}
      balances={balances.balances}
      isLoadingBalances={balances.isLoading}
      settings={settings}
      session={session}
      network={network}
      isTrading={isTrading}
    />
  ) : (
    <EmptyState
      title={readiness.connected ? 'No proxy wallets yet' : 'Connect a wallet'}
      action={null}
    >
      <p className={styles.emptyCopy}>
        {readiness.connected
          ? 'Derive a set and every wallet, balance and UTXO count shows up here.'
          : 'Connect the wallet that will fund your proxy wallets to begin.'}
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
  );

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
          {/*
            The tab strip is the panel's own header rather than the Card's
            title, which is a heading and renders in the display face.
          */}
          <Card padding="none">
            <div className={styles.panelHeader}>
              <Tabs
                items={[
                  { id: 'wallets', label: 'Wallets' },
                  { id: 'collection', label: 'Collection' },
                ]}
                value={panel}
                onChange={setPanel}
                ariaLabel="Dashboard panels"
              />

              {panel === 'wallets' && (
                <div className={styles.walletActions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onOpenDispatch}
                    disabled={!readiness.hasWallets}
                  >
                    Fund wallets
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={balances.refresh}
                    loading={balances.isLoading}
                    disabled={!readiness.hasWallets}
                  >
                    Refresh
                  </Button>
                </div>
              )}
            </div>

            <div className={styles.panelBody}>
              {panel === 'wallets' ? (
                walletsPanel
              ) : (
                <div className={styles.collectionPanel}>
                  {selectedCollection && (
                    <CollectionSummary
                      collection={selectedCollection}
                      floorPriceSats={floorPriceSats}
                    />
                  )}
                  <CollectionPicker
                    selected={selectedCollection}
                    onSelect={selectCollection}
                    variant="table"
                  />
                </div>
              )}
            </div>
          </Card>

          <PendingPurchases
            purchases={pendingPurchases}
            wallets={wallets}
            network={network}
          />

          <RunConsole
            logs={consoleLogs}
            consoleRef={consoleRef}
            isTrading={isTrading}
            onClear={clearConsole}
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
