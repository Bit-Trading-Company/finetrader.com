/**
 * Purchases that have been broadcast but are still waiting for a
 * confirmation.
 *
 * The engine tracks these so a wallet does not try to relist an item it does
 * not own yet, but nothing ever showed them — a run could look idle while
 * several thousand sats were in flight.
 */
import React from 'react';
import { Badge, Table } from '../../../ui';
import { ExternalIcon } from '../../../ui/icons';
import {
  formatSatsAsBtc,
  shortenAddress,
  truncateMiddle,
} from '../../../lib/format';
import { getMempoolTxUrl } from '../../../lib/mempoolProvider';
import styles from './PendingPurchases.module.css';

/** "4m ago" — these are minutes old, so a relative time reads best. */
const sinceLabel = (timestamp) => {
  if (!timestamp) return '—';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
};

/**
 * @param {object} props
 * @param {object[]} props.purchases
 * @param {object[]} props.wallets used to name the buyer by its number
 * @param {string} props.network
 */
const PendingPurchases = ({ purchases, wallets, network }) => {
  if (!purchases.length) return null;

  const walletNumber = (address) => {
    const wallet = wallets.find((w) => w.address === address);
    return wallet ? `#${wallet.index + 1}` : shortenAddress(address);
  };

  const columns = [
    {
      key: 'token',
      header: 'Item',
      render: (p) => (
        <code className={styles.mono}>{truncateMiddle(p.tokenId)}</code>
      ),
    },
    {
      key: 'buyer',
      header: 'Bought by',
      render: (p) => walletNumber(p.buyerWalletAddress),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      numeric: true,
      render: (p) => (p.price ? formatSatsAsBtc(p.price) : '—'),
    },
    {
      key: 'age',
      header: 'Broadcast',
      align: 'right',
      render: (p) => sinceLabel(p.timestamp),
    },
    {
      key: 'tx',
      header: '',
      width: '48px',
      align: 'right',
      render: (p) =>
        p.txid ? (
          <a
            className={styles.link}
            href={getMempoolTxUrl(p.txid, network)}
            target="_blank"
            rel="noreferrer"
            aria-label="Open transaction in the block explorer"
          >
            <ExternalIcon size={16} />
          </a>
        ) : null,
    },
  ];

  return (
    <div className={`ds-panel ${styles.panel}`}>
      <div className={styles.head}>
        <span className={styles.title}>Confirming</span>
        <Badge tone="warning">{purchases.length} in flight</Badge>
      </div>
      <Table
        columns={columns}
        rows={purchases}
        getRowKey={(p) => `${p.txid}|${p.tokenId}`}
      />
    </div>
  );
};

export default PendingPurchases;
