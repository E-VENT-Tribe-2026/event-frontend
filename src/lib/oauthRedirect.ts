/**
 * Base URL used for Supabase OAuth `redirectTo` (must match an entry in
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs).
 *
 * Loopback origins always win over VITE_OAUTH_REDIRECT_ORIGIN so a production
 * Site URL / env leftover cannot send local Google login to Vercel.
 *
 * Do not put ?next= on redirectTo. Supabase rejects allowlist misses and
 * falls back to Site URL (the production Vercel app).
 */

const OAUTH_NEXT_KEY = 'oauth_next_path';

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function getOAuthRedirectBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = stripTrailingSlash(window.location.origin);
    if (isLoopbackOrigin(origin)) return origin;
  }
  const explicit = import.meta.env.VITE_OAUTH_REDIRECT_ORIGIN?.trim();
  if (explicit) return stripTrailingSlash(explicit);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return stripTrailingSlash(window.location.origin);
  }
  return '';
}

export function rememberOAuthNextPath(nextPath: string = '/home'): void {
  if (typeof sessionStorage === 'undefined') return;
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  sessionStorage.setItem(OAUTH_NEXT_KEY, next);
}

export function consumeOAuthNextPath(fallback: string = '/home'): string {
  if (typeof sessionStorage === 'undefined') return fallback;
  const stored = sessionStorage.getItem(OAUTH_NEXT_KEY);
  sessionStorage.removeItem(OAUTH_NEXT_KEY);
  return stored || fallback;
}

export function getOAuthCallbackUrl(nextPath: string = '/home'): string {
  rememberOAuthNextPath(nextPath);
  const base = getOAuthRedirectBaseUrl();
  return `${base}/auth/callback`;
}
