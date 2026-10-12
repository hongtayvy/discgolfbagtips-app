import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogoMark } from './Logo';
import { GOOGLE_ENABLED, PRIVACY_URL, TERMS_URL, type AuthStep } from '../lib/authConfig';

/**
 * The sign-in dialog, from brand identity v1.0 ("02 Login modal").
 *
 * A native <dialog> opened with showModal(): the browser provides the focus
 * trap, Escape to close, an inert page behind it, and focus returning to the
 * trigger. It opens over the page rather than expanding the header, which is
 * what made the old inline form shift everything around it.
 *
 * Steps:
 *   choose  — provider buttons (only when Google is enabled)
 *   email   — email + password, sign in or create account
 *   forgot  — send a reset link
 *   sent    — "check your inbox", after sign-up or a reset request
 *   reset   — set a new password, after following a reset link
 */

/**
 * The parent remounts this with a fresh `key` on every open, so each attempt
 * starts with empty fields and no stale error — no reset effects needed.
 */
export function AuthDialog({
  open,
  step,
  onStep,
  onClose,
}: {
  open: boolean;
  step: AuthStep;
  onStep: (step: AuthStep) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<{ kind: 'confirm' | 'reset'; email: string } | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // React's autoFocus runs at mount, before showModal(), when nothing in a
      // closed dialog can take focus; the browser then picks the close button.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Moving between steps or modes clears the last error with it.
  const go = (next: AuthStep) => {
    setError(null);
    onStep(next);
  };
  const switchMode = (next: 'in' | 'up') => {
    setError(null);
    setMode(next);
  };

  if (!supabase) return null;
  const auth = supabase.auth;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const google = () =>
    run(async () => {
      const { error: e } = await auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (e) throw e;
      // Success navigates away to Google; nothing more to do here.
    });

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const creds = { email: email.trim(), password };
      if (mode === 'in') {
        const { error: err } = await auth.signInWithPassword(creds);
        if (err) throw err;
        onClose();
        return;
      }
      const { data, error: err } = await auth.signUp({
        ...creds,
        options: { emailRedirectTo: window.location.origin },
      });
      if (err) throw err;
      if (data.session) {
        onClose();
      } else {
        setSentTo({ kind: 'confirm', email: creds.email });
        onStep('sent');
      }
    });
  };

  const submitForgot = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { error: err } = await auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (err) throw err;
      setSentTo({ kind: 'reset', email: email.trim() });
      onStep('sent');
    });
  };

  const submitReset = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { error: err } = await auth.updateUser({ password });
      if (err) throw err;
      setPassword('');
      onClose();
    });
  };

  const heading: Record<AuthStep, { title: string; lede: string }> = {
    choose: {
      title: 'Welcome to Disc Golf Bag Tips',
      lede: 'Analyze your disc golf bag and get personalized insights to improve your game.',
    },
    email:
      mode === 'in'
        ? { title: 'Sign in to Disc Golf Bag Tips', lede: 'Your saved bags follow you to any device.' }
        : { title: 'Create your account', lede: 'Save bags to your account and pick them up anywhere.' },
    forgot: {
      title: 'Reset your password',
      lede: "Enter your account email and we'll send you a link to set a new one.",
    },
    sent: {
      title: 'Check your inbox',
      lede:
        sentTo?.kind === 'reset'
          ? `If an account exists for ${sentTo.email}, a reset link is on its way.`
          : `We sent a confirmation link to ${sentTo?.email ?? 'your email'}. Open it, then sign in.`,
    },
    reset: { title: 'Choose a new password', lede: 'At least 6 characters.' },
  };
  const { title, lede } = heading[step];

  return (
    <dialog
      ref={ref}
      className="auth-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      // Close on a click that both starts and ends on the backdrop, so dragging
      // a text selection out of a field never dismisses the dialog.
      onPointerDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="auth-dialog__panel">
        <button type="button" className="auth-dialog__close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <header className="auth-dialog__head">
          <span className="auth-dialog__mark"><LogoMark height={40} /></span>
          <h2 id={titleId}>{title}</h2>
          <p>{lede}</p>
        </header>

        {step === 'choose' && (
          <div className="auth-dialog__providers">
            {GOOGLE_ENABLED && (
              <button
                type="button"
                className="provider-button"
                disabled={busy}
                onClick={() => void google()}
                autoFocus
                data-autofocus
              >
                <GoogleIcon />
                Continue with Google
              </button>
            )}
            <button type="button" className="provider-button" disabled={busy} onClick={() => go('email')}>
              <MailIcon />
              Continue with email
            </button>
          </div>
        )}

        {step === 'email' && (
          <form className="auth-dialog__form" onSubmit={submitEmail} noValidate={false}>
            <Field label="Email">
              <input
                type="email"
                required
                autoComplete="email"
                autoFocus
                data-autofocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field
              label="Password"
              aside={
                mode === 'in' ? (
                  <button type="button" className="link-button" onClick={() => go('forgot')}>
                    Forgot password?
                  </button>
                ) : undefined
              }
            >
              <PasswordInput
                value={password}
                onChange={setPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              />
            </Field>
            {mode === 'up' && <p className="auth-dialog__hint">At least 6 characters.</p>}

            <ErrorLine message={error} />

            <button type="submit" className="button button--primary auth-dialog__submit" disabled={busy}>
              {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
            </button>

            <p className="auth-dialog__switch">
              {mode === 'in' ? 'New to Disc Golf Bag Tips?' : 'Already have an account?'}{' '}
              <button type="button" className="link-button" onClick={() => switchMode(mode === 'in' ? 'up' : 'in')}>
                {mode === 'in' ? 'Create an account' : 'Sign in'}
              </button>
            </p>

            {GOOGLE_ENABLED && (
              <button type="button" className="link-button auth-dialog__back" onClick={() => go('choose')}>
                ← Other ways to sign in
              </button>
            )}
          </form>
        )}

        {step === 'forgot' && (
          <form className="auth-dialog__form" onSubmit={submitForgot}>
            <Field label="Email">
              <input
                type="email"
                required
                autoComplete="email"
                autoFocus
                data-autofocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <ErrorLine message={error} />
            <button type="submit" className="button button--primary auth-dialog__submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <button type="button" className="link-button auth-dialog__back" onClick={() => go('email')}>
              ← Back to sign in
            </button>
          </form>
        )}

        {step === 'sent' && (
          <div className="auth-dialog__form">
            <button
              type="button"
              className="button button--primary auth-dialog__submit"
              autoFocus
                data-autofocus
              onClick={() => {
                switchMode('in');
                go('email');
              }}
            >
              Back to sign in
            </button>
          </div>
        )}

        {step === 'reset' && (
          <form className="auth-dialog__form" onSubmit={submitReset}>
            <Field label="New password">
              <PasswordInput
                value={password}
                onChange={setPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                autoComplete="new-password"
                autoFocus
              />
            </Field>
            <ErrorLine message={error} />
            <button type="submit" className="button button--primary auth-dialog__submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save password'}
            </button>
          </form>
        )}

        {TERMS_URL && PRIVACY_URL && step !== 'reset' && (
          <p className="auth-dialog__legal">
            By continuing, you agree to our{' '}
            <a href={TERMS_URL} target="_blank" rel="noreferrer">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href={PRIVACY_URL} target="_blank" rel="noreferrer">
              Privacy Policy
            </a>
            .
          </p>
        )}
      </div>
    </dialog>
  );
}

function Field({ label, aside, children }: { label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="auth-field">
      <div className="auth-field__top">
        <label htmlFor={id}>{label}</label>
        {aside}
      </div>
      {/* The single child control receives the id so the label targets it. */}
      <div className="auth-field__control">
        {isValidElement<{ id?: string }>(children) ? cloneElement(children, { id }) : children}
      </div>
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  autoFocus,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  return (
    <span className="password-input">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required
        minLength={6}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        data-autofocus={autoFocus || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="password-input__toggle"
        onClick={onToggle}
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </span>
  );
}

/** Space for one line is always reserved, so an error never shifts the form. */
function ErrorLine({ message }: { message: string | null }) {
  return (
    <p className="auth-dialog__error" role="alert" aria-live="assertive">
      {message ?? ''}
    </p>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 5.5l7 5.5 7-5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Supabase's messages are written for developers ("Failed to fetch"). The
 * common ones get plain language; anything else is shown as-is rather than
 * hidden behind a vague catch-all.
 */
function friendlyAuthError(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  const message = err instanceof Error ? err.message : '';
  if (name === 'AuthRetryableFetchError' || /failed to fetch|network/i.test(message))
    return "Couldn't reach the sign-in service. Check your connection and try again.";
  if (/invalid login credentials/i.test(message)) return "That email and password don't match.";
  if (/email not confirmed/i.test(message)) return 'Confirm your email first — check your inbox for the link.';
  if (/user already registered/i.test(message)) return 'An account with that email already exists. Sign in instead.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  return message || 'Something went wrong. Try again.';
}
