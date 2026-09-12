/**
 * Status primitives: Badge, Alert, Spinner, Loading and EmptyState.
 *
 * <Badge tone="success" dot>Confirmed</Badge>
 * <Alert tone="danger" title="Trading stopped">…</Alert>
 * <EmptyState title="No proxy wallets yet" action={<Button/>} />
 */
import React from 'react';
import styles from './Feedback.module.css';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Small status pill.
 * @param {{ tone?: 'neutral'|'accent'|'success'|'danger'|'warning'|'info', dot?: boolean }} props
 */
export const Badge = ({
  tone = 'neutral',
  dot = false,
  className = '',
  children,
  ...rest
}) => (
  <span
    className={joinClasses(styles.badge, styles[tone], className)}
    {...rest}
  >
    {dot && <span className={styles.dot} aria-hidden="true" />}
    {children}
  </span>
);

const ALERT_TONES = {
  success: styles.alertSuccess,
  danger: styles.alertDanger,
  warning: styles.alertWarning,
  info: styles.alertInfo,
};

/**
 * Inline message about the current state of things.
 * @param {{ tone?: 'neutral'|'success'|'danger'|'warning'|'info', title?: React.ReactNode }} props
 */
export const Alert = ({
  tone = 'neutral',
  title,
  className = '',
  children,
  ...rest
}) => (
  <div
    role={tone === 'danger' ? 'alert' : 'status'}
    className={joinClasses(styles.alert, ALERT_TONES[tone], className)}
    {...rest}
  >
    <div>
      {title && <div className={styles.alertTitle}>{title}</div>}
      {children && <div className={styles.alertBody}>{children}</div>}
    </div>
  </div>
);

/** @param {{ size?: 'sm'|'md', label?: string }} props */
export const Spinner = ({ size = 'sm', label = 'Loading', className = '' }) => (
  <span
    role="status"
    aria-label={label}
    className={joinClasses(
      styles.spinner,
      size === 'md' ? styles.spinnerMd : styles.spinnerSm,
      className
    )}
  />
);

/** Centered spinner with a message, for panels that are still loading. */
export const Loading = ({ children = 'Loading…' }) => (
  <div className={styles.loadingRow}>
    <Spinner />
    <span>{children}</span>
  </div>
);

/**
 * Nothing-here state with an optional call to action.
 * @param {{ title: React.ReactNode, art?: React.ReactNode, action?: React.ReactNode }} props
 */
export const EmptyState = ({ title, art, action, children }) => (
  <div className={styles.empty}>
    {art && <div className={styles.emptyArt}>{art}</div>}
    <div className={styles.emptyTitle}>{title}</div>
    {children && <p className={styles.emptyBody}>{children}</p>}
    {action}
  </div>
);
