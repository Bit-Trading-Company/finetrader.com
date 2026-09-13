/**
 * The dashboard view: everything about the run visible at once.
 *
 * Same session and same engine as the wizard — this lays it out for someone
 * who already knows the flow and wants to watch wallets, adjust the strategy
 * and read the log without stepping through anything.
 */
import React from 'react';
import { Alert, Badge, Button, Card, StatGrid, StatTile } from '../../../ui';
import { formatCompactNumber, formatSatsAsBtc } from '../../../lib/format';
import { getCollectionSlug } from '../../../features/marketplace/collectionsApi';
import CollectionPicker from './CollectionPicker';
import PendingPurchases from './PendingPurchases';
import RunControls from './RunControls';
import RunSettingsFields from './RunSettingsFields';
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
  onOpenWallets,
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

  return (
    <div className={styles.layout}>
      <StatGrid>
        <StatTile
          label="Fine Trader wallets"
          value={wallets.length}
          hint={
            wallets.length
              ? `${session.activeWallets.length} trading · ${balances.totals.funded} funded`
              : 'None yet'
          }
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

      <div className={styles.walletBar}>
        <span className={styles.walletBarText}>
          {readiness.hasWallets
            ? `${wallets.length} wallets · ${formatSatsAsBtc(balances.totals.confirmed)} BTC across them`
            : 'No Fine Trader wallets yet — the auto-trader trades from these.'}
        </span>
        <span className={styles.walletBarActions}>
          <Button variant="secondary" size="sm" onClick={onOpenWallets}>
            {readiness.hasWallets ? 'Manage wallets' : 'Generate wallets'}
          </Button>
          {readiness.hasWallets && (
            <Button variant="ghost" size="sm" onClick={onOpenDispatch}>
              Fund wallets
            </Button>
          )}
        </span>
      </div>

      <div className={styles.columns}>
        <div className={styles.main}>
          <Card padding="none">
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Collections</span>
            </div>

            <div className={styles.panelBody}>
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

              {/*
                Inline rather than behind the Settings dialog: on the
                dashboard these are part of what you are tuning, not a
                one-off preference.
              */}
              <details className={styles.moreSettings}>
                <summary className={styles.moreSummary}>Run settings</summary>
                <div className={styles.moreBody}>
                  <RunSettingsFields
                    settings={settings}
                    isTrading={isTrading}
                  />
                </div>
              </details>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default AdvancedView;
