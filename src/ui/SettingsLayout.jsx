/**
 * Two-pane settings: categories down the left, the chosen one on the right.
 *
 * Built for dialogs that hold more than one kind of setting, so a reader looks
 * for "how it looks" or "how it runs" instead of scrolling one long form.
 * Below 720px the categories become a horizontal strip above the pane.
 *
 * <SettingsLayout sections={[
 *   { id: 'run', label: 'Run', icon: <BoltIcon />, render: () => <RunFields /> },
 * ]} />
 */
import React, { useState } from 'react';
import styles from './SettingsLayout.module.css';

/**
 * @typedef {object} SettingsSection
 * @property {string} id
 * @property {string} label
 * @property {React.ReactNode} [icon]
 * @property {string} [description] shown at the top of the pane
 * @property {() => React.ReactNode} render
 */

/**
 * @param {object} props
 * @param {SettingsSection[]} props.sections
 * @param {string} [props.defaultSection] id to open on; defaults to the first
 */
const SettingsLayout = ({ sections, defaultSection }) => {
  const [activeId, setActiveId] = useState(
    () => defaultSection || sections[0]?.id
  );

  const active =
    sections.find((section) => section.id === activeId) || sections[0];

  return (
    <div className={styles.layout}>
      <nav className={styles.categories} aria-label="Settings categories">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            aria-current={section.id === active?.id ? 'true' : undefined}
            className={[
              styles.category,
              section.id === active?.id ? styles.categoryActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveId(section.id)}
          >
            {section.icon && (
              <span className={styles.categoryIcon} aria-hidden="true">
                {section.icon}
              </span>
            )}
            <span className={styles.categoryLabel}>{section.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.pane}>
        {active?.description && (
          <p className={styles.paneDescription}>{active.description}</p>
        )}
        {active?.render()}
      </div>
    </div>
  );
};

export default SettingsLayout;
