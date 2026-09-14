/**
 * Tabs: switches a view in place (Simple/Advanced, wallet tools, …).
 *
 * <Tabs
 *   items={[{ id: 'simple', label: 'Simple' }, { id: 'advanced', label: 'Advanced' }]}
 *   value={mode}
 *   onChange={setMode}
 * />
 */
import React from 'react';
import styles from './Tabs.module.css';

/**
 * @param {object} props
 * @param {{ id: string, label: React.ReactNode, badge?: React.ReactNode, disabled?: boolean }[]} props.items
 * @param {string} props.value selected tab id
 * @param {(id: string) => void} props.onChange
 * @param {'underline'|'pills'} [props.variant]
 * @param {string} [props.ariaLabel]
 */
const Tabs = ({
  items,
  value,
  onChange,
  variant = 'underline',
  ariaLabel = 'Views',
  className = '',
}) => (
  <div
    role="tablist"
    aria-label={ariaLabel}
    className={[
      styles.tablist,
      variant === 'pills' ? styles.pills : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {items.map((item) => {
      const selected = item.id === value;
      return (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={selected}
          disabled={item.disabled}
          className={[styles.tab, selected ? styles.selected : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.badge}
        </button>
      );
    })}
  </div>
);

export default Tabs;
