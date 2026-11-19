import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isInviteCodeFormat, normalizeInviteCode, verifySignupInvite } from '@/lib/signupInvite';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('signupInvite', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('formats codes as ABCD-2345', () => {
    expect(normalizeInviteCode('abcd-2345')).toBe('ABCD-2345');
    expect(normalizeInviteCode(' abcd2345 ')).toBe('ABCD-2345');
    expect(isInviteCodeFormat('ABCD-2345')).toBe(true);
    expect(isInviteCodeFormat('ABC123')).toBe(false);
    expect(isInviteCodeFormat('short')).toBe(false);
  });

  it('verifySignupInvite requires valid: true', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ valid: true, email: 'guest@example.com' }));
    const invite = await verifySignupInvite('guest@example.com', 'abcd-2345');
    expect(invite).toEqual({ email: 'guest@example.com', code: 'ABCD-2345' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/verify-invite'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'guest@example.com', invite_code: 'ABCD-2345' }),
      }),
    );
  });

  it('verifySignupInvite rejects valid: false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ valid: false }, 200));
    await expect(verifySignupInvite('guest@example.com', 'ABCD-2345')).rejects.toThrow(
      'This invitation is not valid or has expired.',
    );
  });

  it('verifySignupInvite throws on an invalid code response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ detail: 'Unknown invite' }, 400));
    await expect(verifySignupInvite('guest@example.com', 'ZZZZ-9999')).rejects.toThrow('Unknown invite');
  });
});
