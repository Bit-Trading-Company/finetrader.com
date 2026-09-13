/**
 * Step 1: connect a browser wallet.
 *
 * Connecting and disconnecting both reload the page (see
 * `useWalletConnection`), so there is no post-connect state to manage here —
 * the app comes back up already connected.
 */
import React from 'react';
import { CONNECT_WALLET_LIST } from '../../../features/wallet/walletOptions';
import { useWalletConnection } from '../../../features/wallet/useWalletConnection';
import { shortenAddress } from '../../../lib/format';
import { Badge, Button } from '../../../ui';
import styles from './ConnectWalletPanel.module.css';

const ConnectWalletPanel = () => {
  const { address, isWalletConnected, connect, disconnect } =
    useWalletConnection();

  if (isWalletConnected) {
    return (
      <div className={styles.connected}>
        <div className={styles.identity}>
          <Badge tone="success" dot>
            Connected
          </Badge>
          <code className={styles.address}>
            {shortenAddress(address?.ordinals || '')}
          </code>
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {CONNECT_WALLET_LIST.map((item) => (
        <button
          key={item.wallet}
          type="button"
          className={styles.wallet}
          onClick={() => connect(item.wallet)}
        >
          <img src={item.icon} alt="" className={styles.icon} />
          <span className={styles.name}>{item.wallet}</span>
        </button>
      ))}
    </div>
  );
};

export default ConnectWalletPanel;
