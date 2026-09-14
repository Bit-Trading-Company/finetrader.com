/**
 * The graffiti ground behind a page.
 *
 * Every screen in the shell gets one, and each gets a different field of it,
 * so you can tell where you are before you have read a word. The variants are
 * two drawings re-framed and hue-shifted rather than ten separate files —
 * same hand, different corner of it.
 *
 * Fixed rather than scrolling, so it reads as the surface the page rests on.
 * The mask clears the top band, where the page title and any headline figures
 * sit on bare page with no frosted panel to keep them legible.
 *
 * The shell sets `--ds-page-art-opacity` to 0 when Settings → Display turns
 * the artwork off, so this component never reads that preference.
 *
 *   <PageArt variant="consolidator" />
 */
import React from 'react';
import graffitiDark from '../assets/images/png/backgrounds/background_8.PNG';
import graffitiViolet from '../assets/images/png/backgrounds/background_6.PNG';
import styles from './PageArt.module.css';

/**
 * @typedef {'trade'|'consolidator'|'extractor'|'market'|'analytics'} ArtVariant
 */

/** @type {Record<ArtVariant, {image: string, position: string, hue: number, strength: number}>} */
const VARIANTS = {
  trade: { image: graffitiDark, position: '50% 50%', hue: 0, strength: 0.5 },
  consolidator: {
    image: graffitiViolet,
    position: '22% 28%',
    hue: 0,
    strength: 0.42,
  },
  extractor: {
    image: graffitiDark,
    position: '78% 68%',
    hue: 135,
    strength: 0.45,
  },
  market: {
    image: graffitiViolet,
    position: '72% 18%',
    hue: 205,
    strength: 0.4,
  },
  analytics: {
    image: graffitiDark,
    position: '28% 82%',
    hue: 255,
    strength: 0.42,
  },
};

/**
 * @param {object} props
 * @param {ArtVariant} props.variant
 */
const PageArt = ({ variant }) => {
  const art = VARIANTS[variant] || VARIANTS.trade;

  return (
    <div
      className={styles.art}
      aria-hidden="true"
      style={{
        backgroundImage: `url(${art.image})`,
        backgroundPosition: art.position,
        filter: art.hue ? `hue-rotate(${art.hue}deg)` : undefined,
        '--art-strength': art.strength,
      }}
    />
  );
};

export default PageArt;
