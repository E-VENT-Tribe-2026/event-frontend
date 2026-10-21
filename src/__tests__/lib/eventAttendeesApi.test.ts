import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchFriendsAttending, fetchParticipantCount, fetchParticipantList } from '@/lib/eventAttendeesApi';
import { clearCache, invalidatePrefix } from '@/lib/queryCache';

function mockFetch(body: unknown, ok = true) {
  const fn = vi.fn(async () => ({ ok, status: ok ? 200 : 403, json: async () => body }) as Response);
  vi.stubGlobal('fetch', fn);
  return fn;
}
const urlOf = (fn: ReturnType<typeof vi.fn>, i = 0) => String((fn.mock.calls[i] as unknown as [string])[0]);

describe('eventAttendeesApi (attendees through the client-side cache)', () => {
  beforeEach(() => { clearCache(); sessionStorage.clear(); });
  afterEach(() => vi.unstubAllGlobals());

  it('reads the count from the count endpoint', async () => {
    const fn = mockFetch({ event_id: 'e1', count: 7 });
    expect(await fetchParticipantCount('e1', 'tok-a-aaaaaaaaaaaa')).toBe(7);
    expect(urlOf(fn)).toContain('/api/participants/e1/participants/count');
  });

  it('reads the attending friends from the friends endpoint', async () => {
    const fn = mockFetch([{ user_id: 'f1', is_friend: true }]);
    expect(await fetchFriendsAttending('e1', 'tok-a-aaaaaaaaaaaa')).toEqual([{ user_id: 'f1', is_friend: true }]);
    expect(urlOf(fn)).toContain('/api/participants/e1/participants/friends');
  });

  it('reads the full list from the participants endpoint', async () => {
    const fn = mockFetch([{ user_id: 'p1', is_friend: false }]);
    await fetchParticipantList('e1', 'tok-a-aaaaaaaaaaaa');
    expect(urlOf(fn).endsWith('/api/participants/e1/participants')).toBe(true);
  });

  it('serves repeated reads from the cache', async () => {
    const fn = mockFetch({ count: 2 });
    await fetchParticipantCount('e1', 'tok-a-aaaaaaaaaaaa');
    await fetchParticipantCount('e1', 'tok-a-aaaaaaaaaaaa');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not share one user's friends with another user", async () => {
    const fn = mockFetch([]);
    await fetchFriendsAttending('e1', 'tok-a-aaaaaaaaaaaa');
    await fetchFriendsAttending('e1', 'tok-b-bbbbbbbbbbbb');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("is cleared by the page's existing invalidation after a join, leave or removal", async () => {
    const fn = mockFetch({ count: 2 });
    await fetchParticipantCount('e1', 'tok-a-aaaaaaaaaaaa');
    invalidatePrefix('/api/participants/e1');
    await fetchParticipantCount('e1', 'tok-a-aaaaaaaaaaaa');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('turns an unexpected body into an empty list and a refusal into an error that is not cached', async () => {
    mockFetch({ not: 'a list' });
    expect(await fetchParticipantList('e1', 't-aaaaaaaaaaaaaaaa')).toEqual([]);
    clearCache();
    const denied = mockFetch({ detail: 'no' }, false);
    await expect(fetchParticipantList('e1', 't-aaaaaaaaaaaaaaaa')).rejects.toThrow();
    const ok = mockFetch([{ user_id: 'p1' }]);
    await fetchParticipantList('e1', 't-aaaaaaaaaaaaaaaa');
    expect(denied).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
