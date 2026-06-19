import React, {
  createContext,
  useLayoutEffect,
  useState,
  useCallback,
} from 'react';

export const ThemeContext = createContext({
  theme: 'system',
  setTheme: () => {
    // Default no-op function
  },
});

const applyThemeToDOM = (currentTheme) => {
  if (typeof window === 'undefined') return;

  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const prefersDarkScheme = darkModeMediaQuery.matches;
  const root = document.documentElement;

  root.classList.remove('light', 'dark');

  if (currentTheme === 'system') {
    root.classList.add(prefersDarkScheme ? 'dark' : 'light');
  } else {
    root.classList.add(currentTheme);
  }
};

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'system';

    try {
      return localStorage.getItem('theme') || 'system';
    } catch {
      return 'system';
    }
  });

  const applyTheme = useCallback((currentTheme) => {
    applyThemeToDOM(currentTheme);
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    applyTheme(theme);

    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Ignore localStorage errors
    }

    const darkModeMediaQuery = window.matchMedia(
      '(prefers-color-scheme: dark)'
    );
    const handleChange = () => applyTheme(theme);

    if (theme === 'system') {
      darkModeMediaQuery.addEventListener('change', handleChange);
      return () =>
        darkModeMediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, applyTheme]);

  const contextValue = React.useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
