/**
 * App shell for the redesigned UI: persistent sidebar, sticky top bar with
 * wallet status, and the routed page in the content column.
 *
 * On screens under 900px the sidebar becomes a drawer opened from the top bar.
 * On wider screens it can collapse to an icon rail; that choice is remembered.
 *
 * Pages render inside `.ds-root`, which opts out of the legacy global
 * typography (see docs/ARCHITECTURE.md).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { NAV_GROUPS, findNavItem } from './navigation';
import { useWalletConnection } from '../features/wallet/useWalletConnection';
import { useWalletSession } from '../features/wallet/WalletSession';
import { DIALOG, useDialogs } from './DialogContext';
import FineTraderWalletsModal from '../features/wallet/FineTraderWalletsModal';
import Dispatch from '../features/wallet/Dispatch';
import { useDisplayPreferences } from './DisplayPreferences';
import SettingsDialog from './SettingsDialog';
import HeaderWalletMenu from './HeaderWalletMenu';
import SidebarWalletStatus from './SidebarWalletStatus';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  LogOutIcon,
  MenuIcon,
  PlugIcon,
  SettingsIcon,
} from '../ui/icons';
import styles from './AppShell.module.css';

const COLLAPSED_KEY = 'fine-trading-sidebar-collapsed';

const readCollapsed = () => {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

const AppShell = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const connection = useWalletConnection();
  const session = useWalletSession();
  const { isDialogOpen, openDialog, closeDialog } = useDialogs();
  const { prefs } = useDisplayPreferences();
  const current = findNavItem(location.pathname);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* a remembered preference is optional */
      }
      return next;
    });
  }, []);

  return (
    <div
      /*
       * Display preferences are applied here as classes and token overrides
       * rather than read by each component, so a panel never has to know
       * whether glass is on to draw itself.
       */
      style={prefs.pageArt ? undefined : { '--ds-page-art-opacity': 0 }}
      className={[
        'ds-root',
        styles.shell,
        collapsed ? styles.collapsed : '',
        prefs.glass ? '' : styles.flat,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <aside
        className={[styles.sidebar, drawerOpen ? styles.sidebarOpen : '']
          .filter(Boolean)
          .join(' ')}
        aria-label="Main navigation"
      >
        <Link to="/auto-trade" className={styles.brand}>
          <span className={styles.brandText}>Fine Trader</span>
        </Link>

        <SidebarWalletStatus
          session={session}
          onOpen={() => openDialog(DIALOG.wallets)}
          collapsed={collapsed}
        />

        <nav className={styles.nav}>
          {NAV_GROUPS.map((group) => (
            <div key={group.id}>
              <div className={styles.groupTitle}>{group.title}</div>
              <div className={styles.groupItems}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={item.label}
                      className={({ isActive }) =>
                        [styles.link, isActive ? styles.linkActive : '']
                          .filter(Boolean)
                          .join(' ')
                      }
                    >
                      <span className={styles.linkIcon}>
                        <Icon />
                      </span>
                      <span className={styles.linkLabel}>{item.label}</span>
                      {/*
                        Pages not yet rebuilt look nothing like the shell
                        around them; saying so up front is less jarring than
                        the jump.
                      */}
                      {item.legacy && (
                        <span
                          className={styles.linkTag}
                          title="Not redesigned yet"
                        >
                          old
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/*
          Not destinations, so they sit below the navigation rather than in
          it — but they are the two things reached from every screen, so they
          are one click away wherever you are.
        */}
        <div className={styles.sidebarActions}>
          <div className={styles.groupTitle}>Account</div>
          <button
            type="button"
            className={styles.link}
            onClick={() => openDialog(DIALOG.settings)}
            title="Settings"
          >
            <span className={styles.linkIcon}>
              <SettingsIcon />
            </span>
            <span className={styles.linkLabel}>Settings</span>
          </button>

          {connection.isWalletConnected ? (
            <button
              type="button"
              className={styles.link}
              onClick={connection.disconnect}
              title="Disconnect wallet"
            >
              <span className={styles.linkIcon}>
                <LogOutIcon />
              </span>
              <span className={styles.linkLabel}>Disconnect</span>
            </button>
          ) : (
            <button
              type="button"
              className={styles.link}
              onClick={() => openDialog(DIALOG.wallets)}
              title="Connect wallet"
            >
              <span className={styles.linkIcon}>
                <PlugIcon />
              </span>
              <span className={styles.linkLabel}>Connect wallet</span>
            </button>
          )}
        </div>

        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={styles.collapseButton}
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>
      </aside>

      {drawerOpen && (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setDrawerOpen((open) => !open)}
              aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={drawerOpen}
            >
              {drawerOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
            <span className={styles.pageName}>
              {current?.label ?? 'Fine Trader'}
            </span>
            {current?.description && (
              <span className={styles.pageHint}>· {current.description}</span>
            )}
          </div>

          <div className={styles.topbarRight}>
            <HeaderWalletMenu
              session={session}
              connection={connection}
              onOpenWallets={() => openDialog(DIALOG.wallets)}
            />
          </div>
        </header>

        {/*
          The drawn frame holds the content area rather than travelling with
          what is inside it: it is fixed over the column, never a scroll
          target, and passes clicks straight through.
        */}
        {prefs.frame && (
          <div
            className={`ds-frame ${styles.frameOverlay}`}
            aria-hidden="true"
          />
        )}

        <main
          className={[styles.content, prefs.frame ? styles.framed : '']
            .filter(Boolean)
            .join(' ')}
        >
          <Outlet />
        </main>
      </div>

      {/*
        Mounted once here so every page manages and funds the same wallets,
        and so the manager can open the funding dialog without owning it.
      */}
      <FineTraderWalletsModal
        open={isDialogOpen(DIALOG.wallets)}
        onClose={closeDialog}
      />
      <Dispatch
        isOpen={isDialogOpen(DIALOG.funding)}
        onClose={closeDialog}
        proxyWallets={session.wallets}
      />
      <SettingsDialog />
    </div>
  );
};

export default AppShell;
