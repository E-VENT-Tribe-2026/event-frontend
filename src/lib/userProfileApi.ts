/**
 * GET /api/profile/{user_id}: another user's profile, events and friendship state.
 * Friendship actions live in the shared friendsApi.
 */
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';

export type FriendshipStatus = 'none' | 'friends' | 'request_sent' | 'request_received' | 'self' | 'blocked';

export type Friendship = {
  status: FriendshipStatus;
  /** Set for pending requests: needed to cancel, accept or decline. */
  request_id: number | null;
};

export type ProfileEventGroup = {
  upcoming: Array<Record<string, unknown>>;
  past: Array<Record<string, unknown>>;
};

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
  events?: { organized: ProfileEventGroup; joined: ProfileEventGroup } | null;
  friendship?: Friendship | null;
  blocked_by_me?: boolean;
};

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
    return new ProfileLoadError('This user could not be found.', status, code ?? 'profile_unavailable');
  }
  return new ProfileLoadError(message, status, code);
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(`/api/profile/${encodeURIComponent(userId)}`), {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw parseProfileLoadError(res.status, body);
  return body as UserProfile;
}
