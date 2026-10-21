import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMapEvents } from '@/lib/mapEventsApi';
import { clearAuthToken, setAuthToken } from '@/lib/auth';
import { clearCache, invalidatePrefix } from '@/lib/queryCache';

const params = () => new URLSearchParams({ page: '1', limit: '50' });

function mockFetch(rows: unknown[] = [{ id: 'e1', title: 'Football', friends_attending_count: 1 }]) {
  const fn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: rows }) }) as Response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('fetchMapEvents (map events through the client-side cache)', () => {
  beforeEach(() => {
    clearCache();
    sessionStorage.clear();
    setAuthToken('token-of-rania-aaaaaaaa');
  });
  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  it('returns the events with their friends_attending_count', async () => {
    mockFetch();
    const rows = await fetchMapEvents(params());
    expect(rows).toEqual([{ id: 'e1', title: 'Football', friends_attending_count: 1 }]);
  });

  it('serves a second call from the cache without asking the server again', async () => {
    const fn = mockFetch();
    await fetchMapEvents(params());
    await fetchMapEvents(params());
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('asks again for different filters', async () => {
    const fn = mockFetch();
    await fetchMapEvents(params());
    await fetchMapEvents(new URLSearchParams({ page: '1', limit: '50', category: 'Music' }));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not share one user's cached numbers with another user", async () => {
    const fn = mockFetch();
    await fetchMapEvents(params());
    setAuthToken('token-of-oumou7-bbbbbbbb');
    await fetchMapEvents(params());
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('is cleared together with the other events lists', async () => {
    const fn = mockFetch();
    await fetchMapEvents(params());
    invalidatePrefix('/api/events?');
    await fetchMapEvents(params());
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('sends the sign-in token so the backend can count the user\'s friends', async () => {
    const fn = mockFetch();
    await fetchMapEvents(params());
    const init = (fn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-of-rania-aaaaaaaa');
  });

  it('does not cache a failed request', async () => {
    const bad = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response);
    vi.stubGlobal('fetch', bad);
    await expect(fetchMapEvents(params())).rejects.toThrow();
    const good = mockFetch();
    await fetchMapEvents(params());
    expect(good).toHaveBeenCalledTimes(1);
  });
});
