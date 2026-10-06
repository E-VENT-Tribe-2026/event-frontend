import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';

/**
 * Admin sign-in verification (TOTP / authenticator app). */

export type AdminAuthStatus = {
  role?: string;
  is_admin?: boolean;
  has_mfa_linked?: boolean;
  is_verified?: boolean;
  factor_id?: string;
};

/** True exactly when the account must complete the verification step before continuing. */
export function needsAdminVerification(status: AdminAuthStatus): boolean {
  return Boolean(status.is_admin) && status.is_verified !== true;
}

export type PendingAdminVerification = {
  /** The aal1 access token from /login or OAuth — used to call enroll/verify. */
  accessToken: string;
  hasMfaLinked: boolean;
  factorId?: string;
};

const PENDING_KEY = 'event_pending_admin_verification';

/** Session-scoped (not localStorage) so it clears exactly when the auth token does. */
export function setPendingAdminVerification(data: PendingAdminVerification) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
}

export function getPendingAdminVerification(): PendingAdminVerification | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const token = typeof parsed?.accessToken === 'string' && parsed.accessToken.trim()
      ? parsed.accessToken.trim()
      : getAuthToken()?.trim() || '';
    if (parsed && token) {
      return {
        accessToken: token,
        hasMfaLinked: Boolean(parsed.hasMfaLinked),
        factorId: typeof parsed.factorId === 'string' && parsed.factorId.trim() ? parsed.factorId.trim() : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingAdminVerification() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_KEY);
}

/** Scenario F: used for the Google OAuth path, which never calls /api/auth/login. */
export async function fetchMfaStatus(token: string): Promise<AdminAuthStatus | null> {
  try {
    const res = await fetch(getApiUrl('/api/auth/mfa/status'), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as AdminAuthStatus;
  } catch {
    return null;
  }
}

export type MfaEnrollResult = {
  factor_id: string;
  totp: { qr_code: string; secret: string; uri: string };
};

/** Scenario B, Step 2 — only called when has_mfa_linked is false. */
export async function enrollMfa(token: string): Promise<MfaEnrollResult | { error: string }> {
  const effectiveToken = token?.trim() || getAuthToken()?.trim() || '';
  if (!effectiveToken) {
    return { error: 'Authentication required. Please sign in again.' };
  }
  try {
    const res = await fetch(getApiUrl('/api/auth/mfa/enroll'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${effectiveToken}`, Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: String(data?.detail || 'Could not start enrollment. Please try again.') };
    }
    return data as MfaEnrollResult;
  } catch {
    return { error: 'Connection failed. Please try again.' };
  }
}

export type MfaVerifyResult = {
  accessToken: string;
};

/** Scenarios B/C/D — verify the 6-digit code and get the upgraded aal2 token. */
export async function verifyMfaCode(
  token: string,
  code: string,
  factorId?: string,
): Promise<MfaVerifyResult | { error: string }> {
  const effectiveToken = token?.trim() || getAuthToken()?.trim() || '';
  if (!effectiveToken) {
    return { error: 'Authentication required. Please sign in again.' };
  }
  try {
    const body: Record<string, string> = { code };
    if (factorId) body.factor_id = factorId;
    const res = await fetch(getApiUrl('/api/auth/mfa/verify'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: String(data?.detail || 'Invalid code. Please try again.') };
    }
    const accessToken = typeof data.access_token === 'string' ? data.access_token : '';
    if (!accessToken) {
      return { error: 'Verified but no session token was returned. Please try signing in again.' };
    }
    return { accessToken };
  } catch {
    return { error: 'Connection failed. Please try again.' };
  }
}
