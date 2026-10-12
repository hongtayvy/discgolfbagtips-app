import { useCallback, useEffect, useRef, useState } from 'react';
import { getSettings, patchSettings } from '../api/client';
import {
  chosenSettings,
  diffSettings,
  fromWire,
  isEmpty,
  type SettingsSnapshot,
  toWire,
} from './accountSettings';
import { useAuthSession } from './useAuthSession';

/** `off` means signed out: nothing is synced and settings live only in this browser. */
export type SettingsSyncState = 'off' | 'loading' | 'ready' | 'saving' | 'error';

const SAVE_DELAY_MS = 500;

/**
 * Keeps a signed-in player's preferences on their account.
 *
 * On sign-in the saved settings are fetched and handed to `apply`; whatever the
 * account has not got yet is then filled from the values already on screen, so
 * the first sign-in keeps what the player had picked. After that, local changes
 * are saved (debounced) as a diff against what the server last confirmed.
 *
 * Saving is a merge on the server, so two browsers changing different things do
 * not overwrite each other. A failed save leaves the server's last confirmed
 * state in place, and the next change retries the whole difference.
 *
 * Signed out, this does nothing: the caller's own session storage and the
 * theme's localStorage cache are all there is.
 */
export function useAccountSettings(
  local: SettingsSnapshot,
  apply: (chosen: Partial<SettingsSnapshot>) => void,
): SettingsSyncState {
  const auth = useAuthSession();
  const userId = auth?.user.id ?? null;

  const [state, setState] = useState<SettingsSyncState>('off');
  const confirmed = useRef<SettingsSnapshot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The latest values, readable from timers without re-subscribing effects.
  const localRef = useRef(local);
  const applyRef = useRef(apply);
  useEffect(() => {
    localRef.current = local;
    applyRef.current = apply;
  });

  const flush = useCallback(async () => {
    const base = confirmed.current;
    if (!base) return;
    const patch = diffSettings(base, localRef.current);
    if (isEmpty(patch)) {
      setState('ready');
      return;
    }
    setState('saving');
    try {
      const saved = fromWire(await patchSettings(toWire(patch)));
      confirmed.current = saved;
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    confirmed.current = null;
    clearTimeout(timer.current);
    if (!userId) return;

    let cancelled = false;
    // Deferred a tick so state is only set from a callback, not synchronously in the effect.
    void Promise.resolve().then(() => !cancelled && setState('loading'));
    getSettings()
      .then((wire) => {
        if (cancelled) return;
        const server = fromWire(wire);
        confirmed.current = server;
        const chosen = chosenSettings(server);
        if (!isEmpty(chosen)) applyRef.current(chosen);
        setState('ready');
        // Fields the account lacks are seeded from what is on screen. Applying
        // `chosen` re-renders first, so the change effect below picks up the
        // merged values and saves only the remainder.
        timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });

    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [userId, flush]);

  const key = JSON.stringify(local);
  useEffect(() => {
    const base = confirmed.current;
    if (!base || isEmpty(diffSettings(base, localRef.current))) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    return () => clearTimeout(timer.current);
  }, [key, flush]);

  // Signed out is derived, not stored: it cannot be stale after a sign-out.
  return userId ? state : 'off';
}
