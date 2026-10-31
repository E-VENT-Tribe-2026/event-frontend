/**
 * TanStack Query client with sessionStorage persistence.
 *
 * - Data is serialised to sessionStorage under the key 'event-tribe-query-cache'
 * - Cache is considered fresh for 30 minutes (staleTime)
 * - Persisted for the tab session (cleared when the tab closes, and on logout)
 */
import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const SESSION_CACHE_MAX_AGE = 8 * 60 * 60 * 1000;
export const SESSION_STALE_TIME = 30 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: SESSION_STALE_TIME,
      gcTime: SESSION_CACHE_MAX_AGE,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

export const queryPersister =
  typeof window !== 'undefined'
    ? createSyncStoragePersister({
        storage: window.sessionStorage,
        key: 'event-tribe-query-cache',
        throttleTime: 1000,
        serialize: JSON.stringify,
        deserialize: JSON.parse,
      })
    : undefined;
