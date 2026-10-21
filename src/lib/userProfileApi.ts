/**
 * Another user's profile (7.2 Profile Privacy and Blocking).
 *
 * GET /api/profile/{user_id} returns only the parts this viewer may see: a part the
 * viewer may not see is left out of the response, so the screen shows what is there
 * and never applies the visibility rules itself.
 *
 * Expected backend contract:
 * - GET    /api/profile/{user_id}                  profile with the allowed parts only;
 *          403/404 when the profile is unavailable (owner blocked the viewer, account
 *          suspended, administrator, or no such user)
 * - GET    /api/profile/{user_id}/friends?page&limit  that user's friends (UserSummary), in pages
 * - GET    /api/blocks?page&limit                  users the signed-in user blocked, in pages
 * - POST   /api/blocks  { user_id }                block a user
 * - DELETE /api/blocks/{user_id}                   unblock a user
 * - PUT    /api/profile/me  { visibility }         'public' | 'friends_only'
 *
 * Friendship actions live in the shared friendsApi.
 */
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { cachedFetch, invalidatePrefix, TTL } from '@/lib/queryCache';
import { FRIENDS_CHANGED_EVENT, parseFriendsError, type Page, type UserSummary } from '@/lib/friendsApi';

export type FriendshipStatus = 'none' | 'friends' | 'request_sent' | 'request_received' | 'self';

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
  events?: { organized?: ProfileEventGroup; joined?: ProfileEventGroup };
  /** First page of this user's friends; left out when the viewer may not see them. */
  friends?: UserSummary[];
  /** True when the viewer has blocked this user. */
  blocked_by_me?: boolean;
  friendship?: Friendship;
};

/** A user the signed-in user blocked. */
export type BlockedUserItem = { blocked_at: string; user: UserSummary };

export const PROFILE_UNAVAILABLE_MESSAGE = 'This profile is unavailable';

/** Profile endpoints use a plain-string `detail`. */
export class ProfileLoadError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ProfileLoadError';
    this.status = status;
  }
}

/** The backend answers 403 or 404 when the viewer cannot see the profile at all. */
export function isProfileUnavailable(error: unknown): boolean {
  return error instanceof ProfileLoadError && (error.status === 403 || error.status === 404);
}

/** Visibility as the profile editor shows it; anything that is not public is friends only. */
export function toProfileVisibility(value: unknown): ProfileVisibility {
  return value === 'public' ? 'public' : 'friends_only';
}

function authHeaders(json = false): Record<string, string> {
  const token = getAuthToken();
  return {
    Accept: 'application/json',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const res = await fetch(getApiUrl(`/api/profile/${encodeURIComponent(userId)}`), { headers: authHeaders() });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail;
    throw new ProfileLoadError(typeof detail === 'string' ? detail : 'Could not load this profile.', res.status);
  }
  return body as UserProfile;
}

function cacheScope(): string {
  return (getAuthToken() ?? '').slice(-16);
}

/**
 * A page of another user's friends. Cached per signed-in user under the friends
 * prefix, so any friendship change (which clears '/api/friends') refreshes it.
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

/** Users the signed-in user blocked, cached per signed-in user until a block or unblock. */
export function fetchBlockedUsers(page = 1, limit = 20): Promise<Page<BlockedUserItem>> {
  const path = `/api/blocks?page=${page}&limit=${limit}`;
  return cachedFetch(
    `/api/blocks:${cacheScope()}:${path}`,
    async () => {
      const res = await fetch(getApiUrl(path), { headers: authHeaders() });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw parseFriendsError(res.status, body);
      const p = (body ?? {}) as Partial<Page<BlockedUserItem>>;
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

/** Blocking ends friendships and requests, so the blocks, friends and profile caches are cleared. */
function onBlockChanged(): void {
  invalidatePrefix('/api/blocks');
  invalidatePrefix('/api/friends');
  invalidatePrefix('/api/profile');
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(FRIENDS_CHANGED_EVENT));
}

export async function blockUser(userId: string): Promise<void> {
  const res = await fetch(getApiUrl('/api/blocks'), {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw parseFriendsError(res.status, await res.json().catch(() => null));
  onBlockChanged();
}

export async function unblockUser(userId: string): Promise<void> {
  const res = await fetch(getApiUrl(`/api/blocks/${encodeURIComponent(userId)}`), {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw parseFriendsError(res.status, await res.json().catch(() => null));
  onBlockChanged();
}
