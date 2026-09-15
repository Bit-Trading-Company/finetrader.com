/**
 * Which Fine Trader wallet this page is reporting on.
 *
 * Analytics reads one wallet at a time — its transactions, its balance
 * history, what it holds and what it paid. Until now the choice was made in
 * the wallets manager and the page just followed along, which meant arriving
 * here with nothing selected left you looking at four empty panels with no
 * way forward. This is that way forward.
 *
 * It is deliberately the whole page rather than a dropdown above the charts:
 * picking is the only thing to do when nothing is picked, and the balances
 * make it a real decision rather than a list of look-alike addresses.
 */
import React from 'react';
import { Alert, Badge, Button, EmptyState } from '../../ui';
import { WalletIcon } from '../../ui/icons';
import { formatSatsAsBtc, shortenAddress } from '../../lib/format';
import ConnectWalletPanel from '../../features/wallet/ConnectWalletPanel';
import { WALLET_EXPLAINER } from '../../features/wallet/FineTraderWalletsModal';
import styles from './AnalyticsWalletPicker.module.css';

/**
 * @param {object} props
 * @param {object} props.session from useWalletSession
 * @param {object} props.balances from useProxyWalletBalances
 * @param {(wallet: object) => void} props.onSelect
 * @param {() => void} props.onManage opens the wallets manager
 */
const AnalyticsWalletPicker = ({ session, balances, onSelect, onManage }) => {
  const { wallets, isWalletConnected } = session;

  if (!isWalletConnected) {
    return (
      <div className={styles.picker}>
        <EmptyState title="Connect a wallet to see its analytics">
          Fine Trader wallets are derived from a signature by your own wallet,
          so there is nothing to report on until one is connected.
        </EmptyState>
        <ConnectWalletPanel />
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className={styles.picker}>
        <EmptyState
          title="No Fine Trader wallets yet"
          action={<Button onClick={onManage}>Generate wallets</Button>}
        >
          Derive them once and every page in the app uses the same set.
        </EmptyState>
        <div className={styles.explainer}>
          {WALLET_EXPLAINER.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.picker}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Choose a wallet</h2>
          <p className={styles.subtitle}>
            Analytics reports on one wallet at a time.
          </p>
        </div>
        <div className={styles.headActions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={balances.refresh}
            loading={balances.isLoading}
          >
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={onManage}>
            Manage wallets
          </Button>
        </div>
      </div>

      {balances.error && <Alert tone="warning">{balances.error}</Alert>}

      <ul className={styles.list}>
        {wallets.map((wallet) => {
          const balance = balances.balances[wallet.address];
          const funded = (balance?.total || 0) > 0;
          return (
            <li key={wallet.address}>
              <button
                type="button"
                className={styles.card}
                onClick={() => onSelect(wallet)}
              >
                <span className={styles.cardHead}>
                  <span className={styles.number}>
                    <WalletIcon size={14} aria-hidden="true" />
                    {wallet.index + 1}
                  </span>
                  {funded ? (
                    <Badge tone="success">Funded</Badge>
                  ) : (
                    <Badge tone="neutral">Empty</Badge>
                  )}
                </span>

                <code className={styles.address}>
                  {shortenAddress(wallet.address)}
                </code>

                <span className={styles.figures}>
                  <span className={styles.balance}>
                    {balance
                      ? formatSatsAsBtc(balance.confirmed)
                      : balances.isLoading
                        ? '…'
                        : '—'}
                  </span>
                  <span className={styles.meta}>
                    {balance ? `${balance.txCount} tx` : ''}
                  </span>
                </span>

                {/* Its own line: alongside the balance it wraps and reads as
                    one number split in two. */}
                {balance?.pending ? (
                  <span className={styles.pending}>
                    {formatSatsAsBtc(balance.pending)} pending
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default AnalyticsWalletPicker;
