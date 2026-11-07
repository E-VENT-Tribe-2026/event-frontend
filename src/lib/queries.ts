/**
 * TanStack Query hooks for frequently accessed data.
 *
 * These replace the manual fetch + useState patterns in pages.
 * Data is automatically cached in sessionStorage via the persisted QueryClient.
 * On successful mutations (join, leave, create, delete) call the relevant
 * queryClient.invalidateQueries() to trigger a background refresh.
 */
import { keepPreviousData, useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, SESSION_STALE_TIME } from './queryClient';
import { getApiUrl } from './api';
import { getAuthToken, notifyAuthExpired } from './auth';
import { mapApiEventToItem, parseEventsApiList, parseJoinedEventsApiList } from './mapApiEvent';
import { fetchNotifications, notifyNotificationsChanged, type ApiNotification } from './notificationsApi';
import { invalidatePrefix } from './queryCache';
import { notifyEventsChanged } from './realtimeEvents';
import { fetchUserProfile } from './userProfileApi';
import type { EventItem } from './storage';

// ── Query Keys ────────────────────────────────────────────────────────────────
export const QK = {
  profile:          (userId: string)                    => ['profile', userId],
  userProfile:      (viewerId: string, userId: string)  => ['userProfile', viewerId, userId],
  events:           (params: Record<string, string>)    => ['events', params],
  eventDetail:      (id: string)                        => ['event', id],
  participants:     (eventId: string)                   => ['participants', eventId],
  myStatus:         (eventId: string)                   => ['myStatus', eventId],
  favorites:        (userId: string)                    => ['favorites', userId],
  recommendations:  (userId: string)                    => ['recommendations', userId],
  notifications:    ()                                  => ['notifications'],
  maxPrice:         ()                                  => ['maxPrice'],
  myEvents:         (userId: string)                    => ['myEvents', userId],
  joinedEvents:     (userId: string)                    => ['joinedEvents', userId],
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(getApiUrl(path), { headers: authHeaders(), ...init });
  if (res.status === 401) {
    notifyAuthExpired();
    throw new Error(`API 401: ${path}`);
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ── Profile ───────────────────────────────────────────────────────────────────
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: QK.profile(userId ?? ''),
    queryFn: () => apiFetch<Record<string, unknown>>(getApiUrl('/api/profile/me')),
    enabled: Boolean(userId && getAuthToken()),
    staleTime: SESSION_STALE_TIME,
  });
}

// ── Another user's profile (events + friendship state) ───────────────────────
// Keyed by viewer too: the friendship state differs per viewer.
export function useUserProfile(viewerId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: QK.userProfile(viewerId ?? '', userId ?? ''),
    queryFn: () => fetchUserProfile(userId as string),
    enabled: Boolean(viewerId && userId && getAuthToken()),
    staleTime: 15 * 60 * 1000,
    // A refused profile (private/missing) is not worth retrying.
    retry: false,
  });
}

const EVENTS_PAGE_SIZE = 100;
const EVENTS_MAX_PAGES = 40;

function eventsListHasMore(body: unknown, pageSize: number, rowCount: number): boolean {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (b.has_more === true) return true;
    if (b.has_more === false) return false;
  }
  return rowCount >= pageSize;
}

/** Every page of GET /api/events for the home All events list. */
export async function fetchAllPublicEvents(filters: Record<string, string> = {}): Promise<EventItem[]> {
  const collected: EventItem[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= EVENTS_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      ...filters,
      limit: String(EVENTS_PAGE_SIZE),
      page: String(page),
    });
    const data = await apiFetch<unknown>(`/api/events?${params.toString()}`);
    const rows = parseEventsApiList(data);
    for (const row of rows) {
      const item = mapApiEventToItem(row);
      if (!item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      collected.push(item);
    }
    if (!eventsListHasMore(data, EVENTS_PAGE_SIZE, rows.length)) break;
  }

  return collected;
}

