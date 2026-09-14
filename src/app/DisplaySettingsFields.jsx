/**
 * Settings → Display.
 *
 * The app's character is optional. Someone watching figures all day can turn
 * the drawn frame, the graffiti and the frosted panels off and get a plain
 * instrument panel; nothing here changes what a run does.
 *
 * Lives in `app/` rather than in a page because every screen in the shell is
 * affected by it.
 */
import React from 'react';
import { Switch } from '../ui';
import { useDisplayPreferences } from './DisplayPreferences';
import styles from './DisplaySettingsFields.module.css';

const DisplaySettingsFields = () => {
  const { prefs, setPreference, reset } = useDisplayPreferences();

  return (
    <div className={styles.fields}>
      <Switch
        label="Hand-drawn frame"
        hint="Draws the marker border from the splash screen around the page."
        checked={prefs.frame}
        onChange={(on) => setPreference('frame', on)}
      />

      <Switch
        label="Page artwork"
        hint="The graffiti behind the page, kept away from the figures."
        checked={prefs.pageArt}
        onChange={(on) => setPreference('pageArt', on)}
      />

      <Switch
        label="Frosted panels"
        hint="Translucent, blurred panels. Turn off for flat surfaces, or if scrolling feels heavy."
        checked={prefs.glass}
        onChange={(on) => setPreference('glass', on)}
      />

      <button type="button" className={styles.reset} onClick={reset}>
        Reset to defaults
      </button>
    </div>
  );
};

export default DisplaySettingsFields;
