import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * Light is the default. Dark is something the user picks, never something the
 * device decides: following the OS made the site flip to dark on its own, which
 * read as a bug. A signed-in player's choice is kept on their account and follows
 * them between devices (see useAccountSettings); this browser also caches it and
 * applies it to <html> from an inline script in index.html before first paint, so
 * there is no flash.
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
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  // Keeps the browser's own chrome (form controls, scrollbars) in step.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1a15' : '#1B3A2E');
}

/**
 * One theme for the whole page, held outside React so the header toggle and the
 * account-settings sync see the same value. localStorage is only a cache here:
 * when signed in the account's saved theme wins, and the cache exists so the
 * page paints in the right theme before that answer arrives.
 */
let current: Theme = readStoredTheme();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getTheme = () => current;

export function setTheme(next: Theme) {
  if (next === current) return;
  current = next;
  apply(next);
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode: the choice just won't survive a reload */
  }
  listeners.forEach((notify) => notify());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, getTheme);

  useEffect(() => apply(theme), [theme]);

  const toggle = useCallback(() => setTheme(current === 'dark' ? 'light' : 'dark'), []);
  return { theme, toggle };
}
