/**
 * Base URL used for Supabase OAuth `redirectTo` (must match an entry in
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs).
 *
 * If unset, uses `window.location.origin` (e.g. http://localhost:8081).
 * Set VITE_OAUTH_REDIRECT_ORIGIN when your allowlist uses a fixed origin
 * (e.g. you open the app via 127.0.0.1 but only localhost is allowlisted).
 */
export function getOAuthRedirectBaseUrl(): string {
  const explicit = import.meta.env.VITE_OAUTH_REDIRECT_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

export function getOAuthCallbackUrl(nextPath: string = '/home'): string {
  const base = getOAuthRedirectBaseUrl();
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}
