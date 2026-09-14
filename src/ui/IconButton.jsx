/**
 * IconButton: an action that is clear enough from its glyph alone.
 *
 * The label is required — it names the button for screen readers and shows as
 * the hover tooltip, so the control is never a mystery to either.
 *
 * <IconButton label="Settings" onClick={open}><SettingsIcon /></IconButton>
 */
import React from 'react';
import styles from './IconButton.module.css';

/**
 * @param {object} props
 * @param {string} props.label announced and shown on hover
 * @param {'ghost'|'surface'} [props.variant]
 * @param {'sm'|'md'} [props.size]
 * @param {boolean} [props.active] the thing it opens is currently open
 */
const IconButton = ({
  label,
  variant = 'ghost',
  size = 'md',
  active = false,
  className = '',
  children,
  ...rest
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={active || undefined}
    className={[
      styles.button,
      styles[variant],
      styles[size],
      active ? styles.active : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    {...rest}
  >
    {children}
  </button>
);

export default IconButton;
