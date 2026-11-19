import { getApiUrl } from './api';
import { API_ENDPOINTS } from './apiUrls';
import { sanitizeEmail } from './sanitize';

export type VerifiedSignupInvite = {
  code: string;
  email: string;
};

/** Codes are issued as ABCD-2345 and expire after 7 days. */
export function normalizeInviteCode(raw: string): string {
  const compact = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
  if (compact.length <= 4) return compact;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export function isInviteCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}

function errorFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const row = body as Record<string, unknown>;
  const detail = row.detail ?? row.message ?? row.error;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string };
    if (typeof first?.msg === 'string' && first.msg.trim()) return first.msg.trim();
  }
  return fallback;
}

export async function verifySignupInvite(rawEmail: string, rawCode: string): Promise<VerifiedSignupInvite> {
  const email = sanitizeEmail(rawEmail);
  const invite_code = normalizeInviteCode(rawCode);
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    throw new Error('Enter the email the invitation was sent to.');
  }
  if (!isInviteCodeFormat(invite_code)) {
    throw new Error('Enter the invitation code from your email (for example ABCD-2345).');
  }

  const res = await fetch(getApiUrl(API_ENDPOINTS.SIGNUP_INVITE_VERIFY), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, invite_code }),
  });
  const data = await res.json().catch(() => ({}));
  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const nested = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : row;

  if (!res.ok) {
    throw new Error(errorFromBody(data, 'This invitation is not valid or has expired.'));
  }
  if (nested.valid !== true) {
    throw new Error(errorFromBody(data, 'This invitation is not valid or has expired.'));
  }

  const confirmedEmail =
    typeof nested.email === 'string' && nested.email.includes('@') ? sanitizeEmail(nested.email) : email;
  const confirmedCode =
    typeof nested.invite_code === 'string' && isInviteCodeFormat(normalizeInviteCode(nested.invite_code))
      ? normalizeInviteCode(nested.invite_code)
      : invite_code;

  return { email: confirmedEmail, code: confirmedCode };
}
