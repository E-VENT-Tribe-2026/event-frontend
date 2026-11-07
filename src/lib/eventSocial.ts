import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { fetchFriends, type UserSummary } from '@/lib/friendsApi';
import { cachedFetch, TTL } from '@/lib/queryCache';

export type EventParticipant = {
  user_id: string;
  status?: string;
  profiles?: { full_name?: string; username?: string; avatar_url?: string };
};

function cacheScope(): string {
  return (getAuthToken() ?? '').slice(-16);
}

function rowsFrom(body: unknown, keys: string[]): unknown[] {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== 'object') return [];
  const obj = body as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

export function parseFriendsList(body: unknown): UserSummary[] {
  const rows = rowsFrom(body, ['data', 'friends', 'results', 'items']);
  const users: UserSummary[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const nested =
      (r.user && typeof r.user === 'object' ? (r.user as Record<string, unknown>) : null) ||
      (r.friend && typeof r.friend === 'object' ? (r.friend as Record<string, unknown>) : null);
    const u = nested || r;
    const id = String(u.id || r.friend_id || r.user_id || '').trim();
    if (!id || seen.has(id.toLowerCase())) continue;
    seen.add(id.toLowerCase());
    users.push({
      id,
      username: typeof u.username === 'string' ? u.username : null,
      full_name: typeof u.full_name === 'string' ? u.full_name : typeof u.name === 'string' ? u.name : null,
      display_name: String(u.display_name || u.full_name || u.name || u.username || 'Friend'),
      avatar_kind: typeof u.avatar_kind === 'string' ? u.avatar_kind : null,
      icon_id: typeof u.icon_id === 'string' ? u.icon_id : null,
      avatar_url: typeof u.avatar_url === 'string' ? u.avatar_url : null,
    });
  }
  return users;
}

export async function fetchAllFriends(): Promise<UserSummary[]> {
  if (!getAuthToken()) return [];
  try {
    const users: UserSummary[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 6) {
      const res = await fetchFriends(page, 50);
      const batch = parseFriendsList(res);
      users.push(...batch);
      hasMore = Boolean(res?.has_more) && batch.length > 0;
      page += 1;
    }
    return users;
  } catch {
    return [];
  }
}

export function parseParticipants(body: unknown): EventParticipant[] {
  const rows = rowsFrom(body, ['data', 'participants', 'users', 'items', 'results']);
  const out: EventParticipant[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const nested = o.user && typeof o.user === 'object' ? (o.user as Record<string, unknown>) : null;
    const userId = String(
      o.user_id || o.userId || o.profile_id || o.participant_id || nested?.id || o.id || '',
    ).trim();
    if (!userId) continue;
    const status = typeof o.status === 'string' ? o.status : 'going';
    const profiles = (o.profiles || nested) as EventParticipant['profiles'];
    out.push({ user_id: userId, status, profiles });
  }
  return out;
}

export function goingParticipantIds(list: EventParticipant[]): string[] {
  return list
    .filter((p) => String(p.status || 'going').toLowerCase() !== 'removed')
    .map((p) => p.user_id);
}

export async function fetchEventParticipants(eventId: string): Promise<EventParticipant[]> {
  const token = getAuthToken();
  if (!token || !eventId) return [];
  try {
    return await cachedFetch(
      `/api/participants/${eventId}/participants:${cacheScope()}`,
      async () => {
        const res = await fetch(getApiUrl(`/api/participants/${eventId}/participants`), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) throw new Error('participants failed');
        return parseParticipants(await res.json().catch(() => []));
      },
      TTL.SHORT,
    );
  } catch {
    return [];
  }
}

export function friendsGoingToEvent(friends: UserSummary[], participantIds: Iterable<string>): UserSummary[] {
  const going = new Set(Array.from(participantIds).map((id) => id.trim().toLowerCase()));
  if (going.size === 0) return [];
  const seen = new Set<string>();
  const matched: UserSummary[] = [];
  for (const friend of friends) {
    const id = friend.id?.trim().toLowerCase();
    if (!id || seen.has(id) || !going.has(id)) continue;
    seen.add(id);
    matched.push(friend);
  }
  return matched;
}

export function friendsGoingLabel(friends: UserSummary[]): string {
  if (friends.length === 0) return '';
  const nameOf = (u: UserSummary) => u.full_name || u.display_name || u.username || 'A friend';
  if (friends.length === 1) return `${nameOf(friends[0])} is going`;
  if (friends.length === 2) return `${nameOf(friends[0])} and ${nameOf(friends[1])} are going`;
  return `${nameOf(friends[0])} and ${friends.length - 1} friends are going`;
}
