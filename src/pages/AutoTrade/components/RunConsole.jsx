/**
 * Live log of what the trader is doing.
 *
 * The engine writes plain strings prefixed with a marker (✓, ✗, ⚠, 🛒 …);
 * those are read to tint the line, so failures are visible while scrolling
 * without changing the engine's output.
 */
import React from 'react';
import { Badge } from '../../../ui';
import styles from './RunConsole.module.css';

/** Classify a log line by the marker the engine put at the front. */
const toneFor = (line) => {
  const text = String(line);
  if (text.includes('✗')) return styles.error;
  if (text.includes('⚠')) return styles.warn;
  if (text.includes('✓')) return styles.ok;
  return '';
};

/**
 * @param {object} props
 * @param {string[]} props.logs
 * @param {React.RefObject<HTMLElement>} props.consoleRef keeps the view pinned to the newest line
 * @param {boolean} props.isTrading
 */
const RunConsole = ({ logs, consoleRef, isTrading }) => (
  <div className={styles.console}>
    <div className={styles.header}>
      <span className={styles.title}>Activity</span>
      {isTrading ? (
        <Badge tone="success" dot>
          Running
        </Badge>
      ) : (
        <Badge tone="neutral">Idle</Badge>
      )}
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
        logs.map((line, index) => (
          // Logs are append-only and may repeat, so the index is the identity.
          <div key={index} className={[styles.line, toneFor(line)].join(' ')}>
            {line}
          </div>
        ))
      )}
    </div>
  </div>
);

export default RunConsole;
