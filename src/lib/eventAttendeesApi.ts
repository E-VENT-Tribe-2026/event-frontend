/**
 * Attendees of an event for the event details page (backend #187), read through the
 * client-side cache (participant data: TTL.SHORT).
 *
 * Keys start with "/api/participants/<event id>" so the page's existing invalidations after a
 * join, leave or removal clear them, and they carry the signed-in user's token suffix because
 * "is_friend" and the friends list differ for each user.
 */
import { getApiUrl } from '@/lib/api';
import { cachedFetch, TTL } from '@/lib/queryCache';
import type { UserSummary } from '@/lib/friendsApi';

/** One participant row. `user` is the shared user summary; `is_friend` marks the viewer's friends. */
export type ParticipantRow = {
  user_id: string;
  status?: string;
  profiles?: { full_name?: string; avatar_url?: string; username?: string } | null;
  user?: UserSummary;
  is_friend?: boolean;
};

const scopeOf = (token: string | null) => (token ?? '').slice(-16);

async function getJson<T>(path: string, token: string | null): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(getApiUrl(path), { headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return (await res.json()) as T;
}

/** Number of attendees: open to every signed-in user. */
export function fetchParticipantCount(eventId: string, token: string | null): Promise<number> {
  const path = `/api/participants/${eventId}/participants/count`;
  return cachedFetch(
    `${path}:${scopeOf(token)}`,
    async () => {
      const body = await getJson<{ count?: number }>(path, token);
      return typeof body.count === 'number' ? body.count : 0;
    },
    TTL.SHORT,
  );
}

/** The attendees who are friends of the signed-in user: open to every signed-in user. */
export function fetchFriendsAttending(eventId: string, token: string | null): Promise<ParticipantRow[]> {
  const path = `/api/participants/${eventId}/participants/friends`;
  return cachedFetch(
    `${path}:${scopeOf(token)}`,
    async () => {
      const body = await getJson<unknown>(path, token);
      return Array.isArray(body) ? (body as ParticipantRow[]) : [];
    },
    TTL.SHORT,
  );
}

/** The full list, each row marked with is_friend: only for the organizer, participants and admins. */
export function fetchParticipantList(eventId: string, token: string | null): Promise<ParticipantRow[]> {
  const path = `/api/participants/${eventId}/participants`;
  return cachedFetch(
    `${path}:${scopeOf(token)}`,
    async () => {
      const body = await getJson<unknown>(path, token);
      return Array.isArray(body) ? (body as ParticipantRow[]) : [];
    },
    TTL.SHORT,
  );
}
