/**
 * Page scaffolding: the bits every screen repeats.
 *
 * <PageHeader title="Auto-Trade" description="…" actions={<Button/>} />
 * <Section title="Proxy wallets">…</Section>
 * <StatGrid><StatTile label="Balance" value="0.42 BTC" /></StatGrid>
 */
import React from 'react';
import { ScribbleUnderline } from './Scribble';
import styles from './Layout.module.css';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Title block at the top of a page. The scribble underline is the app's
 * signature; it draws itself once per mount.
 */
export const PageHeader = ({ title, description, actions, className = '' }) => (
  <header className={joinClasses(styles.pageHeader, className)}>
    <div className={styles.pageHeadings}>
      <h1 className={styles.pageTitle}>{title}</h1>
      <ScribbleUnderline animate className={styles.pageUnderline} />
      {description && <p className={styles.pageDescription}>{description}</p>}
    </div>
    {actions && <div className={styles.pageActions}>{actions}</div>}
  </header>
);

/** A labelled block within a page. */
export const Section = ({
  title,
  description,
  actions,
  className = '',
  children,
}) => (
  <section className={joinClasses(styles.section, className)}>
    {(title || actions) && (
      <div className={styles.sectionHeader}>
        <div>
          {title && <h2 className={styles.sectionTitle}>{title}</h2>}
          {description && (
            <p className={styles.sectionDescription}>{description}</p>
          )}
        </div>
        {actions}
      </div>
    )}
    {children}
  </section>
);

/** Row of controls above a list or table: filters left, actions right. */
export const Toolbar = ({ left, right, className = '' }) => (
  <div className={joinClasses(styles.toolbar, className)}>
    <div className={styles.toolbarGroup}>{left}</div>
    <div className={styles.toolbarGroup}>{right}</div>
  </div>
);

/** Responsive grid of StatTiles. */
export const StatGrid = ({ className = '', children }) => (
  <div className={joinClasses(styles.statGrid, className)}>{children}</div>
);

/**
 * One headline figure.
 * @param {{ label: React.ReactNode, value: React.ReactNode, hint?: React.ReactNode,
 *   tone?: 'default'|'accent'|'success'|'danger' }} props
 */
export const StatTile = ({ label, value, hint, tone = 'default' }) => (
  <div
    className={joinClasses(
      styles.stat,
      tone === 'accent' && styles.statAccent,
      tone === 'success' && styles.statSuccess,
      tone === 'danger' && styles.statDanger
    )}
  >
    <span className={styles.statLabel}>{label}</span>
    <span className={styles.statValue}>{value}</span>
    {hint && <span className={styles.statHint}>{hint}</span>}
  </div>
);
