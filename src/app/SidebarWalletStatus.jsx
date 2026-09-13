/**
 * Fine Trader wallet status, at the top of the sidebar.
 *
 * The proxy wallets are the thing the whole app runs on, so their state is
 * always visible: how many exist and how many are trading, or a prompt to
 * make some. Clicking opens the manager.
 */
import React from 'react';
import { InfoTip } from '../ui';
import { WalletIcon } from '../ui/icons';
import { WALLET_EXPLAINER } from '../features/wallet/FineTraderWalletsModal';
import styles from './SidebarWalletStatus.module.css';

/**
 * @param {object} props
 * @param {object} props.session from useWalletSession
 * @param {() => void} props.onOpen
 */
const SidebarWalletStatus = ({ session, onOpen }) => {
  const { wallets, activeWallets, isWalletConnected } = session;
  const hasWallets = wallets.length > 0;

  const headline = !hasWallets
    ? 'Generate wallets'
    : `${wallets.length} Fine Trader ${wallets.length === 1 ? 'wallet' : 'wallets'}`;

  const detail = !hasWallets
    ? isWalletConnected
      ? 'Needed to auto-trade'
      : 'Connect a wallet first'
    : `${activeWallets.length} trading`;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={[styles.status, hasWallets ? styles.ready : styles.prompt]
          .filter(Boolean)
          .join(' ')}
        onClick={onOpen}
      >
        <span className={styles.icon} aria-hidden="true">
          <WalletIcon size={18} />
        </span>
        <span className={styles.text}>
          <span className={styles.headline}>{headline}</span>
          <span className={styles.detail}>{detail}</span>
        </span>
      </button>

      <span className={styles.info}>
        <InfoTip label="What are Fine Trader wallets?">
          {WALLET_EXPLAINER.map((line) => (
            <span key={line} className={styles.tipLine}>
              {line}
            </span>
          ))}
        </InfoTip>
      </span>
    </div>
  );
};

export default SidebarWalletStatus;
