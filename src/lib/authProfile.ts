import { getApiUrl } from '@/lib/api';

/** Resolve the real Supabase user id from the API (login/register responses do not include `user`). */
export async function fetchAuthUserFromToken(
  accessToken: string,
): Promise<{ id: string; email?: string } | null> {
  try {
    const res = await fetch(getApiUrl('/api/auth/me'), {
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const me = (await res.json().catch(() => null)) as { id?: unknown; email?: unknown } | null;
    if (!me || typeof me.id !== 'string' || !me.id.trim()) return null;
    return {
      id: me.id.trim(),
      email: typeof me.email === 'string' ? me.email : undefined,
    };
  } catch {
    return null;
  }
}

/** Case-insensitive UUID/string compare for organizer vs auth id. */
export function sameAuthUserId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}
