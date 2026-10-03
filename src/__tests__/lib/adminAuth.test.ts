import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  needsAdminVerification,
  setPendingAdminVerification,
  getPendingAdminVerification,
  clearPendingAdminVerification,
  fetchMfaStatus,
  enrollMfa,
  verifyMfaCode,
} from '@/lib/adminAuth';

// Built directly against "Updated Backend APIs scenario.md", posted by the
// backend dev on ticket #247 (event-backend#150), per the team's workflow
// policy of building against the posted example before the live endpoint.

describe('needsAdminVerification', () => {
  it('Scenario A — non-admin never needs verification', () => {
    expect(needsAdminVerification({ is_admin: false, is_verified: true })).toBe(false);
  });

  it('Scenario B — unverified administrator needs verification', () => {
    expect(needsAdminVerification({ is_admin: true, has_mfa_linked: false, is_verified: false })).toBe(true);
  });

  it('Scenario C — administrator already verified does not need it again', () => {
    expect(needsAdminVerification({ is_admin: true, is_verified: true })).toBe(false);
  });
});

describe('pending admin verification storage', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips set/get/clear', () => {
    expect(getPendingAdminVerification()).toBeNull();
    setPendingAdminVerification({ accessToken: 'tok', hasMfaLinked: true, factorId: 'f1' });
    expect(getPendingAdminVerification()).toEqual({ accessToken: 'tok', hasMfaLinked: true, factorId: 'f1' });
    clearPendingAdminVerification();
    expect(getPendingAdminVerification()).toBeNull();
  });
});

describe('fetchMfaStatus — Scenario F (Google OAuth)', () => {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns the admin status from /api/auth/mfa/status', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          role: 'administrator',
          is_admin: true,
          has_mfa_linked: true,
          is_verified: false,
          factor_id: '018f3a5e-...',
        }),
        { status: 200 },
      ),
    );
    const result = await fetchMfaStatus('oauth-token');
    expect(result?.is_admin).toBe(true);
    expect(result?.factor_id).toBe('018f3a5e-...');
  });

  it('returns null on a failed request rather than throwing', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    expect(await fetchMfaStatus('bad-token')).toBeNull();
  });
});

describe('enrollMfa — Scenario B, Step 2', () => {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns the factor id and TOTP data on success', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          factor_id: '018f3a5e-...',
          totp: {
            qr_code: 'data:image/svg+xml;utf-8,<svg></svg>',
            secret: 'JBSWY3DPEHPK3PXP',
            uri: 'otpauth://totp/EventGit:admin@example.com?secret=JBSWY3DPEHPK3PXP',
          },
        }),
        { status: 200 },
      ),
    );
    const result = await enrollMfa('aal1-token');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.factor_id).toBe('018f3a5e-...');
      expect(result.totp.secret).toBe('JBSWY3DPEHPK3PXP');
    }
  });

  it('Scenario G — surfaces the 403 refusal for a non-admin account', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Only administrator accounts can link an authenticator app.' }), {
        status: 403,
      }),
    );
    const result = await enrollMfa('user-token');
    expect('error' in result && result.error).toBe('Only administrator accounts can link an authenticator app.');
  });
});

describe('verifyMfaCode — Scenarios B/C/D/G', () => {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('Scenario B — returns the upgraded aal2 token on a correct first-time code', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'aal2-token', is_verified: true }), { status: 200 }),
    );
    const result = await verifyMfaCode('aal1-token', '123456', '018f3a5e-...');
    expect('error' in result).toBe(false);
    if (!('error' in result)) expect(result.accessToken).toBe('aal2-token');

    // Confirm factor_id was actually sent in the request body, as the spec requires.
    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(String(init?.body));
    expect(sentBody).toEqual({ code: '123456', factor_id: '018f3a5e-...' });
  });

  it('Scenario D — surfaces the refusal reason for a wrong code', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ detail: 'Invalid verification code. Please check your authenticator app and try again.' }),
        { status: 400 },
      ),
    );
    const result = await verifyMfaCode('aal1-token', '000000');
    expect('error' in result && result.error).toBe(
      'Invalid verification code. Please check your authenticator app and try again.',
    );
  });

  it('Scenario G — surfaces the 403 refusal for a non-admin account', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Only administrator accounts can verify authentication codes.' }), {
        status: 403,
      }),
    );
    const result = await verifyMfaCode('user-token', '123456');
    expect('error' in result && result.error).toBe('Only administrator accounts can verify authentication codes.');
  });
});
