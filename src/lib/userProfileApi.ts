/**
 * Another user's profile (7.2 Profile Privacy and Blocking).
 *
 * GET /api/profile/{user_id} returns only the parts this viewer may see: a part the
 * viewer may not see is left out of the response, so the screen shows what is there
 * and never applies the visibility rules itself.
 *
 * Backend contract:
 * - GET /api/profile/{user_id}                     profile with the allowed parts only;
 *       403/404 when the profile is unavailable (owner blocked the viewer, account
 *       suspended, administrator, or no such user)
 * - GET /api/profile/{user_id}/friends?page&limit  that user's friends (UserSummary), in pages
 * - PUT /api/profile/me  { visibility }            'public' | 'friends_only'
 *
 * Friendship and block actions live in the shared friendsApi.
 */
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { cachedFetch, TTL } from '@/lib/queryCache';
import { parseFriendsError, type Page, type UserSummary } from '@/lib/friendsApi';

export type FriendshipStatus = 'none' | 'friends' | 'request_sent' | 'request_received' | 'self' | 'blocked';

export type Friendship = {
  status: FriendshipStatus;
  /** Set for pending requests: needed to cancel, accept or decline. */
  request_id: number | null;
};

/** A group holds only the lists the viewer may see; a missing list is not shown. */
export type ProfileEventGroup = {
  upcoming?: Array<Record<string, unknown>>;
  past?: Array<Record<string, unknown>>;
};

export type ProfileVisibility = 'public' | 'friends_only';

export type UserProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url: string | null;
  avatar_kind: 'photo' | 'icon' | string | null;
  icon_id: string | null;
  banner_url?: string | null;
  bio?: string | null;
  interests?: string[] | null;
  /** Left out when the viewer may not see any events. */
  events?: { organized?: ProfileEventGroup; joined?: ProfileEventGroup } | null;
  /** First page of this user's friends; left out when the viewer may not see them. */
  friends?: UserSummary[];
  /** True when the viewer has blocked this user. */
  blocked_by_me?: boolean;
  friendship?: Friendship | null;
};

export const PROFILE_UNAVAILABLE_MESSAGE = 'This profile is unavailable';

/** Profile endpoints use a plain-string `detail` (403 private) or `{ code }` (404 unavailable). */
export class ProfileLoadError extends Error {
  status: number;
  code: string | null;
  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = 'ProfileLoadError';
    this.status = status;
    this.code = code;
  }
}

function parseProfileLoadError(status: number, body: unknown): ProfileLoadError {
  const rec = (body ?? {}) as { detail?: unknown; code?: unknown };
  const detail = rec.detail;
  let code = typeof rec.code === 'string' ? rec.code : null;
  let message = 'Could not load this profile.';

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const d = detail as { code?: unknown; message?: unknown };
    if (typeof d.code === 'string') code = d.code;
    if (typeof d.message === 'string' && d.message.trim()) message = d.message;
  } else if (typeof detail === 'string' && detail.trim()) {
    message = detail;
    if (detail === 'profile_unavailable') code = 'profile_unavailable';
  }

  if (code === 'profile_unavailable' || status === 404) {
    return new ProfileLoadError(PROFILE_UNAVAILABLE_MESSAGE, status, code ?? 'profile_unavailable');
  }
  return new ProfileLoadError(message, status, code);
}

/** The backend answers 403 or 404 when the viewer cannot see the profile at all. */
export function isProfileUnavailable(error: unknown): boolean {
  return error instanceof ProfileLoadError && (error.status === 403 || error.status === 404);
}

/** Visibility as the profile editor shows it; the legacy "private" value reads as friends only. */
export function toProfileVisibility(value: unknown): ProfileVisibility {
  return value === 'friends_only' || value === 'private' ? 'friends_only' : 'public';
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const res = await fetch(getApiUrl(`/api/profile/${encodeURIComponent(userId)}`), { headers: authHeaders() });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw parseProfileLoadError(res.status, body);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw parseProfileLoadError(500, { detail: 'Could not load this profile.' });
  }
  const root = body as Record<string, unknown>;
  const inner = [root.data, root.user, root.profile, root].find(
    (value) => value && typeof value === 'object' && !Array.isArray(value),
  );
  return (inner || root) as UserProfile;
}

function cacheScope(): string {
  return (getAuthToken() ?? '').slice(-16);
}

/**
 * A page of another user's friends. Cached per signed-in user under the friends
 * prefix, so any friendship or block change (which clears '/api/friends') refreshes it.
 */
export function fetchUserFriends(userId: string, page = 1, limit = 20): Promise<Page<UserSummary>> {
  const path = `/api/profile/${encodeURIComponent(userId)}/friends?page=${page}&limit=${limit}`;
  return cachedFetch(
    `/api/friends:${cacheScope()}:${path}`,
    async () => {
      const res = await fetch(getApiUrl(path), { headers: authHeaders() });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw parseFriendsError(res.status, body);
      const p = (body ?? {}) as Partial<Page<UserSummary>>;
      return {
        page: p.page ?? page,
        limit: p.limit ?? limit,
        has_more: Boolean(p.has_more),
        data: Array.isArray(p.data) ? p.data : [],
      };
    },
    TTL.MEDIUM,
  );
}
