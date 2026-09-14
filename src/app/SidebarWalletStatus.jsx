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
 * @param {boolean} [props.collapsed] sidebar is the icon rail
 */
const SidebarWalletStatus = ({ session, onOpen, collapsed = false }) => {
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
      {/*
        On the rail the words have nowhere to go, so the icon carries it and
        the button names itself for screen readers and the hover tooltip
        instead of squeezing two lines into 68px.
      */}
      <button
        type="button"
        className={[
          styles.status,
          hasWallets ? styles.ready : styles.prompt,
          collapsed ? styles.railed : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onOpen}
        title={collapsed ? `${headline} — ${detail}` : undefined}
        aria-label={collapsed ? `${headline}. ${detail}` : undefined}
      >
        <span className={styles.icon} aria-hidden="true">
          <WalletIcon size={18} />
        </span>
        {!collapsed && (
          <span className={styles.text}>
            <span className={styles.headline}>{headline}</span>
            <span className={styles.detail}>{detail}</span>
          </span>
        )}
      </button>

      {/*
        On the rail there is no room for it beside the wallet button, and a
        second target crammed against the icon is worse than not offering the
        explanation until the sidebar is open again.
      */}
      {!collapsed && (
        <span className={styles.info}>
          <InfoTip label="What are Fine Trader wallets?">
            {WALLET_EXPLAINER.map((line) => (
              <span key={line} className={styles.tipLine}>
                {line}
              </span>
            ))}
          </InfoTip>
        </span>
      )}
    </div>
  );
};

export default SidebarWalletStatus;
