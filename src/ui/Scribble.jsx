/**
 * Hand-drawn accents.
 *
 * The app's personality comes from the Mix Doodle headings; these SVGs add the
 * same drawn feeling to dividers and emphasis without turning the UI noisy.
 * They stretch to their container and inherit `currentColor`.
 */
import React from 'react';
import styles from './Scribble.module.css';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Marker stroke under a heading.
 * @param {{ animate?: boolean }} props animate draws it once on mount
 */
export const ScribbleUnderline = ({ animate = false, className = '' }) => (
  <svg
    className={joinClasses(
      styles.underline,
      animate && styles.animated,
      className
    )}
    viewBox="0 0 300 10"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      className={styles.underlinePath}
      d="M3 7c38-4 74-5 112-4 40 1 79 4 118 2 22-1 44-3 64-4"
    />
  </svg>
);

/** Wobbly rule for separating sections. */
export const DoodleDivider = ({ className = '' }) => (
  <svg
    className={joinClasses(styles.divider, className)}
    viewBox="0 0 400 12"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      className={styles.dividerPath}
      d="M2 8c26-5 52-5 78-1s52 5 78 1 52-5 78-1 52 5 78 1 52-5 84-2"
    />
  </svg>
);

/** Highlighter swipe behind inline text. */
export const Marker = ({ className = '', children }) => (
  <span className={joinClasses(styles.marker, className)}>{children}</span>
);
