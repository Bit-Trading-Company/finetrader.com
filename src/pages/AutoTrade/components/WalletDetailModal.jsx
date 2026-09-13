/**
 * Everything known about one proxy wallet.
 *
 * The table can only show a few columns, so this is where the rest lives:
 * all three derived addresses, the public key, the full balance breakdown and
 * the links out to the explorer.
 *
 * The private key is included because these are hot wallets the user may need
 * to import elsewhere to recover funds — but it stays hidden until asked for,
 * and carries the warning it deserves.
 */
import React from 'react';
import {
  Alert,
  Badge,
  Button,
  CopyField,
  Modal,
  StatGrid,
  StatTile,
} from '../../../ui';
import { ExternalIcon } from '../../../ui/icons';
import { formatSatsAsBtc } from '../../../lib/format';
import { getMempoolAddressWebUrl } from '../../../lib/mempoolProvider';
import styles from './WalletDetailModal.module.css';

/**
 * @param {object} props
 * @param {object|null} props.wallet
 * @param {object} [props.balance] from useProxyWalletBalances, keyed by address
 * @param {string} props.network
 * @param {boolean} props.isActive taking part in the next run
 * @param {boolean} props.isSelected the wallet bids and manual actions use
 * @param {() => void} props.onToggleActive
 * @param {() => void} props.onSelect
 * @param {() => void} props.onClose
 */
const WalletDetailModal = ({
  wallet,
  balance,
  network,
  isActive,
  isSelected,
  onToggleActive,
  onSelect,
  onClose,
}) => {
  if (!wallet) return null;

  const addresses = wallet.addresses || {};

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Proxy wallet #${wallet.index + 1}`}
      description="Derived from your signature. Same wallet, same addresses, every time."
      footer={
        <>
          <Button variant="ghost" onClick={onToggleActive}>
            {isActive ? 'Exclude from runs' : 'Include in runs'}
          </Button>
          <Button
            variant={isSelected ? 'secondary' : 'primary'}
            onClick={onSelect}
          >
            {isSelected ? 'Selected for actions' : 'Use for actions'}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.badges}>
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
            <span>View on explorer</span>
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
          Proxy wallets are hot wallets. Keep only what you intend to trade in
          them, and sweep the rest back with the consolidator.
        </Alert>
      </div>
    </Modal>
  );
};

export default WalletDetailModal;
