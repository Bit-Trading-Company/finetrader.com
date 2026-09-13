/**
 * A read-only value with a copy button — addresses, public keys, txids.
 *
 * Long values are shown in full and wrap, because a truncated address the
 * user cannot read is worse than a long one; the copy button is what they
 * actually reach for.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './CopyField.module.css';

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value
 * @param {React.ReactNode} [props.hint]
 * @param {boolean} [props.secret] hide the value until the user asks for it
 */
const CopyField = ({ label, value, hint, secret = false }) => {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!secret);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused (insecure context, denied permission).
      // The value is on screen either way, so there is nothing to recover.
    }
  }, [value]);

  return (
    <div className={styles.field}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.actions}>
          {secret && (
            <button
              type="button"
              className={styles.action}
              onClick={() => setRevealed((r) => !r)}
            >
              {revealed ? 'Hide' : 'Reveal'}
            </button>
          )}
          <button type="button" className={styles.action} onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </span>
      </div>

      <code className={styles.value}>
        {revealed ? value : '•'.repeat(Math.min(64, value?.length || 0))}
      </code>

      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
};

export default CopyField;
