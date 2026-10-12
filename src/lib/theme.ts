import { useCallback, useEffect, useState } from 'react';

/**
 * Light is the default. Dark is something the user picks, never something the
 * device decides: following the OS made the site flip to dark on its own, which
 * read as a bug. The choice is stored per browser and applied to <html> by an
 * inline script in index.html before first paint, so there is no flash.
 */
export type Theme = 'light' | 'dark';

const KEY = 'dgbt:theme';

export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  // Keeps the browser's own chrome (form controls, scrollbars) in step.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1a15' : '#1B3A2E');
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* private mode: the choice just won't survive a reload */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}
