/**
 * Button: the one clickable control for the redesigned UI.
 *
 * <Button onClick={...}>Start trading</Button>
 * <Button variant="secondary" size="sm" iconLeft={<PlusIcon />}>Add</Button>
 * <Button as="a" href="/docs">Read the docs</Button>
 */
import React from 'react';
import styles from './Button.module.css';

/**
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'} [props.variant]
 * @param {'sm'|'md'|'lg'} [props.size]
 * @param {boolean} [props.loading] shows a spinner and blocks clicks
 * @param {boolean} [props.fullWidth]
 * @param {React.ReactNode} [props.iconLeft]
 * @param {React.ReactNode} [props.iconRight]
 * @param {'button'|'a'} [props.as] render an anchor that looks like a button
 */
const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  iconLeft,
  iconRight,
  as = 'button',
  className = '',
  disabled,
  children,
  ...rest
}) => {
  const Tag = as;
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      className={classes}
      disabled={Tag === 'button' ? disabled || loading : undefined}
      aria-disabled={Tag === 'a' && (disabled || loading) ? true : undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        iconLeft && (
          <span className={styles.icon} aria-hidden="true">
            {iconLeft}
          </span>
        )
      )}
      {children}
      {iconRight && !loading && (
        <span className={styles.icon} aria-hidden="true">
          {iconRight}
        </span>
      )}
    </Tag>
  );
};

export default Button;
