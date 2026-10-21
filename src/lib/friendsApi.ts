/**
 * Friendship API client (backend #146 friend requests, #147 friends list + user search).
 *
 * Shared by the Friends tab and the other-user profile page. Reads go through the
 * client-side query cache, keyed per signed-in user; every mutation invalidates the
 * friendship cache and notifies listeners (e.g. the bottom-nav badge) to refresh.
 */
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { PROFILE_ICONS } from '@/lib/profileAssets';
import { cachedFetch, invalidatePrefix, TTL } from '@/lib/queryCache';
import { queryClient } from '@/lib/queryClient';
import { invalidateNotifications } from '@/lib/queries';

// ── Types ────────────────────────────────────────────────────────────────────

/** UserSummary: the same user object chat messages and participant lists use. */
export type UserSummary = {
  id: string;
  username: string | null;
  full_name: string | null;
  display_name: string;
  avatar_kind: 'photo' | 'icon' | string | null;
  icon_id: string | null;
  avatar_url: string | null;
};

export type FriendItem = { friend_since: string; user: UserSummary };
export type FriendRequestItem = { request_id: number; created_at: string; user: UserSummary };
export type BlockedUserItem = { blocked_at?: string | null; user: UserSummary };

export type Page<T> = { page: number; limit: number; has_more: boolean; data: T[] };

/** Row from GET /api/profile/search; matched on username, shown with the full name. */
export type UserSearchResult = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  avatar_kind: 'photo' | 'icon' | string | null;
  icon_id: string | null;
};

export type FriendshipErrorCode =
  | 'cannot_friend_self'
  | 'user_not_found'
  | 'user_blocked'
  | 'already_friends'
  | 'request_already_sent'
  | 'request_already_received'
  | 'not_request_receiver'
  | 'not_request_sender'
  | 'request_not_found'
  | 'friendship_not_found'
  | string;

/** Error carrying the backend's user-facing reason (detail.message, or a fallback). */
export class FriendsApiError extends Error {
  status: number;
  code: FriendshipErrorCode | null;
  requestId: number | null;

