import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (typeof process !== 'undefined' ? process.env?.REACT_APP_SUPABASE_URL : undefined) ||
  '';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' ? process.env?.REACT_APP_SUPABASE_ANON_KEY : undefined) ||
  '';

if ((!supabaseUrl || !supabaseAnonKey) && import.meta.env.MODE !== 'test') {
  console.warn('Missing Supabase environment variables.');
}

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/** Fired after the FastAPI JWT is pushed into the Realtime client. */
export const SUPABASE_REALTIME_AUTH_EVENT = 'eventapp:supabase-realtime-auth';

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Push the Python backend's access token into the Supabase JS client so
 * Realtime / RLS see the same user. The backend may omit a refresh token.
 */
export async function syncSupabaseSession(
  accessToken: string,
  refreshToken?: string | null,
): Promise<void> {
  if (!supabase || !accessToken) return;
  // Realtime RLS uses this JWT even when the backend omits a refresh token.
  try {
    supabase.realtime.setAuth(accessToken);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SUPABASE_REALTIME_AUTH_EVENT));
  }
  const refresh = typeof refreshToken === 'string' ? refreshToken : '';
  if (!refresh) return;
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refresh,
  });
  if (error) {
    console.warn('Supabase session sync failed:', error.message);
  }
}

/** Drop the local Supabase session on sign-out. Does not revoke the backend token. */
export async function clearSupabaseSession(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
