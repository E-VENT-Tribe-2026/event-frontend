import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cachedFetch, clearCache, setCacheEntry, TTL } from '@/lib/queryCache';

describe('cachedFetch', () => {
  beforeEach(() => {
    clearCache();
    sessionStorage.clear();
  });

  it('reuses a fresh entry instead of calling the fetcher again', async () => {
    const fetcher = vi.fn(async () => ({ n: 1 }));
    await cachedFetch('k-fresh', fetcher, TTL.MEDIUM);
    await cachedFetch('k-fresh', fetcher, TTL.MEDIUM);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns stale data immediately while a refresh runs', async () => {
    const fetcher = vi.fn(async () => ({ n: 2 }));
    setCacheEntry('k-stale', { n: 1 }, 1);
    await new Promise((r) => setTimeout(r, 5));
    const value = await cachedFetch('k-stale', fetcher, TTL.MEDIUM);
    expect(value).toEqual({ n: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  });
});
