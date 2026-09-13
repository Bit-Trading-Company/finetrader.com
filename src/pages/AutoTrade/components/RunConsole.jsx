/**
 * Live log of what the trader is doing.
 *
 * Entries come from `useTradingConsole` as `{ message, link, timestamp }`.
 * The engine writes plain text prefixed with a marker (✓, ✗, ⚠, 🛒 …); that
 * marker is read to tint the line, so failures stand out while scrolling
 * without changing what the engine emits.
 */
import React from 'react';
import { Badge, Button } from '../../../ui';
import { ExternalIcon } from '../../../ui/icons';
import styles from './RunConsole.module.css';

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
 * @param {{message: string, link?: string|null, timestamp?: string}[]} props.logs
 * @param {React.RefObject<HTMLElement>} props.consoleRef keeps the view pinned to the newest line
 * @param {boolean} props.isTrading
 * @param {() => void} [props.onClear]
 */
const RunConsole = ({ logs, consoleRef, isTrading, onClear }) => (
  <div className={styles.console}>
    <div className={styles.header}>
      <span className={styles.title}>Activity</span>
      <span className={styles.headerRight}>
        {logs.length > 0 && onClear && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
        {isTrading ? (
          <Badge tone="success" dot>
            Running
          </Badge>
        ) : (
          <Badge tone="neutral">Idle</Badge>
        )}
      </span>
    </div>

    <div
      className={styles.output}
      ref={consoleRef}
      role="log"
      aria-live="polite"
    >
      {logs.length === 0 ? (
        <p className={styles.empty}>
          Nothing yet. Start a run and the trader reports every step here.
        </p>
      ) : (
        logs.map((entry, index) => (
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

export default RunConsole;