// ── Events list ───────────────────────────────────────────────────────────────
export function useEvents(params: {
  category?: string;
  search?: string;
  event_date?: string;
}) {
  const p: Record<string, string> = {};
  if (params.category && params.category !== 'All') p.category = params.category;
  if (params.search) p.search = params.search;
  if (params.event_date) p.event_date = params.event_date;

  return useQuery({
    queryKey: QK.events(p),
    queryFn: () => fetchAllPublicEvents(p),
    staleTime: SESSION_STALE_TIME,
    placeholderData: keepPreviousData,
  });
}

// ── Single event ──────────────────────────────────────────────────────────────
export function useEventDetail(id: string | undefined) {
  return useQuery({
    queryKey: QK.eventDetail(id ?? ''),
    queryFn: () => apiFetch<Record<string, unknown>>(`/api/events/${id}`),
    enabled: Boolean(id),
    staleTime: SESSION_STALE_TIME,
  });
}

// ── Max price ─────────────────────────────────────────────────────────────────
export function useMaxPrice() {
  return useQuery({
    queryKey: QK.maxPrice(),
    queryFn: () => apiFetch<{ max_price: number }>('/api/events/max-price'),
    staleTime: SESSION_STALE_TIME,
  });
}

// ── Favorites ─────────────────────────────────────────────────────────────────
export function useFavorites(userId: string | undefined) {
  return useQuery({
    queryKey: QK.favorites(userId ?? ''),
    queryFn: () => apiFetch<Array<{ id?: string; event_id?: string }>>('/api/favorites/all'),
    enabled: Boolean(userId && getAuthToken()),
    staleTime: SESSION_STALE_TIME,
    select: (data) => new Set(data.map((f) => f.id || f.event_id || '')),
  });
}

