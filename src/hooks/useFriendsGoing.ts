import { useEffect, useMemo, useState } from 'react';
import { AUTH_TOKEN_EVENT, getAuthToken } from '@/lib/auth';
import type { EventItem } from '@/lib/storage';
import { FRIENDS_CHANGED_EVENT, type UserSummary } from '@/lib/friendsApi';
import { fetchAllFriends, fetchEventParticipants, friendsGoingToEvent, goingParticipantIds } from '@/lib/eventSocial';

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
    window.addEventListener(AUTH_TOKEN_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(FRIENDS_CHANGED_EVENT, onChange);
      window.removeEventListener(AUTH_TOKEN_EVENT, onChange);
    };
  }, [eventId]);

  return { friends, loading };
}

export function useFriendsGoingEvents(events: EventItem[], limit = 24) {
  const slice = events.slice(0, limit);
  const key = slice.map((e) => e.id).join(',');
  const [rows, setRows] = useState<Array<{ event: EventItem; friends: UserSummary[] }>>([]);
  const [loading, setLoading] = useState(false);
  const [friendCount, setFriendCount] = useState(0);

  const eventById = useMemo(() => {
    const map = new Map(slice.map((e) => [e.id, e]));
    return map;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!getAuthToken()) {
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
      if (allFriends.length === 0 || !key) {
        setRows([]);
        setLoading(false);
        return;
      }
      const ids = key.split(',').filter(Boolean);
      const packed = await Promise.all(
        ids.map(async (id) => {
          const participants = await fetchEventParticipants(id);
          const friends = friendsGoingToEvent(allFriends, goingParticipantIds(participants));
          const event = eventById.get(id);
          return event && friends.length > 0 ? { event, friends } : null;
        }),
      );
      if (cancelled) return;
      setRows(packed.filter(Boolean) as Array<{ event: EventItem; friends: UserSummary[] }>);
      setLoading(false);
    };
    void load();
    const onChange = () => { void load(); };
    window.addEventListener(FRIENDS_CHANGED_EVENT, onChange);
    window.addEventListener(AUTH_TOKEN_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(FRIENDS_CHANGED_EVENT, onChange);
      window.removeEventListener(AUTH_TOKEN_EVENT, onChange);
    };
  }, [key, eventById]);

  return { rows, loading, friendCount };
}
