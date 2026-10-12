import type { SettingsSyncState } from '../lib/useAccountSettings';

const COPY: Record<SettingsSyncState, string | null> = {
  off: 'Sign in to keep this on your account.',
  loading: null,
  ready: 'Saved to your account',
  saving: 'Saving…',
  error: "Couldn't sync to your account — kept in this browser.",
};

/** Says where "Your game" is being kept, so a signed-out player knows it will not follow them. */
export function SettingsStatus({ state }: { state: SettingsSyncState }) {
  const text = COPY[state];
  return (
    <p className={`settings-status settings-status--${state}`} role="status" aria-live="polite">
      {text}
    </p>
  );
}
