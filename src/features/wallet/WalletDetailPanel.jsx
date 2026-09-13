/**
 * Everything known about one Fine Trader wallet.
 *
 * A panel rather than a dialog of its own, so it can be shown inside the
 * wallet manager without stacking one modal on top of another.
 *
 * The private key is here because these are hot wallets the user may need to
 * import elsewhere to recover funds — but it stays hidden until asked for,
 * and carries the warning it deserves.
 */
import React from 'react';
import { Alert, Badge, Button, CopyField, StatGrid, StatTile } from '../../ui';
import { ChevronLeftIcon, ExternalIcon } from '../../ui/icons';
import { formatSatsAsBtc } from '../../lib/format';
import { getMempoolAddressWebUrl } from '../../lib/mempoolProvider';
import styles from './WalletDetailPanel.module.css';

/**
 * @param {object} props
 * @param {object} props.wallet
 * @param {object} [props.balance] from useProxyWalletBalances
 * @param {string} props.network
 * @param {boolean} props.isActive takes part in the next run
 * @param {boolean} props.isSelected the wallet manual actions use
 * @param {() => void} props.onToggleActive
 * @param {() => void} props.onSelect
 * @param {() => void} props.onBack
 */
const WalletDetailPanel = ({
  wallet,
  balance,
  network,
  isActive,
  isSelected,
  onToggleActive,
  onSelect,
  onBack,
}) => {
  const addresses = wallet.addresses || {};

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<ChevronLeftIcon size={16} />}
          onClick={onBack}
        >
          All wallets
        </Button>
        <span className={styles.title}>Wallet #{wallet.index + 1}</span>
        <Badge tone={isActive ? 'success' : 'neutral'}>
          {isActive ? 'Trading' : 'Excluded'}
        </Badge>
        {isSelected && <Badge tone="info">Selected for actions</Badge>}
        <a
          className={styles.explorer}
          href={getMempoolAddressWebUrl(wallet.address, network)}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalIcon size={14} />
          <span>Explorer</span>
        </a>
      </div>

      <StatGrid>
        <StatTile
          label="Confirmed"
          value={balance ? formatSatsAsBtc(balance.confirmed) : '—'}
          hint="BTC"
        />
        <StatTile
          label="Pending"
          value={
            balance && balance.pending
              ? `${balance.pending > 0 ? '+' : ''}${formatSatsAsBtc(balance.pending)}`
              : '—'
          }
          hint="Unconfirmed"
          tone={balance && balance.pending ? 'warning' : 'default'}
        />
        <StatTile
          label="UTXOs"
          value={balance ? balance.utxoCount : '—'}
          hint="Unspent outputs"
        />
        <StatTile
          label="Transactions"
          value={balance ? balance.txCount : '—'}
          hint="Confirmed"
        />
      </StatGrid>

      <section className={styles.section}>
        <h3 className={styles.heading}>Addresses</h3>
        <CopyField
          label="Taproot (p2tr) — used for trading"
          value={addresses.p2tr || wallet.address}
        />
        {addresses.p2wpkh && (
          <CopyField label="Segwit (p2wpkh)" value={addresses.p2wpkh} />
        )}
        {addresses.p2pkh && (
          <CopyField label="Legacy (p2pkh)" value={addresses.p2pkh} />
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>Keys</h3>
        <CopyField label="Public key" value={wallet.publicKey} />
        <CopyField
          label="Private key"
          value={wallet.privateKey}
          secret
          hint="Anyone with this key can spend this wallet's funds. Only reveal it to import the wallet somewhere you trust."
        />
      </section>

      <Alert tone="warning">
        Fine Trader wallets are hot wallets. Keep only what you intend to trade
        in them, and sweep the rest back with the consolidator.
      </Alert>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onToggleActive}>
          {isActive ? 'Exclude from runs' : 'Include in runs'}
        </Button>
        <Button
          variant={isSelected ? 'secondary' : 'primary'}
          onClick={onSelect}
        >
          {isSelected ? 'Selected for actions' : 'Use for actions'}
        </Button>
      </div>
    </div>
  );
};

export default WalletDetailPanel;
