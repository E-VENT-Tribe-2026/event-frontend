import { clearAuthUserCache } from './authProfile';
import { clearSessionUserSnapshot } from './storage';

const AUTH_TOKEN_KEY = 'event_auth_token';

/** Fired whenever the app token is set or cleared (login, logout, boot). */
export const AUTH_TOKEN_EVENT = 'eventapp:auth-token';

function notifyAuthTokenChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_TOKEN_EVENT));
  }
}

let authToken: string | null =
  typeof window !== 'undefined' ? window.sessionStorage.getItem(AUTH_TOKEN_KEY) : null;

export function setAuthToken(token: string | null) {
  clearAuthUserCache();
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }
  notifyAuthTokenChanged();
}

export function getAuthToken(): string | null {
  return authToken;
}

export function clearAuthToken() {
  clearAuthUserCache();
  authToken = null;
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    window.sessionStorage.removeItem('event_pending_admin_verification');
    clearSessionUserSnapshot();
  }
  notifyAuthTokenChanged();
  void import('./supabase')
    .then((m) => m.clearSupabaseSession?.())
    .catch(() => {});
}

/** Fired by any API layer that receives a 401. SessionGuard listens and logs the user out. */
export const AUTH_EXPIRED_EVENT = 'eventapp:auth-expired';

export function notifyAuthExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}


