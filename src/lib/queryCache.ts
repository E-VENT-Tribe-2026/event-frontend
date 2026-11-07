/**
 * Lightweight client-side query cache.
 *
 * Features:
 * - In-memory cache with configurable TTL (time-to-live)
 * - sessionStorage persistence for the tab session (survives reload, cleared on tab close)
 * - In-flight request deduplication (same key won't fire twice simultaneously)
 * - Manual invalidation by key or key prefix
 * - Stale-while-revalidate: returns cached data immediately, refreshes in background
 */

type CacheEntry<T> = {
  data: T;
  fetchedAt: number; // ms timestamp
  ttl: number;       // ms
};

type InFlightEntry = {
  promise: Promise<unknown>;
};

// ── In-memory store ──────────────────────────────────────────────────────────
const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, InFlightEntry>();

// Keys that should also be persisted to sessionStorage
const PERSISTENT_KEYS = new Set<string>();

// ── Default TTLs (ms) ────────────────────────────────────────────────────────
export const TTL = {
  SHORT:   30_000,              //  30 s  — notifications, chat, attendee counts
  MEDIUM:  10 * 60_000,         //  10 m  — events list, favorites, friends
  LONG:    30 * 60_000,         //  30 m  — profile, max-price, recommendations
  SESSION: 8 * 60 * 60_000,     //   8 h  — tab session (reload still hits cache)
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────
function isStale<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.fetchedAt > entry.ttl;
}

function readFromSession<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = sessionStorage.getItem(`qc:${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function writeToSession<T>(key: string, entry: CacheEntry<T>): void {
  try {
    sessionStorage.setItem(`qc:${key}`, JSON.stringify(entry));
  } catch {
    // Quota exceeded or private mode — ignore
  }
}

function removeFromSession(key: string): void {
  try {
    sessionStorage.removeItem(`qc:${key}`);
  } catch { /* ignore */ }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch data with caching.
 *
 * @param key       Unique cache key (e.g. "/api/events/max-price")
 * @param fetcher   Async function that returns the data
 * @param ttl       How long the cached value is considered fresh (ms)
 * @param persist   Whether to also persist to sessionStorage (default: yes, for the tab session)
 */
function readEntry<T>(key: string, persist: boolean): CacheEntry<T> | null {
  const memEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (memEntry) return memEntry;
  if (persist || PERSISTENT_KEYS.has(key)) {
    const sessEntry = readFromSession<T>(key);
    if (sessEntry) {
      memoryCache.set(key, sessEntry);
      return sessEntry;
    }
  }
  return null;
}

function runFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  persist: boolean,
): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing.promise as Promise<T>;

  const promise = fetcher().then((data) => {
    const entry: CacheEntry<T> = { data, fetchedAt: Date.now(), ttl };
    memoryCache.set(key, entry);
    if (persist || PERSISTENT_KEYS.has(key)) {
      writeToSession(key, entry);
    }
    inFlight.delete(key);
    return data;
  }).catch((err) => {
    inFlight.delete(key);
    throw err;
  });

  inFlight.set(key, { promise });
  return promise;
}

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = TTL.MEDIUM,
  persist = true,
): Promise<T> {
  const cached = readEntry<T>(key, persist);
  if (cached && !isStale(cached)) {
    return cached.data;
  }

  // Stale-while-revalidate: navigating back should not wait on the network.
  if (cached) {
    void runFetch(key, fetcher, ttl, persist).catch(() => { /* keep stale copy */ });
    return cached.data;
  }

  return runFetch(key, fetcher, ttl, persist);
}

/**
 * Stale-while-revalidate: return cached data immediately (even if stale),
 * then refresh in the background and call onUpdate with fresh data.
 */
export function staleWhileRevalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = TTL.MEDIUM,
  onUpdate: (data: T) => void,
  persist = true,
): T | null {
  // Return whatever we have immediately
  const memEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
  const sessEntry = (persist || PERSISTENT_KEYS.has(key)) ? readFromSession<T>(key) : null;
  const cached = memEntry ?? sessEntry ?? null;

  if (!cached) {
    void runFetch(key, fetcher, ttl, persist)
      .then(onUpdate)
      .catch(() => { /* silent background refresh failure */ });
  } else if (isStale(cached)) {
    void runFetch(key, fetcher, ttl, persist)
      .then(onUpdate)
      .catch(() => { /* keep stale copy */ });
  }

  return cached?.data ?? null;
}

/**
 * Manually set a value in the cache (e.g. after a mutation).
 */
export function setCacheEntry<T>(
  key: string,
  data: T,
  ttl: number = TTL.MEDIUM,
  persist = true,
): void {
  const entry: CacheEntry<T> = { data, fetchedAt: Date.now(), ttl };
  memoryCache.set(key, entry);
  if (persist || PERSISTENT_KEYS.has(key)) {
    writeToSession(key, entry);
  }
}

/**
 * Read a cached value without fetching, even if it is stale. Returns null when nothing is cached.
 */
export function peekCache<T>(key: string): T | null {
  const memEntry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (memEntry) return memEntry.data;
  const sessEntry = readFromSession<T>(key);
  return sessEntry?.data ?? null;
}

/**
 * Invalidate a specific cache key.
 */
export function invalidate(key: string): void {
  memoryCache.delete(key);
  removeFromSession(key);
}

/**
 * Invalidate all keys that start with a given prefix.
 * Useful for invalidating all participant data for an event: invalidatePrefix(`/api/participants/${eventId}`)
 */
export function invalidatePrefix(prefix: string): void {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
      removeFromSession(key);
    }
  }
  // Also scan sessionStorage
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(`qc:${prefix}`)) toRemove.push(k);
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

/**
 * Clear the entire cache (e.g. on logout).
 */
export function clearCache(): void {
  memoryCache.clear();
  inFlight.clear();
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('qc:')) toRemove.push(k);
    }
    toRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

/**
 * Get a cached value synchronously (returns null if not cached or stale).
 */
export function getCached<T>(key: string): T | null {
  const entry = readEntry<T>(key, true);
  if (entry && !isStale(entry)) return entry.data;
  return null;
}

if (typeof window !== 'undefined') {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const storageKey = sessionStorage.key(i);
      if (!storageKey?.startsWith('qc:')) continue;
      const key = storageKey.slice(3);
      const entry = readFromSession(key);
      if (entry) memoryCache.set(key, entry);
    }
  } catch { /* ignore */ }
}
