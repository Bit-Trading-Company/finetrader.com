/**
 * The connected wallet control in the top bar.
 *
 * Disconnected it is a prompt to connect; connected it opens a menu with the
 * wallet's own details, the Fine Trader wallets derived from it, and the way
 * out.
 *
 * The menu is portaled to the body and positioned against the trigger rather
 * than nested under it. The top bar is frosted, and an element with
 * `backdrop-filter` becomes a backdrop root: anything inside it can only
 * sample what is inside it too, so a menu rendered in the header had nothing
 * to blur and came out flat.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge, Button, CopyField } from '../ui';
import {
  ChevronRightIcon,
  ExternalIcon,
  LogOutIcon,
  WalletIcon,
} from '../ui/icons';
import { shortenAddress } from '../lib/format';
import { getMempoolAddressWebUrl } from '../lib/mempoolProvider';
import { CONNECT_WALLET_LIST } from '../features/wallet/walletOptions';
import styles from './HeaderWalletMenu.module.css';

/**
 * @param {object} props
 * @param {object} props.session from useWalletSession
 * @param {object} props.connection from useWalletConnection
 * @param {() => void} props.onOpenWallets opens the Fine Trader wallets manager
 */
const HeaderWalletMenu = ({ session, connection, onOpenWallets }) => {
  const { address, isWalletConnected, connect, disconnect, network } =
    connection;
  const { wallets, activeWallets } = session;

  const [open, setOpen] = useState(false);
  /** Where to pin the portaled menu, in viewport coordinates. */
  const [anchor, setAnchor] = useState(null);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  const place = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    place();

    // The menu now lives outside the trigger, so a click inside it is not
    // "inside wrapRef" any more and has to be excused explicitly.
    const onPointerDown = (event) => {
      if (
        !wrapRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        close();
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, close, place]);

  const ordinals = address?.ordinals || '';
  const payments = address?.payments || '';

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {isWalletConnected ? (
          <>
            <span className={styles.dot} aria-hidden="true" />
            <code className={styles.address}>{shortenAddress(ordinals)}</code>
          </>
        ) : (
          <>
            <WalletIcon size={16} />
            <span>Connect wallet</span>
          </>
        )}
      </button>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={menuRef}
            className={`ds-root ${styles.menu}`}
            role="menu"
            style={{ top: anchor.top, right: anchor.right }}
          >
            {isWalletConnected ? (
              <>
                <section className={styles.section}>
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionTitle}>
                      Connected wallet
                    </span>
                    <Badge tone="success" dot>
                      {connection.wallet || 'Connected'}
                    </Badge>
                  </div>

                  <CopyField label="Ordinals address" value={ordinals} />
                  {payments && payments !== ordinals && (
                    <CopyField label="Payments address" value={payments} />
                  )}

                  <div className={styles.metaRow}>
                    <span className={styles.meta}>
                      Network <b>{network || 'mainnet'}</b>
                    </span>
                    <a
                      className={styles.link}
                      href={getMempoolAddressWebUrl(ordinals, network)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalIcon size={13} />
                      <span>Explorer</span>
                    </a>
                  </div>
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionHead}>
                    <span className={styles.sectionTitle}>
                      Fine Trader wallets
                    </span>
                  </div>

                  <p className={styles.copy}>
                    {wallets.length === 0
                      ? 'None yet. These are what the auto-trader trades from, so it can sign without asking you each time.'
                      : `${wallets.length} derived, ${activeWallets.length} trading.`}
                  </p>

                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => {
                      close();
                      onOpenWallets();
                    }}
                  >
                    <span>
                      {wallets.length === 0
                        ? 'Generate wallets'
                        : 'Manage wallets'}
                    </span>
                    <ChevronRightIcon size={16} />
                  </button>
                </section>

                {/*
                Leaving is a real action in this menu, not a footnote: a ghost
                button tucked in a corner read as decoration.
              */}
                <section className={styles.footer}>
                  <Button
                    variant="secondary"
                    fullWidth
                    iconLeft={<LogOutIcon size={16} />}
                    onClick={() => {
                      close();
                      disconnect();
                    }}
                  >
                    Disconnect wallet
                  </Button>
                </section>
              </>
            ) : (
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionTitle}>Connect a wallet</span>
                </div>
                <div className={styles.wallets}>
                  {CONNECT_WALLET_LIST.map((item) => (
                    <button
                      key={item.wallet}
                      type="button"
                      className={styles.walletOption}
                      onClick={() => {
                        close();
                        connect(item.wallet);
                      }}
                    >
                      <img
                        src={item.icon}
                        alt=""
                        className={styles.walletIcon}
                      />
                      <span>{item.wallet}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export default HeaderWalletMenu;
