import { getApiUrl } from '@/lib/api';

type AuthUser = { id: string; email?: string };

let authUserCache: { token: string; user: AuthUser } | null = null;

export function clearAuthUserCache() {
  authUserCache = null;
}

/** Resolve the real Supabase user id from the API (login/register responses do not include `user`). */
export async function fetchAuthUserFromToken(
  accessToken: string,
): Promise<AuthUser | null> {
  const token = accessToken.trim();
  if (authUserCache && authUserCache.token === token) return authUserCache.user;
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
    const user: AuthUser = {
      id: me.id.trim(),
      email: typeof me.email === 'string' ? me.email : undefined,
    };
    authUserCache = { token, user };
    return user;
  } catch {
    return null;
  }
}

/** Case-insensitive UUID/string compare for organizer vs auth id. */
export function sameAuthUserId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}