// ── Recommendations ───────────────────────────────────────────────────────────
export function useRecommendations(userId: string | undefined, hasInterests: boolean) {
  return useQuery({
    queryKey: QK.recommendations(userId ?? ''),
    queryFn: async () => {
      const data = await apiFetch<{ data?: unknown[] }>('/api/recommendations?limit=6');
      return (Array.isArray(data.data) ? data.data : []).map(
        (row) => mapApiEventToItem(row as Record<string, unknown>)
      ) as EventItem[];
    },
    enabled: Boolean(userId && getAuthToken() && hasInterests),
    staleTime: SESSION_STALE_TIME,
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────
export function useNotifications() {
  return useQuery({
    queryKey: QK.notifications(),
    queryFn: async (): Promise<ApiNotification[]> => {
      const token = getAuthToken();
      if (!token) return [];
      return fetchNotifications(token); // uses the existing normalised fetcher
    },
    enabled: Boolean(getAuthToken()),
    staleTime: 30 * 1000,
  });
}

// ── My events (organizer) ─────────────────────────────────────────────────────
export function useMyEvents(userId: string | undefined) {
  return useQuery({
    queryKey: QK.myEvents(userId ?? ''),
    queryFn: async () => {
      const data = await apiFetch<{ data?: unknown[] }>('/api/events/my-events');
      return (Array.isArray(data.data) ? data.data : []).map(
        (row) => mapApiEventToItem(row as Record<string, unknown>)
      ) as EventItem[];
    },
    enabled: Boolean(userId && getAuthToken()),
    staleTime: SESSION_STALE_TIME,
  });
}

// ── Joined events ─────────────────────────────────────────────────────────────
export function useJoinedEvents(userId: string | undefined) {
  return useQuery({
    queryKey: QK.joinedEvents(userId ?? ''),
    queryFn: async () => {
      const rows = await apiFetch<unknown>('/api/participants/my/events');
      return parseJoinedEventsApiList(rows).map(mapApiEventToItem) as EventItem[];
    },
    enabled: Boolean(userId && getAuthToken()),
    staleTime: SESSION_STALE_TIME,
  });
}

// ── Participant count ─────────────────────────────────────────────────────────
export function useParticipantCount(eventId: string | undefined) {
  return useQuery({
    queryKey: QK.participants(eventId ?? ''),
    queryFn: () => apiFetch<{ count: number }>(`/api/participants/${eventId}/participants/count`),
    enabled: Boolean(eventId),
    staleTime: SESSION_STALE_TIME,
  });
}

/** Warm home/profile queries as soon as a session exists so the first screen is cached. */
export function prefetchSignedInQueries(userId?: string) {
  const tasks: Array<Promise<unknown>> = [
    queryClient.prefetchQuery({
      queryKey: QK.maxPrice(),
      queryFn: () => apiFetch<{ max_price: number }>('/api/events/max-price'),
    }),
    queryClient.prefetchQuery({
      queryKey: QK.events({}),
      queryFn: () => fetchAllPublicEvents({}),
    }),
  ];
  if (userId && getAuthToken()) {
    tasks.push(
      queryClient.prefetchQuery({
        queryKey: QK.favorites(userId),
        queryFn: () => apiFetch<Array<{ id?: string; event_id?: string }>>('/api/favorites/all'),
      }),
      queryClient.prefetchQuery({
        queryKey: QK.myEvents(userId),
        queryFn: async () => {
          const data = await apiFetch<{ data?: unknown[] }>('/api/events/my-events');
          return (Array.isArray(data.data) ? data.data : []).map((row) =>
            mapApiEventToItem(row as Record<string, unknown>),
          );
        },
      }),
      queryClient.prefetchQuery({
        queryKey: QK.joinedEvents(userId),
        queryFn: async () => {
          const rows = await apiFetch<unknown>('/api/participants/my/events');
          return parseJoinedEventsApiList(rows).map(mapApiEventToItem);
        },
      }),
    );
  }
  return Promise.allSettled(tasks);
}

// ── Invalidation helpers ──────────────────────────────────────────────────────
/** Put a just-created event at the front of cached home lists so All events updates immediately. */
export function prependCreatedEvent(event: EventItem) {
  const insert = (old: EventItem[] | undefined) => {
    if (!old) return [event];
    if (old.some((row) => row.id === event.id)) {
      return old.map((row) => (row.id === event.id ? { ...row, ...event } : row));
    }
    return [event, ...old];
  };
  queryClient.setQueriesData<EventItem[]>({ queryKey: ['events'] }, insert);
  queryClient.setQueriesData<EventItem[]>({ queryKey: ['myEvents'] }, insert);
  notifyEventsChanged();
}

export function invalidateEvents() {
  queryClient.invalidateQueries({ queryKey: ['events'], refetchType: 'all' });
  queryClient.invalidateQueries({ queryKey: ['event'] });
  queryClient.invalidateQueries({ queryKey: ['recommendations'] });
  queryClient.invalidateQueries({ queryKey: ['myEvents'], refetchType: 'all' });
  queryClient.invalidateQueries({ queryKey: ['joinedEvents'] });
  queryClient.invalidateQueries({ queryKey: ['participants'] });
  queryClient.invalidateQueries({ queryKey: ['maxPrice'] });
  invalidatePrefix('/api/events');
  invalidatePrefix('/api/participants');
  invalidatePrefix('/api/recommendations');
  notifyEventsChanged();
}

export function invalidateEventDetail(id: string) {
  queryClient.invalidateQueries({ queryKey: QK.eventDetail(id) });
  queryClient.invalidateQueries({ queryKey: QK.participants(id) });
}

export function invalidateFavorites(userId: string) {
  queryClient.invalidateQueries({ queryKey: QK.favorites(userId) });
}

export function invalidateNotifications() {
  queryClient.invalidateQueries({ queryKey: QK.notifications() });
  notifyNotificationsChanged();
}

export function invalidateProfile(userId: string) {
  queryClient.invalidateQueries({ queryKey: QK.profile(userId) });
}

/** Refresh a user's profile after a friendship action (own key for each viewer). */
export function invalidateUserProfile(userId: string) {
  queryClient.invalidateQueries({ queryKey: ['userProfile'], predicate: (q) => q.queryKey[2] === userId });
}

export function clearAllQueries() {
  queryClient.clear();
}
