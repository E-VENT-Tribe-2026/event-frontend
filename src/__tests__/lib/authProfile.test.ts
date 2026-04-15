import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAuthUserFromToken, sameAuthUserId } from '@/lib/authProfile';

describe('sameAuthUserId', () => {
  it('returns false for missing values', () => {
    expect(sameAuthUserId('', 'a')).toBe(false);
    expect(sameAuthUserId('a', undefined)).toBe(false);
  });

  it('compares case-insensitively with trim', () => {
    expect(sameAuthUserId('  Abc-123  ', 'abc-123')).toBe(true);
    expect(sameAuthUserId('x', 'y')).toBe(false);
  });
});

describe('fetchAuthUserFromToken', () => {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when response is not ok', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(fetchAuthUserFromToken('tok')).resolves.toBeNull();
  });

  it('returns null when id is missing or not a string', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ email: 'a@b.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(fetchAuthUserFromToken('tok')).resolves.toBeNull();
  });

  it('returns trimmed id and email on success', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: '  uuid-1  ', email: 'e@x.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(fetchAuthUserFromToken(' bearer ')).resolves.toEqual({
      id: 'uuid-1',
      email: 'e@x.com',
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer bearer' });
  });
});
