/**
 * Modal dialog.
 *
 * Closes on Escape and on a backdrop click, locks the page behind it, and
 * moves focus into the dialog on open so keyboard users are not left behind
 * on the page underneath.
 *
 * <Modal open={open} onClose={close} title="Settings" footer={<Button/>}>
 *   …
 * </Modal>
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { CloseIcon } from './icons';
import styles from './Modal.module.css';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {React.ReactNode} [props.title]
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} [props.footer]
 * @param {'sm'|'md'|'lg'} [props.size]
 */
const Modal = ({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  children,
}) => {
  const dialogRef = useRef(null);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return undefined;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    // Focus the dialog itself rather than guessing at a control inside it.
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onKeyDown={handleKeyDown}>
      {/*
        The backdrop is a button so it is reachable and announced; the dialog
        below it stops clicks from bubbling out to it.
      */}
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className={[styles.dialog, styles[size]].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
      >
        {(title || description) && (
          <header className={styles.header}>
            <div className={styles.headings}>
              {title && <h2 className={styles.title}>{title}</h2>}
              {description && (
                <p className={styles.description}>{description}</p>
              )}
            </div>
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </header>
        )}

        <div className={styles.body}>{children}</div>

        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>
  );
};

export default Modal;
