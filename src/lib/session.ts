import { useCallback, useEffect, useState } from 'react';

/**
 * Session-scoped state. No accounts, no login — the bag lives in
 * sessionStorage so a page reload keeps your work but closing the tab
 * starts clean. Matches the backend's no-accounts-yet approach.
 *
 * `validate` is not optional in spirit: stored state can outlive a deploy, and
 * restoring a shape the current code no longer understands crashes the first
 * component that renders it. Anything that fails validation is dropped and the
 * initial value is used instead.
 */
export function useSessionState<T>(
  key: string,
  initial: T,
  validate?: (raw: unknown) => T | null,
) {
  const storageKey = `dgbt:${key}`;

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw === null) return initial;
      const parsed: unknown = JSON.parse(raw);
      if (!validate) return parsed as T;
      const valid = validate(parsed);
      if (valid !== null) return valid;
      // Stale or corrupt — clear it so it cannot fail again on the next load.
      sessionStorage.removeItem(storageKey);
      return initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* private mode / quota — state simply won't survive a reload */
    }
  }, [storageKey, value]);

  const reset = useCallback(() => {
    setValue(initial);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    // `initial` is a literal at every call site; intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  return [value, setValue, reset] as const;
}

export function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
