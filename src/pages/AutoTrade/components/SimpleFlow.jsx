/**
 * The five-step path: connect, create wallets, fund them, pick a collection,
 * trade.
 *
 * Steps open one at a time, and the open one follows the first thing still
 * outstanding — but any step can be reopened, because coming back to add
 * funds or change collection is normal rather than exceptional.
 */
import React, { useState } from 'react';
import { Badge, Button, Card } from '../../../ui';
import { formatSatsAsBtc } from '../../../lib/format';
import ConnectWalletPanel from './ConnectWalletPanel';
import CreateWalletsPanel from './CreateWalletsPanel';
import CollectionPicker from './CollectionPicker';
import RunControls from './RunControls';
import RunConsole from './RunConsole';
import styles from './SimpleFlow.module.css';

const Step = ({ number, title, summary, done, open, onToggle, children }) => (
  <li className={[styles.step, open ? styles.open : ''].join(' ')}>
    <button
      type="button"
      className={styles.head}
      onClick={onToggle}
      aria-expanded={open}
    >
      <span
        className={[styles.marker, done ? styles.markerDone : '']
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      >
        {done ? '✓' : number}
      </span>
      <span className={styles.heading}>
        <span className={styles.title}>{title}</span>
        {summary && <span className={styles.summary}>{summary}</span>}
      </span>
    </button>

    {open && <div className={styles.body}>{children}</div>}
  </li>
);

const SimpleFlow = ({ workspace, onOpenDispatch, onOpenBids, startButton }) => {
  const {
    session,
    wallets,
    balances,
    selectedCollection,
    selectCollection,
    settings,
    isTrading,
    consoleLogs,
    consoleRef,
    floorPriceSats,
    applyFloorPrice,
    readiness,
  } = workspace;

  // The first unfinished step, which is where attention should start.
  const firstOpen = !readiness.connected
    ? 1
    : !readiness.hasWallets
      ? 2
      : !readiness.funded
        ? 3
        : !readiness.hasCollection
          ? 4
          : 5;

  const [openStep, setOpenStep] = useState(null);
  const current = openStep ?? firstOpen;
  const toggle = (n) => setOpenStep(current === n ? null : n);

  return (
    <ol className={styles.steps}>
      <Step
        number={1}
        title="Connect your wallet"
        done={readiness.connected}
        summary={readiness.connected ? 'Connected' : undefined}
        open={current === 1}
        onToggle={() => toggle(1)}
      >
        <ConnectWalletPanel />
      </Step>

      <Step
        number={2}
        title="Create proxy wallets"
        done={readiness.hasWallets}
        summary={wallets.length > 0 ? `${wallets.length} wallets` : undefined}
        open={current === 2}
        onToggle={() => toggle(2)}
      >
        <CreateWalletsPanel session={session} />
      </Step>

      <Step
        number={3}
        title="Fund them"
        done={readiness.funded}
        summary={
          balances.totals.confirmed > 0
            ? formatSatsAsBtc(balances.totals.confirmed)
            : undefined
        }
        open={current === 3}
        onToggle={() => toggle(3)}
      >
        <div className={styles.fund}>
          <p className={styles.copy}>
            Send BTC from your connected wallet out to the proxy wallets. They
            trade with what you send them, and nothing else.
          </p>
          <div className={styles.fundRow}>
            <Button onClick={onOpenDispatch} disabled={wallets.length === 0}>
              Fund wallets
            </Button>
            {wallets.length > 0 && (
              <span className={styles.fundStats}>
                <Badge tone={readiness.funded ? 'success' : 'neutral'}>
                  {balances.totals.funded} of {wallets.length} funded
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={balances.refresh}
                  loading={balances.isLoading}
                >
                  Refresh
                </Button>
              </span>
            )}
          </div>
        </div>
      </Step>

      <Step
        number={4}
        title="Choose a collection"
        done={readiness.hasCollection}
        summary={selectedCollection?.name}
        open={current === 4}
        onToggle={() => toggle(4)}
      >
        <CollectionPicker
          selected={selectedCollection}
          onSelect={selectCollection}
        />
      </Step>

      <Step
        number={5}
        title="Trade"
        done={isTrading}
        summary={isTrading ? 'Running' : undefined}
        open={current === 5}
        onToggle={() => toggle(5)}
      >
        <div className={styles.run}>
          <Card tone="quiet" padding="md">
            <RunControls
              settings={settings}
              isTrading={isTrading}
              floorPriceSats={floorPriceSats}
              applyFloorPrice={applyFloorPrice}
              onOpenBids={onOpenBids}
            />
          </Card>

          <div className={styles.runSide}>
            {startButton}
            <RunConsole
              logs={consoleLogs}
              consoleRef={consoleRef}
              isTrading={isTrading}
            />
          </div>
        </div>
      </Step>
    </ol>
  );
};

export default SimpleFlow;
