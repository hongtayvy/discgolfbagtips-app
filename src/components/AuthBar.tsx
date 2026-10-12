import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { claimSession } from '../api/client';
import { supabase } from '../lib/supabase';
import { FIRST_STEP, type AuthStep } from '../lib/authConfig';
import { initialsFor } from '../lib/initials';
import { AuthDialog } from './AuthDialog';

/**
 * Header account control. Renders nothing when Supabase is not configured.
 * Passwords and OAuth go straight to Supabase; the API only sees the token.
 *
 * Signed out: one "Sign in" button that opens AuthDialog over the page. The
 * header never changes size, which is what the old inline form got wrong.
 * Signed in: an initials avatar with a small menu, as in the brand kit.
 *
 * `onChange` fires after sign-in (with any anonymous bags already claimed) and
 * after sign-out, so lists backed by /profiles can refetch.
 */
export function AuthBar({ onChange }: { onChange: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; step: AuthStep; key: number }>({
    open: false,
    step: FIRST_STEP,
    key: 0,
  });

  const openDialog = (step: AuthStep = FIRST_STEP) =>
    setDialog((d) => ({ open: true, step, key: d.key + 1 }));
  const closeDialog = () => setDialog((d) => ({ ...d, open: false }));

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') {
        // Arrived from a reset email: ask for the new password straight away.
        openDialog('reset');
      } else if (event === 'SIGNED_IN') {
        // Deferred: supabase-js holds a lock during this callback, and the API
        // calls below ask it for the token.
        setTimeout(() => {
          claimSession()
            .catch(() => undefined)
            .finally(onChange);
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        onChange();
      }
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supabase) return null;

  return (
    <div className="auth">
      {session ? (
        <AccountMenu email={session.user.email ?? ''} onSignOut={() => void supabase!.auth.signOut()} />
      ) : (
        <button type="button" className="button button--primary" onClick={() => openDialog()}>
          Sign in
        </button>
      )}
      <AuthDialog
        key={dialog.key}
        open={dialog.open}
        step={dialog.step}
        onStep={(step) => setDialog((d) => ({ ...d, step }))}
        onClose={closeDialog}
      />
    </div>
  );
}

function AccountMenu({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="account" ref={root}>
      <button
        type="button"
        className="account__avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${email}`}
        onClick={() => setOpen((v) => !v)}
      >
        {initialsFor(email)}
      </button>
      {open && (
        <div className="account__menu" role="menu">
          <p className="account__email">{email}</p>
          <button
            type="button"
            role="menuitem"
            className="account__item"
            autoFocus
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
