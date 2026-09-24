/**
 * TanStack Query hooks for frequently accessed data.
 *
 * These replace the manual fetch + useState patterns in pages.
 * Data is automatically cached in localStorage via the persisted QueryClient.
 * On successful mutations (join, leave, create, delete) call the relevant
 * queryClient.invalidateQueries() to trigger a background refresh.
 */
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { getApiUrl } from './api';
import { getAuthToken } from './auth';
import { mapApiEventToItem, parseEventsApiList } from './mapApiEvent';
import { fetchNotifications, type ApiNotification } from './notificationsApi';
import type { EventItem } from './storage';

// ── Query Keys ────────────────────────────────────────────────────────────────
export const QK = {
  profile:          (userId: string)                    => ['profile', userId],
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
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ── Profile ───────────────────────────────────────────────────────────────────
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: QK.profile(userId ?? ''),
    queryFn: () => apiFetch<Record<string, unknown>>(getApiUrl('/api/profile/me')),
    enabled: Boolean(userId && getAuthToken()),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Events list ───────────────────────────────────────────────────────────────
export function useEvents(params: {
  category?: string;
  search?: string;
  event_date?: string;
  limit?: number;
  page?: number;
}) {
  const p: Record<string, string> = {
    limit: String(params.limit ?? 50),
    page: String(params.page ?? 1),
  };
  if (params.category && params.category !== 'All') p.category = params.category;
  if (params.search) p.search = params.search;
  if (params.event_date) p.event_date = params.event_date;

  const qs = new URLSearchParams(p).toString();

  return useQuery({
    queryKey: QK.events(p),
    queryFn: async () => {
      const data = await apiFetch<unknown>(`/api/events?${qs}`);
      return parseEventsApiList(data).map(mapApiEventToItem) as EventItem[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

// ── Single event ──────────────────────────────────────────────────────────────
export function useEventDetail(id: string | undefined) {
  return useQuery({
    queryKey: QK.eventDetail(id ?? ''),
    queryFn: () => apiFetch<Record<string, unknown>>(`/api/events/${id}`),
    enabled: Boolean(id),
    staleTime: 2 * 60 * 1000,
  });
}

// ── Max price ─────────────────────────────────────────────────────────────────
export function useMaxPrice() {
  return useQuery({
    queryKey: QK.maxPrice(),
    queryFn: () => apiFetch<{ max_price: number }>('/api/events/max-price'),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Favorites ─────────────────────────────────────────────────────────────────
export function useFavorites(userId: string | undefined) {
  return useQuery({
    queryKey: QK.favorites(userId ?? ''),
    queryFn: () => apiFetch<Array<{ id?: string; event_id?: string }>>('/api/favorites/all'),
    enabled: Boolean(userId && getAuthToken()),
    staleTime: 2 * 60 * 1000,
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
    staleTime: 2 * 60 * 1000,
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
    staleTime: 2 * 60 * 1000,
  });
}

// ── Joined events ─────────────────────────────────────────────────────────────
export function useJoinedEvents(userId: string | undefined) {
  return useQuery({
    queryKey: QK.joinedEvents(userId ?? ''),
    queryFn: async () => {
      const rows = await apiFetch<Array<{ events?: unknown }>>('/api/participants/my/events');
      return rows
        .map((row) => row?.events as Record<string, unknown>)
        .filter(Boolean)
        .map(mapApiEventToItem) as EventItem[];
    },
    enabled: Boolean(userId && getAuthToken()),
    staleTime: 2 * 60 * 1000,
  });
}

// ── Participant count ─────────────────────────────────────────────────────────
export function useParticipantCount(eventId: string | undefined) {
  return useQuery({
    queryKey: QK.participants(eventId ?? ''),
    queryFn: () => apiFetch<{ count: number }>(`/api/participants/${eventId}/participants/count`),
    enabled: Boolean(eventId),
    staleTime: 30 * 1000,
  });
}

// ── Invalidation helpers ──────────────────────────────────────────────────────
export function invalidateEvents() {
  queryClient.invalidateQueries({ queryKey: ['events'] });
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
}

export function invalidateProfile(userId: string) {
  queryClient.invalidateQueries({ queryKey: QK.profile(userId) });
}

export function clearAllQueries() {
  queryClient.clear();
}
