/**
 * Market: browse collections, buy and sell by hand.
 *
 * The page frame is the redesigned shell — header, navigation, wallet menu and
 * artwork all come from it, so the duplicate header and wallet dropdown this
 * page used to carry are gone, along with its own copy of the wallet manager.
 *
 * The marketplace views inside `FineBuyer` are still pre-redesign components.
 * They learn about wallets through an event hub rather than the session, so
 * the session is mirrored onto one for them — which is what makes the wallets
 * derived on any other page the wallets this page trades with.
 */
import React from 'react';
import { Page, PageHeader } from '../../ui';
import FineBuyer from '../../features/marketplace/FineBuyer';
import { useEventHub } from '../../lib/eventHub';
import { useWalletSessionBridge } from '../../features/wallet/WalletSession';
import styles from './Dashboard.module.css';

const Market = () => {
  const glEventHub = useEventHub();
  useWalletSessionBridge(glEventHub);

  return (
    <Page variant="market">
      <PageHeader
        title="Market"
        description="Browse collections, buy and sell by hand."
      />

      <div className={`ds-panel ${styles.panel}`}>
        <FineBuyer glEventHub={glEventHub} />
      </div>
    </Page>
  );
};

export default Market;
