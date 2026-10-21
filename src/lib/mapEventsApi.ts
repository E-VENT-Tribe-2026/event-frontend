/**
 * The events list for the map tab, read through the client-side cache (events list: TTL.MEDIUM).
 *
 * The key starts with "/api/events?" so every existing invalidation of the events list
 * (joining, leaving, creating, friend changes) also clears this one, and it carries the signed-in
 * user's token suffix because each event includes how many of THAT user's friends attend.
 */
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { parseEventsApiList } from '@/lib/mapApiEvent';
import { cachedFetch, TTL } from '@/lib/queryCache';

export function fetchMapEvents(params: URLSearchParams, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
  const token = getAuthToken();
  const scope = (token ?? '').slice(-16);
  const query = params.toString();
  return cachedFetch(
    `/api/events?${query}#${scope}`,
    async () => {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(getApiUrl(`/api/events?${query}`), { headers, signal });
      if (!res.ok) throw new Error('fetch failed');
      return parseEventsApiList(await res.json());
    },
    TTL.MEDIUM,
  );
}
