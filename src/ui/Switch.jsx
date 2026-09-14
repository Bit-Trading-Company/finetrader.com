/**
 * Switch: a setting that takes effect the moment it is flipped.
 *
 * Use it where there is no Save — display preferences, live toggles. A
 * `Checkbox` is still right inside a form the reader submits.
 *
 * <Switch
 *   label="Hand-drawn frame"
 *   hint="Draws the marker border around the page."
 *   checked={prefs.frame}
 *   onChange={(on) => setPreference('frame', on)}
 * />
 */
import React, { useId } from 'react';
import styles from './Switch.module.css';

/**
 * @param {object} props
 * @param {React.ReactNode} props.label
 * @param {React.ReactNode} [props.hint]
 * @param {boolean} props.checked
 * @param {(checked: boolean) => void} props.onChange
 * @param {boolean} [props.disabled]
 */
const Switch = ({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
  className = '',
}) => {
  const hintId = useId();

  return (
    <label
      className={[styles.row, disabled ? styles.disabled : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint && (
          <span className={styles.hint} id={hintId}>
            {hint}
          </span>
        )}
      </span>

      <input
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.knob} />
      </span>
    </label>
  );
};

export default Switch;
