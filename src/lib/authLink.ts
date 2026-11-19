/** Auth email / magic-link `type` from the query string or hash fragment. */

export function readAuthLinkType(
  search = typeof window !== 'undefined' ? window.location.search : '',
  hash = typeof window !== 'undefined' ? window.location.hash : '',
): string {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const hashParams = new URLSearchParams((hash.startsWith('#') ? hash.slice(1) : hash));
  return String(hashParams.get('type') || query.get('type') || '').trim().toLowerCase();
}

/** Forgot-password and first-time invite links should show the password form. */
export function isPasswordResetAuthType(type: string): boolean {
  return type === 'recovery' || type === 'invite';
}

/** Email confirmation and magic links should sign the user in, not ask for a password. */
export function isSignInAuthType(type: string): boolean {
  return type === 'signup' || type === 'email' || type === 'email_change' || type === 'magiclink';
}

export function authCallbackLocation(search = '', hash = ''): string {
  return `/auth/callback${search || ''}${hash || ''}`;
}
