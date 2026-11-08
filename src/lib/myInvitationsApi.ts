/**
 * The signed-in user's own invitations (backend #186): the Invitations tab on the profile.
 *
 * Reads go through the client-side cache (keyed per signed-in user); dismissing clears it.
 * Errors reuse the friendship error shape ({detail: {code, message}}), so a refused
 * action throws FriendsApiError with the backend's sentence ready to show.
 */
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { parseFriendsError, type UserSummary } from '@/lib/friendsApi';
import { cachedFetch, invalidatePrefix, TTL } from '@/lib/queryCache';

export type MyInvitation = {
  invitation_id: number;
  created_at: string;
  inviter: UserSummary;
  event: { id: string; title: string | null; start_datetime: string | null };
};

export type MyInvitationPage = {
  page: number;
  limit: number;
  has_more: boolean;
  /** Total number of invitations, for the tab's counter. */
  total: number;
  data: MyInvitation[];
};

export const MY_INVITATIONS_PAGE_SIZE = 20;

/** Fired after an invitation is dismissed so every open view of the list updates. */
export const INVITATION_DISMISSED_EVENT = 'eventapp:invitation-dismissed';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(path), {
    ...init,
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw parseFriendsError(res.status, body);
  return body as T;
}

export function fetchMyInvitations(page = 1, limit = MY_INVITATIONS_PAGE_SIZE): Promise<MyInvitationPage> {
  const path = `/api/invitations?page=${page}&limit=${limit}`;
  const scope = (getAuthToken() ?? '').slice(-16);
  return cachedFetch(`/api/invitations:${scope}:${page}:${limit}`, () => request<MyInvitationPage>(path), TTL.SHORT);
}

/** Dismiss an invitation the user received; clears the cached list. */
export async function dismissInvitation(invitationId: number): Promise<void> {
  await request<{ message: string }>(`/api/invitations/${invitationId}`, { method: 'DELETE' });
  invalidatePrefix('/api/invitations');
  // The invitation notification goes stale too.
  invalidatePrefix('/api/notifications');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(INVITATION_DISMISSED_EVENT, { detail: { id: invitationId } }));
  }
}
