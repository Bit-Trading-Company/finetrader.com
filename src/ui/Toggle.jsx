/**
 * Toggle: a switch between two or three views of the same thing.
 *
 * Use it where the options are one control — Simple / Advanced — rather than
 * separate destinations. `Tabs` is still the right thing for navigating
 * between different content; this is for changing how one thing is shown.
 *
 * <Toggle
 *   options={[{ id: 'simple', label: 'Simple' }, { id: 'advanced', label: 'Advanced' }]}
 *   value={view}
 *   onChange={setView}
 *   ariaLabel="Auto-trader view"
 * />
 */
import React from 'react';
import styles from './Toggle.module.css';

/**
 * @param {object} props
 * @param {{ id: string, label: React.ReactNode, disabled?: boolean }[]} props.options
 * @param {string} props.value
 * @param {(id: string) => void} props.onChange
 * @param {string} props.ariaLabel
 * @param {'sm'|'md'} [props.size]
 */
const Toggle = ({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className = '',
}) => {
  const index = Math.max(
    0,
    options.findIndex((option) => option.id === value)
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={[styles.toggle, size === 'sm' ? styles.sm : '', className]
        .filter(Boolean)
        .join(' ')}
      style={{ '--toggle-count': options.length, '--toggle-index': index }}
    >
      {/*
        One travelling marker rather than a background per option: the movement
        is what tells you the control changed, and it survives the label
        widths differing.
      */}
      <span className={styles.thumb} aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          disabled={option.disabled}
          className={[styles.option, option.id === value ? styles.selected : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default Toggle;