  constructor(message: string, status: number, code: FriendshipErrorCode | null = null, requestId: number | null = null) {
    super(message);
    this.name = 'FriendsApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const FRIENDS_CHANGED_EVENT = 'eventapp:friends-changed';

/** The Friends screen opened on its Requests tab (incoming requests with Accept / Decline). */
export const FRIEND_REQUESTS_PATH = '/friends?tab=incoming';

/** Path of a user's profile page; one's own account opens the Profile tab. */
export function userProfilePath(userId: string, currentUserId?: string | null): string {
  return currentUserId && userId === currentUserId ? '/profile' : `/user/${userId}`;
}

/** Picture for a user: uploaded photo when avatar_kind is "photo", otherwise the icon from the icon set. */
export function userAvatarUrl(user: Pick<UserSummary, 'avatar_kind' | 'icon_id' | 'avatar_url'>): string | null {
  if (user.avatar_kind === 'photo') return user.avatar_url || null;
  const icon = user.icon_id ? PROFILE_ICONS.find((i) => i.id === user.icon_id) : undefined;
  return icon?.url ?? user.avatar_url ?? null;
}

/** Turn any backend error body into a sentence the user can read. */
export function parseFriendsError(status: number, body: unknown): FriendsApiError {
  const detail = (body as { detail?: unknown } | null)?.detail;
  const fallback =
    status === 401 ? 'Your session has expired. Please sign in again.'
    : status === 403 ? 'You cannot send a friend request to this user.'
    : status === 404 ? 'This user could not be found.'
    : status === 422 ? 'The request was not valid. Please try again.'
    : status === 429 ? 'Too many requests. Please wait a moment and try again.'
    : 'Something went wrong. Please try again.';

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const d = detail as { code?: unknown; message?: unknown; request_id?: unknown };
    const code = typeof d.code === 'string' ? d.code : null;
    const rawMessage = typeof d.message === 'string' && d.message.trim() ? d.message : null;
    const message =
      rawMessage
      ?? (code === 'user_blocked' ? 'You cannot send a friend request to this user.' : fallback);
    return new FriendsApiError(
      message,
      status,
      code,
      typeof d.request_id === 'number' ? d.request_id : null,
    );
  }
  if (typeof detail === 'string' && detail.trim()) return new FriendsApiError(detail, status);
  // The rate limiter answers with { error: "Rate limit exceeded: ..." } instead of a detail.
  const error = (body as { error?: unknown } | null)?.error;
  if (status === 429 && typeof error === 'string' && error.trim()) return new FriendsApiError(error, status);
  return new FriendsApiError(fallback, status);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw parseFriendsError(res.status, body);
  return body as T;
}

function cacheScope(): string {
  return (getAuthToken() ?? '').slice(-16);
}

/** Cache key for friendship data of the signed-in user. */
function friendsKey(path: string): string {
  return `/api/friends:${cacheScope()}:${path}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** request_id from a send/cancel payload that may be wrapped or a string. */
export function readRequestId(body: unknown): number | null {
  if (typeof body === 'number' && Number.isFinite(body)) return body;
  const root = asRecord(body);
  if (!root) return null;
  const inner = asRecord(root.data) || root;
  const raw = inner.request_id ?? root.request_id;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
  return null;
}

function readCount(body: unknown): number {
  const root = asRecord(body);
  if (!root) return 0;
  const inner = asRecord(root.data) || root;
  const raw = inner.count ?? root.count;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function onMutated(): void {
  invalidatePrefix('/api/friends');
  invalidatePrefix('/api/blocks');
  invalidatePrefix('/api/profile/search');
  invalidatePrefix('/api/events');
  invalidatePrefix('/api/notifications');
  queryClient.invalidateQueries({ queryKey: ['events'] });
  queryClient.invalidateQueries({ queryKey: ['recommendations'] });
  queryClient.invalidateQueries({ queryKey: ['event'] });
  queryClient.invalidateQueries({ queryKey: ['favorites'] });
  queryClient.invalidateQueries({ queryKey: ['userProfile'] });
  invalidateNotifications();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(FRIENDS_CHANGED_EVENT));
}

// ── Reads (cached) ───────────────────────────────────────────────────────────

export function fetchFriends(page = 1, limit = 20): Promise<Page<FriendItem>> {
  const path = `/api/friends?page=${page}&limit=${limit}`;
  return cachedFetch(friendsKey(path), () => request<Page<FriendItem>>(path), TTL.MEDIUM);
}

export function fetchIncomingRequests(page = 1, limit = 20): Promise<Page<FriendRequestItem>> {
  const path = `/api/friends/requests/incoming?page=${page}&limit=${limit}`;
  return cachedFetch(friendsKey(path), () => request<Page<FriendRequestItem>>(path), TTL.SHORT);
}

export function fetchSentRequests(page = 1, limit = 20): Promise<Page<FriendRequestItem>> {
  const path = `/api/friends/requests/sent?page=${page}&limit=${limit}`;
  return cachedFetch(friendsKey(path), () => request<Page<FriendRequestItem>>(path), TTL.SHORT);
}

export function fetchBlockedUsers(page = 1, limit = 20): Promise<Page<BlockedUserItem>> {
  const path = `/api/blocks?page=${page}&limit=${limit}`;
  return cachedFetch(`/api/blocks:${cacheScope()}:${path}`, () => request<Page<BlockedUserItem>>(path), TTL.MEDIUM);
}

/** Pending incoming requests. Not cached: the badge must be correct on every screen load. */
export async function fetchIncomingRequestCount(): Promise<number> {
  const body = await request<unknown>('/api/friends/requests/count');
  return readCount(body);
}

/** Find a sent request's id when the profile payload omitted it. */
export async function findSentRequestId(userId: string): Promise<number | null> {
  const needle = userId.trim().toLowerCase();
  if (!needle) return null;
  const sent = await fetchSentRequests(1, 50);
  const match = sent.data.find((row) => row.user.id.trim().toLowerCase() === needle);
  return typeof match?.request_id === 'number' ? match.request_id : readRequestId(match);
}

export function searchUsers(q: string, page = 1, limit = 10): Promise<Page<UserSearchResult>> {
  const params = new URLSearchParams({ q, page: String(page), limit: String(limit) });
  const path = `/api/profile/search?${params.toString()}`;
  return cachedFetch(
    `/api/profile/search:${cacheScope()}:${params.toString()}`,
    async () => {
      const body = await request<Partial<Page<UserSearchResult>>>(path);
      return {
        page: body.page ?? page,
        limit: body.limit ?? limit,
        has_more: Boolean(body.has_more),
        data: Array.isArray(body.data) ? body.data : [],
      };
    },
    TTL.MEDIUM,
  );
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function sendFriendRequest(receiverId: string): Promise<FriendRequestItem> {
  const res = await request<FriendRequestItem>('/api/friends/requests', {
    method: 'POST',
    body: JSON.stringify({ receiver_id: receiverId }),
  });
  const request_id = readRequestId(res) ?? res.request_id;
  onMutated();
  return { ...res, request_id };
}

export async function acceptFriendRequest(requestId: number): Promise<FriendItem> {
  const res = await request<FriendItem>(`/api/friends/requests/${requestId}/accept`, { method: 'POST' });
  onMutated();
  return res;
}

export async function declineFriendRequest(requestId: number): Promise<void> {
  await request(`/api/friends/requests/${requestId}/decline`, { method: 'POST' });
  onMutated();
}

export async function cancelFriendRequest(requestId: number): Promise<void> {
  const id = readRequestId(requestId) ?? requestId;
  if (typeof id !== 'number' || !Number.isFinite(id)) {
    throw new FriendsApiError('Friend request not found.', 404, 'request_not_found');
  }
  await request(`/api/friends/requests/${id}`, { method: 'DELETE' });
  onMutated();
}

export async function removeFriend(friendId: string): Promise<void> {
  await request(`/api/friends/${friendId}`, { method: 'DELETE' });
  onMutated();
}

export async function blockUser(userId: string): Promise<BlockedUserItem> {
  const res = await request<BlockedUserItem>('/api/blocks', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
  onMutated();
  return res;
}

export async function unblockUser(userId: string): Promise<void> {
  await request(`/api/blocks/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  onMutated();
}
