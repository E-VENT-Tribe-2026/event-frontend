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

const MAX_FRIEND_PROFILES = 8;

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

type FriendEventRow = { event: EventItem; friends: UserSummary[] };

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

  const byEvent = new Map<string, FriendEventRow>();
  for (const item of profiles) {
    if (!item) continue;
    const upcoming = item.profile.events?.joined?.upcoming ?? [];
    for (const raw of upcoming) {
      if (!raw || typeof raw !== 'object') continue;
      const event = mapApiEventToItem(raw as Record<string, unknown>);
      if (!event.id || !isEventUpcoming(event) || String(event.status || '').toLowerCase() === 'cancelled') continue;
      const existing = byEvent.get(event.id);
      if (existing) {
        if (!existing.friends.some((row) => row.id === item.friend.id)) existing.friends.push(item.friend);
      } else {
        byEvent.set(event.id, { event, friends: [item.friend] });
      }
    }
  }
  return Array.from(byEvent.values()).sort((a, b) => eventStartMs(a.event) - eventStartMs(b.event));
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
      const fromCounts = (
        await Promise.all(
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
        )
      ).filter(Boolean) as FriendEventRow[];

      if (cancelled) return;
      if (fromCounts.length > 0) {
        setRows(fromCounts.slice(0, limit));
        setLoading(false);
        return;
      }

      if (allFriends.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const fromProfiles = await eventsFromFriendsProfiles(allFriends);
      if (cancelled) return;
      setRows(fromProfiles.slice(0, limit));
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
