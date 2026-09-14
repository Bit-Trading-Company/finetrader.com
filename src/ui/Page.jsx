/**
 * The frame every screen in the app shell is built on.
 *
 * Holds three things in the right relationship: the page's artwork behind
 * everything, the content column above it, and any dialogs the page owns
 * *outside* the content column.
 *
 * That last part is not cosmetic. `.content` establishes a stacking context so
 * it can sit above the artwork, and a `position: fixed` overlay rendered
 * inside a stacking context is trapped by it — which is how the funding dialog
 * once ended up stranded at the bottom of the page. Passing dialogs through
 * `overlays` keeps them clear of it.
 *
 * <Page variant="consolidator" overlays={<SomeModal />}>
 *   <PageHeader title="Consolidator" />
 *   …
 * </Page>
 */
import React from 'react';
import PageArt from './PageArt';
import styles from './Page.module.css';

/**
 * @param {object} props
 * @param {import('./PageArt').ArtVariant} props.variant which artwork field
 * @param {React.ReactNode} [props.overlays] dialogs, rendered outside the column
 */
const Page = ({ variant, overlays, className = '', children }) => (
  <div className={styles.page}>
    <PageArt variant={variant} />
    <div className={[styles.content, className].filter(Boolean).join(' ')}>
      {children}
    </div>
    {overlays}
  </div>
);

export default Page;
