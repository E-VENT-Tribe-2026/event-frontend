/**
 * Event invitations API (backend #186): the "Invite friends" window and sending an invitation.
 *
 * Errors reuse the friendship error shape ({detail: {code, message}}), so a refused
 * action throws FriendsApiError with the backend's sentence ready to show.
 */
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { cachedFetch, invalidatePrefix, TTL } from '@/lib/queryCache';
import { parseFriendsError, type Page, type UserSummary } from '@/lib/friendsApi';

/** State of a friend in the "Invite friends" window. */
export type InviteStatus = 'can_invite' | 'invited' | 'attending' | 'unavailable';

export type InvitableFriend = {
  user: UserSummary;
  invite_status: InviteStatus;
  can_invite: boolean;
};

/** Added to an event's details for the signed-in user. */
export type EventInvitationSummary = {
  invited: boolean;
  invited_by: UserSummary | null;
  other_inviters_count: number;
};

export type SentInvitation = {
  invitation_id: number;
  event_id: string;
  created_at: string;
  user: UserSummary;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(getApiUrl(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw parseFriendsError(res.status, body);
  return body as T;
}

const eventPrefix = (eventId: string) => `/api/invitations/events/${eventId}`;

/** Friends for the invite window, searchable by username. Cached per signed-in user. */
export function fetchInvitableFriends(
  eventId: string,
  search: string,
  page = 1,
  limit = 20,
): Promise<Page<InvitableFriend>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) params.set('search', search.trim());
  const path = `${eventPrefix(eventId)}/friends?${params.toString()}`;
  const scope = (getAuthToken() ?? '').slice(-16);
  return cachedFetch(`${eventPrefix(eventId)}:${scope}:${params.toString()}`, () => request<Page<InvitableFriend>>(path), TTL.SHORT);
}

/** Invite one friend; clears the cached invite lists of this event. */
export async function sendInvitation(eventId: string, inviteeId: string): Promise<SentInvitation> {
  const res = await request<SentInvitation>('/api/invitations', {
    method: 'POST',
    body: JSON.stringify({ event_id: eventId, invitee_id: inviteeId }),
  });
  invalidatePrefix(eventPrefix(eventId));
  return res;
}
