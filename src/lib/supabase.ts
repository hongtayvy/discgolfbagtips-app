import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Null when the build has no Supabase config, in which case the app runs
 * exactly as before: anonymous, bags kept on the API's cookie session.
 */
export const supabase = url && key ? createClient(url, key) : null;

/** The current access token, refreshed by supabase-js if it is about to expire. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
