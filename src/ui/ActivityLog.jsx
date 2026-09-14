/**
 * Live log of what a screen is doing — trading, consolidating, extracting.
 *
 * Entries come from `useActivityLog` as `{ message, link, timestamp }`. The
 * work writes plain text prefixed with a marker (✓, ✗, ⚠, 🛒 …); that marker
 * is read to tint the line, so failures stand out while scrolling without
 * changing what the caller emits.
 */
import React from 'react';
import { Badge } from './Feedback';
import Button from './Button';
import { ExternalIcon } from './icons';
import styles from './ActivityLog.module.css';

/** Classify a log line by the marker the engine put at the front. */
const toneFor = (message) => {
  const text = String(message ?? '');
  if (text.includes('✗')) return styles.error;
  if (text.includes('⚠')) return styles.warn;
  if (text.includes('✓')) return styles.ok;
  return '';
};

/**
 * @param {object} props
 * @param {{message: string, link?: string|null, timestamp?: string}[]} props.entries
 * @param {React.RefObject<HTMLElement>} props.scrollRef keeps the view pinned to the newest line
 * @param {boolean} [props.busy] something is running right now
 * @param {string} [props.busyLabel] what "running" is called on this screen
 * @param {string} [props.emptyHint] what to say before anything has happened
 * @param {() => void} [props.onClear]
 */
const ActivityLog = ({
  entries,
  scrollRef,
  busy = false,
  busyLabel = 'Running',
  emptyHint = 'Nothing yet.',
  onClear,
}) => (
  <div className={`ds-panel ${styles.console}`}>
    <div className={styles.header}>
      <span className={styles.title}>Activity</span>
      <span className={styles.headerRight}>
        {entries.length > 0 && onClear && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
        {busy ? (
          <Badge tone="success" dot>
            {busyLabel}
          </Badge>
        ) : (
          <Badge tone="neutral">Idle</Badge>
        )}
      </span>
    </div>

    <div
      className={styles.output}
      ref={scrollRef}
      role="log"
      aria-live="polite"
    >
      {entries.length === 0 ? (
        <p className={styles.empty}>{emptyHint}</p>
      ) : (
        entries.map((entry, index) => (
          // Logs are append-only and may repeat, so the index is the identity.
          <div key={index} className={styles.row}>
            {entry.timestamp && (
              <span className={styles.time}>{entry.timestamp}</span>
            )}
            <span className={[styles.line, toneFor(entry.message)].join(' ')}>
              {entry.message}
              {entry.link && (
                <a
                  className={styles.link}
                  href={entry.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalIcon size={13} />
                  <span>open</span>
                </a>
              )}
            </span>
          </div>
        ))
      )}
    </div>
  </div>
);

export default ActivityLog;
