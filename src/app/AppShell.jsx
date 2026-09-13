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
import { shortenAddress } from '../lib/format';
import { Badge, Button } from '../ui';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  MenuIcon,
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
  const { address, isWalletConnected } = useWalletConnection();
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
      className={['ds-root', styles.shell, collapsed ? styles.collapsed : '']
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
          <span className={styles.brandMark} aria-hidden="true">
            F
          </span>
          <span className={styles.brandText}>Fine Trader</span>
        </Link>

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
            {isWalletConnected ? (
              <Badge tone="success" dot>
                <span className={styles.address}>
                  {shortenAddress(address?.ordinals || '')}
                </span>
              </Badge>
            ) : (
              <Button as={Link} to="/auto-trade" size="sm" variant="secondary">
                Connect wallet
              </Button>
            )}
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
