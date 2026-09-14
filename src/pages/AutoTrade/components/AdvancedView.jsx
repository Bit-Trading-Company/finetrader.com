/**
 * The dashboard view: everything about the run visible at once.
 *
 * Same session and same engine as the wizard — this lays it out for someone
 * who already knows the flow and wants to watch wallets, adjust the strategy
 * and read the log without stepping through anything.
 */
import React from 'react';
import {
  ActivityLog,
  Alert,
  Badge,
  Button,
  Card,
  DoodleDivider,
} from '../../../ui';
import { SettingsIcon } from '../../../ui/icons';
import { formatCompactNumber, formatSatsAsBtc } from '../../../lib/format';
import { getCollectionSlug } from '../../../features/marketplace/collectionsApi';
import CollectionPicker from './CollectionPicker';
import PendingPurchases from './PendingPurchases';
import RunControls from './RunControls';
import styles from './AdvancedView.module.css';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

/**
 * The run at a glance.
 *
 * A row of equal cards gave every figure the same weight. What someone
 * watching an auto-trader actually looks for is whether the engine is moving,
 * so the state leads at display size and the wallets, balance and collection
 * read as supporting figures on the same line.
 */
const RunRibbon = ({ isTrading, stateHint, readings }) => (
  <div className={styles.ribbon}>
    <div className={styles.state}>
      <span
        className={joinClasses(styles.stateDot, isTrading && styles.stateLive)}
        aria-hidden="true"
      />
      <div>
        <div className={styles.stateWord}>{isTrading ? 'Running' : 'Idle'}</div>
        <div className={styles.stateHint}>{stateHint}</div>
      </div>
    </div>

    <dl className={styles.readings}>
      {readings.map(([label, value, hint]) => (
        <div key={label} className={styles.reading}>
          <dt className={styles.readingLabel}>{label}</dt>
          <dd className={styles.readingValue}>{value}</dd>
          <dd className={styles.readingHint}>{hint}</dd>
        </div>
      ))}
    </dl>
  </div>
);

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
  onOpenRunSettings,
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

  const readings = [
    [
      'Wallets',
      wallets.length,
      wallets.length
        ? `${session.activeWallets.length} trading · ${balances.totals.funded} funded`
        : 'None yet',
    ],
    [
      'Balance',
      formatSatsAsBtc(balances.totals.confirmed),
      balances.totals.pending
        ? `${balances.totals.pending > 0 ? '+' : ''}${formatSatsAsBtc(balances.totals.pending)} pending`
        : 'Confirmed',
    ],
    [
      'Collection',
      selectedCollection?.name || '—',
      floorPriceSats
        ? `Floor ${formatSatsAsBtc(floorPriceSats)}`
        : 'No floor price',
    ],
  ];

  const stateHint =
    pendingPurchases.length > 0
      ? `${pendingPurchases.length} purchases confirming`
      : readiness.blocker || 'Ready to go';

  return (
    <div className={styles.layout}>
      <RunRibbon
        isTrading={isTrading}
        stateHint={stateHint}
        readings={readings}
      />

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
          <Card title="Collections" padding="none">
            <div className={styles.panelBody}>
              {selectedCollection && (
                <>
                  <CollectionSummary
                    collection={selectedCollection}
                    floorPriceSats={floorPriceSats}
                  />
                  <DoodleDivider className={styles.summaryRule} />
                </>
              )}
              <CollectionPicker
                selected={selectedCollection}
                onSelect={selectCollection}
                variant="table"
              />
            </div>
          </Card>

          <PendingPurchases
            purchases={pendingPurchases}
            wallets={wallets}
            network={network}
          />

          <ActivityLog
            entries={consoleLogs}
            scrollRef={consoleRef}
            busy={isTrading}
            busyLabel="Trading"
            emptyHint="Nothing yet. Start a run and the trader reports every step here."
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

              <button
                type="button"
                className={styles.settingsLink}
                onClick={onOpenRunSettings}
              >
                <SettingsIcon size={15} />
                <span>Run settings</span>
              </button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default AdvancedView;
