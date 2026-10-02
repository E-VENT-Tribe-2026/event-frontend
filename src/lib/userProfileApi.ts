/**
 * GET /api/profile/{user_id}: another user's profile, events and friendship state.
 * Friendship actions live in the shared friendsApi.
 */
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';

export type FriendshipStatus = 'none' | 'friends' | 'request_sent' | 'request_received' | 'self';

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
  avatar_url?: string | null;
  avatar_kind?: 'photo' | 'icon' | null;
  icon_id?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  interests?: string[] | null;
  events: { organized: ProfileEventGroup; joined: ProfileEventGroup };
  friendship: Friendship;
};

/** Profile endpoints use a plain-string `detail` (403 private, 404 not found). */
export class ProfileLoadError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ProfileLoadError';
    this.status = status;
  }
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(`/api/profile/${encodeURIComponent(userId)}`), {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail;
    throw new ProfileLoadError(typeof detail === 'string' ? detail : 'Could not load this profile.', res.status);
  }
  return body as UserProfile;
}
