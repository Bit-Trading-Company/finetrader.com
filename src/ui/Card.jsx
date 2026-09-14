/**
 * Card: a titled surface. Panels, list containers and form sections all use it.
 *
 * <Card title="Proxy wallets" subtitle="10 wallets" actions={<Button/>}>…</Card>
 */
import React from 'react';
import styles from './Card.module.css';

/**
 * @param {object} props
 * @param {React.ReactNode} [props.title]
 * @param {React.ReactNode} [props.subtitle]
 * @param {React.ReactNode} [props.actions] rendered top-right of the header
 * @param {React.ReactNode} [props.footer]
 * @param {'default'|'raised'|'quiet'} [props.tone]
 * @param {'none'|'sm'|'md'} [props.padding] body padding
 * @param {boolean} [props.interactive] hover affordance for clickable cards
 */
const Card = ({
  title,
  subtitle,
  actions,
  footer,
  tone = 'default',
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}) => {
  const bodyClass =
    padding === 'none'
      ? styles.bodyNone
      : padding === 'sm'
        ? styles.bodySm
        : styles.body;

  return (
    <section
      className={[
        styles.card,
        tone === 'raised' ? styles.raised : '',
        tone === 'quiet' ? styles.quiet : '',
        interactive ? styles.interactive : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {(title || actions) && (
        <header className={styles.header}>
          <div className={styles.headings}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </section>
  );
};

export default Card;
