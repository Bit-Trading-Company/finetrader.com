/**
 * How the app looks, as choices the reader owns.
 *
 * These are presentation only — nothing here changes what a run does. They
 * exist because the app's character (the drawn frame, the graffiti behind the
 * page, frosted panels) is worth having but not worth forcing on someone
 * watching figures all day, or on a machine where a blur costs frames.
 *
 * The shell turns each one into a class or a token override on `.ds-root`, so
 * components never read this context to know how to paint themselves.
 *
 *   const { prefs, setPreference } = useDisplayPreferences();
 *   setPreference('frame', true);
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'fine-trading-display';

/**
 * @typedef {object} DisplayPrefs
 * @property {boolean} frame hand-drawn border around the content column
 * @property {boolean} pageArt graffiti ground behind the page
 * @property {boolean} glass frosted translucent panels
 */

/** @type {DisplayPrefs} */
export const DISPLAY_DEFAULTS = {
  // Off by default: the frame is a deliberate flourish, not the resting state.
  frame: false,
  pageArt: true,
  glass: true,
};

const read = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DISPLAY_DEFAULTS;
    // Merge over the defaults so a preference added later is not missing for
    // anyone who already has a stored object.
    return { ...DISPLAY_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DISPLAY_DEFAULTS;
  }
};

const DisplayPreferencesContext = createContext(null);

export const DisplayPreferencesProvider = ({ children }) => {
  const [prefs, setPrefs] = useState(read);

  const setPreference = useCallback((key, value) => {
    setPrefs((previous) => {
      const next = { ...previous, [key]: value };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* a remembered preference is optional */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPrefs(DISPLAY_DEFAULTS);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clear */
    }
  }, []);

  const value = useMemo(
    () => ({ prefs, setPreference, reset }),
    [prefs, setPreference, reset]
  );

  return (
    <DisplayPreferencesContext.Provider value={value}>
      {children}
    </DisplayPreferencesContext.Provider>
  );
};

/**
 * @returns {{ prefs: DisplayPrefs, setPreference: (key: keyof DisplayPrefs, value: boolean) => void, reset: () => void }}
 */
export const useDisplayPreferences = () => {
  const context = useContext(DisplayPreferencesContext);
  if (!context) {
    throw new Error(
      'useDisplayPreferences must be used inside a DisplayPreferencesProvider'
    );
  }
  return context;
};
