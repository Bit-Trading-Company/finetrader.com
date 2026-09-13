/**
 * Every proxy wallet, with what it holds and whether it takes part in a run.
 *
 * This is the piece the advanced view exists for: previously the only way to
 * see a wallet's balance was to hover it one at a time.
 *
 * Selection note: `selectActiveWallets` filters by position in the wallets
 * array, so the selection set holds positions, not `wallet.index`. They agree
 * today (wallets are derived in order) but the position is what the engine
 * actually uses, so that is what is stored here.
 */
import React from 'react';
import { Badge, Button, Checkbox, Table } from '../../../ui';
import { ExternalIcon } from '../../../ui/icons';
import { formatSatsAsBtc, shortenAddress } from '../../../lib/format';
import { getMempoolAddressWebUrl } from '../../../lib/mempoolProvider';
import styles from './ProxyWalletTable.module.css';

/**
 * @param {object} props
 * @param {object[]} props.wallets
 * @param {Record<string, object>} props.balances keyed by address
 * @param {boolean} props.isLoadingBalances
 * @param {object} props.settings from useAutoTradeSettings
 * @param {string} props.network
 * @param {boolean} props.isTrading
 */
const ProxyWalletTable = ({
  wallets,
  balances,
  isLoadingBalances,
  settings,
  network,
  isTrading,
}) => {
  const {
    useCustomWalletSubset,
    setUseCustomWalletSubset,
    selectedWalletIndices,
    setSelectedWalletIndices,
  } = settings;

  const isSelected = (position) =>
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

  const selectAll = () => {
    setUseCustomWalletSubset(false);
    setSelectedWalletIndices(new Set(wallets.map((_, i) => i)));
  };

  const activeCount = wallets.filter((_, i) => isSelected(i)).length;

  const columns = [
    {
      key: 'use',
      header: 'Use',
      width: '64px',
      render: (wallet, index) => (
        <Checkbox
          checked={isSelected(index)}
          disabled={isTrading}
          onChange={() => toggle(index)}
          label=""
          aria-label={`Trade from wallet ${wallet.index + 1}`}
        />
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
      key: 'link',
      header: '',
      width: '48px',
      align: 'right',
      render: (wallet) => (
        <a
          className={styles.link}
          href={getMempoolAddressWebUrl(wallet.address, network)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open wallet ${wallet.index + 1} in the block explorer`}
        >
          <ExternalIcon size={16} />
        </a>
      ),
    },
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <span className={styles.summary}>
          {useCustomWalletSubset ? (
            <Badge tone="warning">
              {activeCount} of {wallets.length} trading
            </Badge>
          ) : (
            <Badge tone="neutral">All {wallets.length} trading</Badge>
          )}
          {isLoadingBalances && (
            <span className={styles.loading}>Refreshing balances…</span>
          )}
        </span>

        {useCustomWalletSubset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            disabled={isTrading}
          >
            Use all wallets
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        rows={wallets}
        getRowKey={(wallet) => wallet.address}
        isRowSelected={(wallet) => isSelected(wallets.indexOf(wallet))}
      />
    </div>
  );
};

export default ProxyWalletTable;
