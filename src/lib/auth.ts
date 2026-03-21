import { clearSessionUserSnapshot } from './storage';

const AUTH_TOKEN_KEY = 'event_auth_token';

let authToken: string | null =
  typeof window !== 'undefined' ? window.sessionStorage.getItem(AUTH_TOKEN_KEY) : null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    clearSessionUserSnapshot();
  }
}


