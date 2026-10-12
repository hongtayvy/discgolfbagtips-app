/** Build-time auth options. All optional; absent means the feature is off. */

export type AuthStep = 'choose' | 'email' | 'forgot' | 'sent' | 'reset';

/** Set VITE_AUTH_GOOGLE=true once Google is enabled as a Supabase provider. */
export const GOOGLE_ENABLED = import.meta.env.VITE_AUTH_GOOGLE === 'true';

/** The legal line renders only when both pages actually exist. */
export const TERMS_URL = import.meta.env.VITE_TERMS_URL as string | undefined;
export const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL as string | undefined;

/** Where a flow starts. With no providers, a one-button chooser is pointless. */
export const FIRST_STEP: AuthStep = GOOGLE_ENABLED ? 'choose' : 'email';

