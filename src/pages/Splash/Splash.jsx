/**
 * Splash: the front door at `/`.
 *
 * A single viewport-height stage. The cast artwork is anchored to the bottom
 * (its top half is transparent, so the headline sits in that space), and the
 * whole thing is framed by the hand-drawn border.
 *
 * Motion is deliberately restrained: a staggered rise on load, a slow float,
 * and a few pixels of pointer parallax. All of it is skipped for
 * `prefers-reduced-motion` and for coarse pointers, where there is no cursor
 * to follow.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../ui';
import castImage from '../../assets/images/png/fine-trader.png';
import styles from './Splash.module.css';

const Splash = () => {
  const stageRef = useRef(null);
  const frameRef = useRef(null);

  /**
   * Write the pointer offset to CSS custom properties and let CSS do the
   * moving; a rAF gate keeps this to one style write per frame.
   */
  const handlePointerMove = useCallback((event) => {
    const stage = stageRef.current;
    if (!stage) return;

    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      // -1 .. 1 from the centre of the viewport.
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      stage.style.setProperty('--px', x.toFixed(3));
      stage.style.setProperty('--py', y.toFixed(3));
    });
  }, []);

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)');
    const stillness = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!finePointer.matches || stillness.matches) return undefined;

    window.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [handlePointerMove]);

  return (
    <div className={`ds-root ${styles.splash}`} ref={stageRef}>
      <div className={styles.frame}>
        <div className={styles.stage}>
          <div className={styles.glow} aria-hidden="true" />

          <header className={styles.copy}>
            <h1 className={styles.title}>
              Everything is gonna be fine
              <span className={styles.dots} aria-hidden="true">
                ..
              </span>
            </h1>

            {/*
              One way in, and nothing to read on the way. The market and
              everything else is a click away in the sidebar once inside.
            */}
            <div className={styles.actions}>
              <Button as={Link} to="/auto-trade" size="lg">
                Enter Fine Trader
              </Button>
            </div>
          </header>

          <div className={styles.castWrap}>
            <img
              className={styles.cast}
              src={castImage}
              alt="The three Fine Trader characters in suits"
              draggable="false"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Splash;
