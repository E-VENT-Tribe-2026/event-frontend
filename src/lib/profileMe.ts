import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { getAuthToken } from '@/lib/auth';
import { cachedFetch, TTL } from '@/lib/queryCache';
import { getCurrentUser, setCurrentUserFromOAuth, updateUser } from '@/lib/storage';
import { profileFromMeResponse } from '@/lib/username';

export class ProfileMeError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`profile/me ${status}`);
    this.name = 'ProfileMeError';
    this.status = status;
    this.body = body;
  }
}

export function profileMeCacheKey(token: string | null = getAuthToken()): string | null {
  if (!token) return null;
  return `/api/profile/me:${token.slice(-16)}`;
}

/** Shared GET /api/profile/me. One network call is reused across chrome and pages. */
export async function fetchMyProfile(token: string | null = getAuthToken()): Promise<unknown> {
  if (!token) throw new ProfileMeError(401, null);
  const key = profileMeCacheKey(token);
  if (!key) throw new ProfileMeError(401, null);
  return cachedFetch(
    key,
    async () => {
      const res = await fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new ProfileMeError(res.status, body);
      return body;
    },
    TTL.SESSION,
    true,
  );
}

/** Copy profile/me into the session user. Returns false when nothing changed. */
export function applyMyProfileToSession(body: unknown): boolean {
  const profile = profileFromMeResponse(body);
  if (!profile.id) return false;
  const current = getCurrentUser();
  const name = String(profile.full_name || profile.name || current?.name || '');
  const avatar = String(profile.avatar_url || current?.avatar || '');
  const email =
    typeof profile.email === 'string' && profile.email.trim()
      ? profile.email.trim()
      : current?.email || '';
  const username =
    typeof profile.username === 'string' && profile.username.trim()
      ? profile.username.trim()
      : current?.username || '';
  const bio = String(profile.bio ?? current?.bio ?? '');
  const interests = Array.isArray(profile.interests)
    ? (profile.interests as string[])
    : current?.interests ?? [];

  const unchanged = Boolean(
    current &&
      current.id === String(profile.id) &&
      current.name === name &&
      current.avatar === avatar &&
      current.email === email &&
      current.username === username &&
      (current.bio || '') === bio &&
      JSON.stringify(current.interests || []) === JSON.stringify(interests),
  );
  if (unchanged) return false;

  if (current) {
    updateUser({
      name,
      ...(email ? { email } : {}),
      ...(username ? { username } : {}),
      avatar,
      profilePhoto: avatar,
      bio,
      interests,
    });
  } else if (email) {
    setCurrentUserFromOAuth({
      id: String(profile.id),
      email,
      name,
      username: username || undefined,
      avatar,
      bio,
      interests,
    });
  } else {
    return false;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eventapp:user-updated'));
  }
  return true;
}
