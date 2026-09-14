/**
 * Explanatory tooltip on an info affordance.
 *
 * Opens on hover and on focus, and closes on Escape or blur, so it is
 * reachable by keyboard rather than being a mouse-only flourish. The content
 * is a real element rather than a `title` attribute because these explain
 * concepts and need more than one line.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import styles from './Tooltip.module.css';

/**
 * @param {object} props
 * @param {React.ReactNode} props.children the tooltip body
 * @param {string} [props.label] accessible name for the trigger
 * @param {'top'|'bottom'} [props.placement]
 */
export const InfoTip = ({
  children,
  label = 'More information',
  placement = 'bottom',
}) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') close();
    };
    // A click anywhere else dismisses it, including on touch where there is
    // no pointer to move away.
    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  return (
    <span
      className={styles.wrap}
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
    >
      <button
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        i
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          className={[styles.bubble, styles[placement]].join(' ')}
        >
          {children}
        </span>
      )}
    </span>
  );
};

export default InfoTip;
