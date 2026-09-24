/**
 * TanStack Query client with localStorage persistence.
 *
 * - Data is serialised to localStorage under the key 'event-tribe-query-cache'
 * - Cache is considered fresh for 5 minutes (staleTime)
 * - Persisted cache max age: 24 hours
 * - On logout call queryClient.clear() to wipe both in-memory and localStorage cache
 */
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 min — data stays fresh
      gcTime:    24 * 60 * 60 * 1000,  // 24 h  — keep in memory/storage
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Only persist in browser environments
if (typeof window !== 'undefined') {
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: 'event-tribe-query-cache',
    throttleTime: 1000,    // debounce writes by 1 s
    serialize: JSON.stringify,
    deserialize: JSON.parse,
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
    buster: import.meta.env.VITE_CACHE_BUSTER ?? '',  // bump to invalidate old caches on deploy
  });
}
