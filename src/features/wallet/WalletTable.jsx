/**
 * Every Fine Trader wallet, with what it holds and whether it trades.
 *
 * Selection lives in the wallet session, so a choice made here holds on every
 * page. Positions are what the trading engine filters by, so that is what the
 * checkboxes toggle.
 */
import React from 'react';
import { Badge, Button, Checkbox, Table } from '../../ui';
import { formatSatsAsBtc, shortenAddress } from '../../lib/format';
import styles from './WalletTable.module.css';

/**
 * @param {object} props
 * @param {object} props.session from useWalletSession
 * @param {Record<string, object>} props.balances keyed by address
 * @param {boolean} props.isLoadingBalances
 * @param {(wallet: object) => void} props.onOpenWallet
 * @param {boolean} [props.disabled] while a run is in progress
 */
const WalletTable = ({
  session,
  balances,
  isLoadingBalances,
  onOpenWallet,
  disabled = false,
}) => {
  const {
    wallets,
    isWalletActive,
    toggleWallet,
    activateAll,
    activateNone,
    setActiveWalletIndices,
    selectedWallet,
  } = session;

  const activeCount = wallets.filter((_, i) => isWalletActive(i)).length;
  const fundedCount = wallets.filter(
    (w) => (balances[w.address]?.total || 0) > 0
  ).length;

  /** Only the wallets holding a balance, which is usually what a run wants. */
  const activateFunded = () =>
    setActiveWalletIndices(
      wallets
        .map((w, i) => (balances[w.address]?.total > 0 ? i : null))
        .filter((i) => i !== null)
    );

  const columns = [
    {
      key: 'use',
      header: 'Trade',
      width: '64px',
      render: (wallet, index) => (
        <span
          // The row opens the detail; the checkbox must not.
          onClick={(event) => event.stopPropagation()}
          role="presentation"
        >
          <Checkbox
            checked={isWalletActive(index)}
            disabled={disabled}
            onChange={() => toggleWallet(index, wallets.length)}
            label=""
            aria-label={`Trade from wallet ${wallet.index + 1}`}
          />
        </span>
      ),
    },
    {
      key: 'wallet',
      header: 'Wallet',
      render: (wallet) => (
        <span className={styles.walletCell}>
          <b>#{wallet.index + 1}</b>
          <code className={styles.address}>
            {shortenAddress(wallet.address)}
          </code>
          {selectedWallet?.index === wallet.index && (
            <Badge tone="info">actions</Badge>
          )}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      numeric: true,
      render: (wallet) => {
        const balance = balances[wallet.address];
        if (!balance) return <span className={styles.unknown}>—</span>;
        return (
          <span className={balance.total > 0 ? styles.funded : styles.unknown}>
            {formatSatsAsBtc(balance.total)}
          </span>
        );
      },
    },
    {
      key: 'pending',
      header: 'Pending',
      align: 'right',
      numeric: true,
      render: (wallet) => {
        const balance = balances[wallet.address];
        if (!balance || !balance.pending) return '—';
        return (
          <span className={styles.pending}>
            {balance.pending > 0 ? '+' : ''}
            {formatSatsAsBtc(balance.pending)}
          </span>
        );
      },
    },
    {
      key: 'utxos',
      header: 'UTXOs',
      align: 'right',
      numeric: true,
      render: (wallet) => balances[wallet.address]?.utxoCount ?? '—',
    },
    {
      key: 'txs',
      header: 'Txs',
      align: 'right',
      numeric: true,
      render: (wallet) => balances[wallet.address]?.txCount ?? '—',
    },
    {
      key: 'details',
      header: '',
      width: '80px',
      align: 'right',
      render: () => <span className={styles.detailsHint}>Details →</span>,
    },
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <span className={styles.summary}>
          <Badge tone={activeCount === 0 ? 'warning' : 'neutral'}>
            {activeCount} of {wallets.length} trading
          </Badge>
          {isLoadingBalances && (
            <span className={styles.loading}>Refreshing balances…</span>
          )}
        </span>

        <span className={styles.selectors}>
          <span className={styles.selectorLabel}>Select</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={activateAll}
            disabled={disabled || activeCount === wallets.length}
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={activateNone}
            disabled={disabled || activeCount === 0}
          >
            None
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={activateFunded}
            disabled={disabled || fundedCount === 0}
          >
            Funded ({fundedCount})
          </Button>
        </span>
      </div>

      <Table
        columns={columns}
        rows={wallets}
        getRowKey={(wallet) => wallet.address}
        onRowClick={onOpenWallet}
        isRowSelected={(wallet) => isWalletActive(wallets.indexOf(wallet))}
      />
    </div>
  );
};

export default WalletTable;
