/**
 * Every proxy wallet, with what it holds and whether it takes part in a run.
 *
 * This is the piece the advanced view exists for: previously the only way to
 * see a wallet's balance was to hover it one at a time. Clicking a row opens
 * the full detail for that wallet.
 *
 * Selection note: `selectActiveWallets` filters by position in the wallets
 * array, so the selection set holds positions, not `wallet.index`. They agree
 * today (wallets are derived in order) but the position is what the engine
 * actually uses, so that is what is stored here.
 */
import React, { useState } from 'react';
import { Badge, Button, Checkbox, Table } from '../../../ui';
import { formatSatsAsBtc, shortenAddress } from '../../../lib/format';
import WalletDetailModal from './WalletDetailModal';
import styles from './ProxyWalletTable.module.css';

/**
 * @param {object} props
 * @param {object[]} props.wallets
 * @param {Record<string, object>} props.balances keyed by address
 * @param {boolean} props.isLoadingBalances
 * @param {object} props.settings from useAutoTradeSettings
 * @param {object} props.session from useWalletSession
 * @param {string} props.network
 * @param {boolean} props.isTrading
 */
const ProxyWalletTable = ({
  wallets,
  balances,
  isLoadingBalances,
  settings,
  session,
  network,
  isTrading,
}) => {
  const {
    useCustomWalletSubset,
    setUseCustomWalletSubset,
    selectedWalletIndices,
    setSelectedWalletIndices,
  } = settings;

  const [detailIndex, setDetailIndex] = useState(null);

  const isActive = (position) =>
    !useCustomWalletSubset || selectedWalletIndices.has(position);

  const toggle = (position) => {
    // Ticking a box is how a user starts choosing a subset; turn the mode on
    // rather than making them find a separate switch first.
    if (!useCustomWalletSubset) {
      setUseCustomWalletSubset(true);
      const all = new Set(wallets.map((_, i) => i));
      all.delete(position);
      setSelectedWalletIndices(all);
      return;
    }
    const next = new Set(selectedWalletIndices);
    if (next.has(position)) next.delete(position);
    else next.add(position);
    setSelectedWalletIndices(next);
  };

  /** Every wallet trades. Leaves subset mode so new wallets are included too. */
  const selectAll = () => {
    setUseCustomWalletSubset(false);
    setSelectedWalletIndices(new Set(wallets.map((_, i) => i)));
  };

  /** No wallet trades — the counterpart to Select all, so both are reachable. */
  const selectNone = () => {
    setUseCustomWalletSubset(true);
    setSelectedWalletIndices(new Set());
  };

  /** Only the wallets holding a balance, which is usually what a run wants. */
  const selectFunded = () => {
    setUseCustomWalletSubset(true);
    setSelectedWalletIndices(
      new Set(
        wallets
          .map((w, i) => (balances[w.address]?.total > 0 ? i : null))
          .filter((i) => i !== null)
      )
    );
  };

  const activeCount = wallets.filter((_, i) => isActive(i)).length;
  const fundedCount = wallets.filter(
    (w) => (balances[w.address]?.total || 0) > 0
  ).length;

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
            checked={isActive(index)}
            disabled={isTrading}
            onChange={() => toggle(index)}
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
          {session.selectedWallet?.index === wallet.index && (
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

  const detailWallet =
    detailIndex === null ? null : wallets[detailIndex] || null;

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
            onClick={selectAll}
            disabled={isTrading || activeCount === wallets.length}
          >
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={selectNone}
            disabled={isTrading || activeCount === 0}
          >
            None
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={selectFunded}
            disabled={isTrading || fundedCount === 0}
          >
            Funded ({fundedCount})
          </Button>
        </span>
      </div>

      <Table
        columns={columns}
        rows={wallets}
        getRowKey={(wallet) => wallet.address}
        onRowClick={(wallet) => setDetailIndex(wallets.indexOf(wallet))}
        isRowSelected={(wallet) => isActive(wallets.indexOf(wallet))}
      />

      {detailWallet && (
        <WalletDetailModal
          wallet={detailWallet}
          balance={balances[detailWallet.address]}
          network={network}
          isActive={isActive(detailIndex)}
          isSelected={session.selectedWallet?.index === detailWallet.index}
          onToggleActive={() => toggle(detailIndex)}
          onSelect={() => session.selectWallet(detailWallet)}
          onClose={() => setDetailIndex(null)}
        />
      )}
    </div>
  );
};

export default ProxyWalletTable;
