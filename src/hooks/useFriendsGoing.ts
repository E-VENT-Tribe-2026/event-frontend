import { useEffect, useMemo, useState } from 'react';
import { AUTH_TOKEN_EVENT, getAuthToken } from '@/lib/auth';
import type { EventItem } from '@/lib/storage';
import { FRIENDS_CHANGED_EVENT, type UserSummary } from '@/lib/friendsApi';
import { fetchAllFriends, fetchEventParticipants, friendsGoingToEvent, goingParticipantIds } from '@/lib/eventSocial';
import { fetchFriendsAttending, participantRowToSummary } from '@/lib/eventAttendeesApi';
import { fetchUserProfile } from '@/lib/userProfileApi';
import { mapApiEventToItem } from '@/lib/mapApiEvent';
import { EVENTS_CHANGED_EVENT } from '@/lib/realtimeEvents';
import { eventStartMs, isEventUpcoming } from '@/lib/eventTime';

const MAX_FRIEND_PROFILES = 50;

type FriendEventRow = { event: EventItem; friends: UserSummary[] };

function upcomingJoinedFromProfile(profile: Awaited<ReturnType<typeof fetchUserProfile>>): Record<string, unknown>[] {
  const rec = profile as typeof profile & {
    joined_events?: { upcoming?: unknown[] };
    events?: { joined?: { upcoming?: unknown[] }; joined_events?: { upcoming?: unknown[] } } | null;
  };
  const lists = [rec.events?.joined?.upcoming, rec.joined_events?.upcoming, rec.events?.joined_events?.upcoming];
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as Record<string, unknown>;
      const id = String(row.id || '').trim().toLowerCase();
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      out.push(row);
    }
  }
  return out;
}

function mergeFriendRows(groups: FriendEventRow[]): FriendEventRow[] {
  const byId = new Map<string, FriendEventRow>();
  for (const row of groups) {
    const existing = byId.get(row.event.id);
    if (!existing) {
      byId.set(row.event.id, { event: row.event, friends: [...row.friends] });
      continue;
    }
    for (const friend of row.friends) {
      const id = friend.id.trim().toLowerCase();
      if (!id || existing.friends.some((f) => f.id.trim().toLowerCase() === id)) continue;
      existing.friends.push(friend);
    }
  }
  return Array.from(byId.values()).sort((a, b) => eventStartMs(a.event) - eventStartMs(b.event));
}

export function useFriendsGoing(eventId: string | undefined) {
  const [friends, setFriends] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId || !getAuthToken()) {
      setFriends((prev) => (prev.length ? [] : prev));
      return;
    }
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      const [allFriends, participants] = await Promise.all([
        fetchAllFriends(),
        fetchEventParticipants(eventId),
      ]);
      if (cancelled) return;
      setFriends(friendsGoingToEvent(allFriends, goingParticipantIds(participants)));
      setLoading(false);
    };
    void load();
    const onChange = () => { void load(); };
    window.addEventListener(FRIENDS_CHANGED_EVENT, onChange);
    window.addEventListener(EVENTS_CHANGED_EVENT, onChange);
    window.addEventListener(AUTH_TOKEN_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(FRIENDS_CHANGED_EVENT, onChange);
      window.removeEventListener(EVENTS_CHANGED_EVENT, onChange);
      window.removeEventListener(AUTH_TOKEN_EVENT, onChange);
    };
  }, [eventId]);

  return { friends, loading };
}

async function eventsFromFriendsProfiles(friends: UserSummary[]): Promise<FriendEventRow[]> {
  const slice = friends.slice(0, MAX_FRIEND_PROFILES);
  const profiles = await Promise.all(
    slice.map(async (friend) => {
      try {
        return { friend, profile: await fetchUserProfile(friend.id) };
      } catch {
        return null;
      }
    }),
  );

  const rows: FriendEventRow[] = [];
  for (const item of profiles) {
    if (!item) continue;
    for (const raw of upcomingJoinedFromProfile(item.profile)) {
      const event = mapApiEventToItem(raw);
      if (!event.id || !isEventUpcoming(event) || String(event.status || '').toLowerCase() === 'cancelled') continue;
      rows.push({ event, friends: [item.friend] });
    }
  }
  return mergeFriendRows(rows);
}

export function useFriendsGoingEvents(events: EventItem[], limit = 24) {
  const withFriends = useMemo(
    () => events.filter((e) => (e.friendsAttendingCount ?? 0) > 0).slice(0, limit),
    [events, limit],
  );
  const key = withFriends.map((e) => e.id).join(',');
  const [rows, setRows] = useState<FriendEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [friendCount, setFriendCount] = useState(0);

  const eventById = useMemo(() => {
    const map = new Map(withFriends.map((e) => [e.id, e]));
    return map;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setRows((prev) => (prev.length ? [] : prev));
      setFriendCount(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      const allFriends = await fetchAllFriends();
      if (cancelled) return;
      setFriendCount(allFriends.length);

      const ids = key.split(',').filter(Boolean);
      const [fromCounts, fromProfiles] = await Promise.all([
        Promise.all(
          ids.map(async (id) => {
            try {
              const attending = await fetchFriendsAttending(id, token);
              const friends = attending
                .map(participantRowToSummary)
                .filter((row): row is UserSummary => Boolean(row));
              const event = eventById.get(id);
              return event ? { event, friends } : null;
            } catch {
              const event = eventById.get(id);
              return event ? { event, friends: [] as UserSummary[] } : null;
            }
          }),
        ).then((rows) => rows.filter(Boolean) as FriendEventRow[]),
        allFriends.length === 0 ? Promise.resolve([] as FriendEventRow[]) : eventsFromFriendsProfiles(allFriends),
      ]);

      if (cancelled) return;
      setRows(mergeFriendRows([...fromCounts, ...fromProfiles]).slice(0, limit));
      setLoading(false);
    };
    void load();
    const onChange = () => { void load(); };
    window.addEventListener(FRIENDS_CHANGED_EVENT, onChange);
    window.addEventListener(EVENTS_CHANGED_EVENT, onChange);
    window.addEventListener(AUTH_TOKEN_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(FRIENDS_CHANGED_EVENT, onChange);
      window.removeEventListener(EVENTS_CHANGED_EVENT, onChange);
      window.removeEventListener(AUTH_TOKEN_EVENT, onChange);
    };
  }, [key, eventById, limit]);

  return { rows, loading, friendCount };
}
