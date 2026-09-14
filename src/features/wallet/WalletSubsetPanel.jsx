/**
 * Which Fine Trader wallets a screen should act on.
 *
 * The selection lives in the shared `WalletSession`, so choosing a subset here
 * is the same choice the auto-trader trades with and the extractor scans —
 * pick once, and every screen agrees.
 *
 * <WalletSubsetPanel session={session} onManage={openWalletsDialog} />
 */
import React from 'react';
import { Badge, Button, EmptyState } from '../../ui';
import { shortenAddress } from '../../lib/format';
import styles from './WalletSubsetPanel.module.css';

/**
 * @param {object} props
 * @param {object} props.session from useWalletSession
 * @param {() => void} props.onManage opens the wallets manager
 * @param {string} [props.emptyHint] shown when no wallets have been derived
 */
const WalletSubsetPanel = ({ session, onManage, emptyHint }) => {
  const { wallets, activeWallets, isWalletActive, toggleWallet } = session;

  if (wallets.length === 0) {
    return (
      <EmptyState
        title="No Fine Trader wallets yet"
        action={<Button onClick={onManage}>Generate wallets</Button>}
      >
        {emptyHint}
      </EmptyState>
    );
  }

  const allActive = activeWallets.length === wallets.length;

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <span className={styles.count}>
          <Badge tone={activeWallets.length > 0 ? 'success' : 'neutral'}>
            {activeWallets.length} of {wallets.length} selected
          </Badge>
        </span>
        <span className={styles.actions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={allActive ? session.activateNone : session.activateAll}
          >
            {allActive ? 'Select none' : 'Select all'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onManage}>
            Manage wallets
          </Button>
        </span>
      </div>

      <ul className={styles.list}>
        {wallets.map((wallet, index) => {
          const active = isWalletActive(index);
          return (
            <li key={wallet.address}>
              <label
                className={[styles.row, active ? styles.rowActive : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                <input
                  type="checkbox"
                  className={styles.check}
                  checked={active}
                  onChange={() => toggleWallet(index, wallets.length)}
                />
                <span className={styles.index}>{index + 1}</span>
                <code className={styles.address}>
                  {shortenAddress(wallet.address)}
                </code>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default WalletSubsetPanel;
