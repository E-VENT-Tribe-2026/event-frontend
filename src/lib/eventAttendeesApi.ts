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

/** Accept a raw array or a wrapped `{ data | friends | participants }` payload. */
export function parseParticipantRows(body: unknown): ParticipantRow[] {
  if (Array.isArray(body)) return body as ParticipantRow[];
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    for (const key of ['data', 'friends', 'participants', 'items', 'results', 'users']) {
      if (Array.isArray(obj[key])) return obj[key] as ParticipantRow[];
    }
  }
  return [];
}

function nestedUser(row: ParticipantRow): UserSummary | Record<string, unknown> | null {
  if (row.user && typeof row.user === 'object') return row.user;
  const extra = row as ParticipantRow & { friend?: unknown };
  if (extra.friend && typeof extra.friend === 'object') return extra.friend as Record<string, unknown>;
  return null;
}

export function participantRowToSummary(row: ParticipantRow): UserSummary | null {
  const extra = row as ParticipantRow & Record<string, unknown>;
  const nested = nestedUser(row);
  const p = row.profiles;
  const nestedRec = nested as Record<string, unknown> | null;
  const id = String(
    row.user_id || extra.userId || extra.profile_id || extra.participant_id || nestedRec?.id || extra.id || '',
  ).trim();
  if (!id) return null;
  const u = (nested as UserSummary | null) ?? null;
  const username =
    (typeof u?.username === 'string' ? u.username : null) ??
    (typeof p?.username === 'string' ? p.username : null);
  const fullName =
    (typeof u?.full_name === 'string' ? u.full_name : null) ??
    (typeof p?.full_name === 'string' ? p.full_name : null) ??
    (typeof extra.name === 'string' ? extra.name : null);
  return {
    id,
    username,
    full_name: fullName,
    display_name: String(u?.display_name || fullName || username || 'Friend'),
    avatar_kind: u?.avatar_kind ?? (typeof extra.avatar_kind === 'string' ? extra.avatar_kind : null),
    icon_id: u?.icon_id ?? (typeof extra.icon_id === 'string' ? extra.icon_id : null),
    avatar_url:
      u?.avatar_url ??
      (typeof p?.avatar_url === 'string' ? p.avatar_url : null) ??
      (typeof extra.avatar_url === 'string' ? extra.avatar_url : null),
  };
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
      return parseParticipantRows(body);
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
      return parseParticipantRows(body);
    },
    TTL.SHORT,
  );
}
