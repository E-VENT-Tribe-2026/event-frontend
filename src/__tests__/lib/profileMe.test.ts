import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setAuthToken } from '@/lib/auth';
import { clearCache } from '@/lib/queryCache';
import { fetchMyProfile } from '@/lib/profileMe';

describe('fetchMyProfile', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    setAuthToken('profile-token-abcdefgh');
    clearCache();
    sessionStorage.clear();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('reuses one /api/profile/me response across callers', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'u1', username: 'maya' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const first = await fetchMyProfile();
    const second = await fetchMyProfile();
    expect(first).toEqual({ id: 'u1', username: 'maya' });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
