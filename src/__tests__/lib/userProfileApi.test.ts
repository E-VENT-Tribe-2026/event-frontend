import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setAuthToken } from '@/lib/auth';
import { fetchUserProfile } from '@/lib/userProfileApi';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('fetchUserProfile blocking', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    setAuthToken('token-abc');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('keeps a limited profile when the viewer blocked this user', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      id: 'u1',
      username: 'blocked_user',
      full_name: 'Blocked User',
      avatar_url: null,
      avatar_kind: 'icon',
      icon_id: 'sun',
      banner_url: null,
      bio: 'hidden events',
      interests: ['Music'],
      blocked_by_me: true,
    }));
    const profile = await fetchUserProfile('u1');
    expect(profile.blocked_by_me).toBe(true);
    expect(profile.events).toBeUndefined();
  });

  it('surfaces profile_unavailable as a not-found profile', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'profile_unavailable' }, 404));
    await expect(fetchUserProfile('u1')).rejects.toMatchObject({
      name: 'ProfileLoadError',
      status: 404,
      code: 'profile_unavailable',
      message: 'This profile is unavailable',
    });
  });

  it('also reads nested FastAPI detail.code', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: { code: 'profile_unavailable' } }, 404));
    await expect(fetchUserProfile('u1')).rejects.toMatchObject({
      status: 404,
      code: 'profile_unavailable',
      message: 'This profile is unavailable',
    });
  });
});
