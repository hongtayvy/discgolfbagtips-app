import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { claimSession } from '../api/client';
import { supabase } from '../lib/supabase';

/**
 * Sign-in for saved bags. Renders nothing when Supabase is not configured.
 * Passwords go straight to Supabase; the API only ever sees the access token.
 *
 * `onChange` fires after sign-in (with any anonymous bags already claimed) and
 * after sign-out, so lists backed by /profiles can refetch.
 */
export function AuthBar({ onChange }: { onChange: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'SIGNED_IN') {
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

  if (session) {
    return (
      <div className="auth">
        <span className="auth__who">{session.user.email ?? 'Signed in'}</span>
        <button type="button" className="button button--ghost" onClick={() => void supabase!.auth.signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const creds = { email: email.trim(), password };
    const { data, error } =
      mode === 'in'
        ? await supabase!.auth.signInWithPassword(creds)
        : await supabase!.auth.signUp({ ...creds, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) setMessage(error.message);
    else if (!data.session) setMessage('Check your email to confirm the account, then sign in.');
    else {
      setOpen(false);
      setPassword('');
    }
  };

  if (!open) {
    return (
      <div className="auth">
        <button type="button" className="button button--ghost" onClick={() => setOpen(true)}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <form className="auth auth__form" onSubmit={(e) => void submit(e)}>
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="Email"
        aria-label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        required
        minLength={6}
        autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
        placeholder="Password"
        aria-label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit" className="button" disabled={busy}>
        {mode === 'in' ? 'Sign in' : 'Create account'}
      </button>
      <button
        type="button"
        className="button button--ghost"
        onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
      >
        {mode === 'in' ? 'New here?' : 'Have an account?'}
      </button>
      <button type="button" className="button button--ghost" onClick={() => setOpen(false)} aria-label="Cancel">
        ×
      </button>
      {message && <p className="auth__message" role="status">{message}</p>}
    </form>
  );
}
