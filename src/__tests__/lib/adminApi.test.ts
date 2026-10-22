import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkAdminVerified,
  fetchAdminAudit,
  fetchAdminCounts,
  fetchAdminUsers,
  fetchAdminUserDetails,
  fetchUserWarnings,
  grantAdminRole,
  warnUser,
  withdrawWarning,
} from '@/lib/adminApi';
import * as authModule from '@/lib/auth';
import * as storageModule from '@/lib/storage';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

describe('adminApi service', () => {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(authModule, 'getAuthToken').mockReturnValue('mock_admin_token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('checkAdminVerified returns true when /api/admin/verify returns 200', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 'ok', message: 'Administrative access verified.', admin_id: 'uuid-1' })
    );

    const res = await checkAdminVerified();
    expect(res.isVerifiedAdmin).toBe(true);
    expect(res.role).toBe('administrator');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/admin/verify');
    expect(init?.cache).toBe('no-store');
  });

  it('checkAdminVerified returns false when /api/admin/verify returns 403', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'Forbidden: Administrator sign-in verification required.' }, { status: 403 })
    );

    const res = await checkAdminVerified();
    expect(res.isVerifiedAdmin).toBe(false);
  });

  it('does not call /api/admin/verify when the signed-in role is not administrator', async () => {
    vi.spyOn(storageModule, 'getCurrentUser').mockReturnValue({
      id: 'u-participant',
      role: 'participant',
      name: 'Pat',
      username: 'pat',
      email: 'pat@test.com',
      password: '',
      avatar: '',
      profilePhoto: '',
      coverPhoto: '',
      interests: [],
      dob: '',
      gender: '',
      isPremium: false,
      friends: [],
      createdAt: '',
    });

    const res = await checkAdminVerified();
    expect(res.isVerifiedAdmin).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still calls /api/admin/verify when the signed-in role is administrator', async () => {
    vi.spyOn(storageModule, 'getCurrentUser').mockReturnValue({
      id: 'u-admin',
      role: 'administrator',
      name: 'Ada',
      username: 'ada',
      email: 'ada@test.com',
      password: '',
      avatar: '',
      profilePhoto: '',
      coverPhoto: '',
      interests: [],
      dob: '',
      gender: '',
      isPremium: false,
      friends: [],
      createdAt: '',
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ status: 'ok', message: 'Administrative access verified.', admin_id: 'uuid-1' })
    );

    const res = await checkAdminVerified();
    expect(res.isVerifiedAdmin).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/admin/verify');
  });

  it('fetchAdminCounts fetches counts with no-store policy', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        total_users: 150,
        events: { total: 42, upcoming: 18, past: 20, cancelled: 4 },
      })
    );

    const data = await fetchAdminCounts();
    expect(data.total_users).toBe(150);
    expect(data.events?.total).toBe(42);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/admin/counts');
    expect(init?.cache).toBe('no-store');
  });

  it('fetchAdminUsers passes page, limit, and search parameters', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 'u1',
            username: 'alice',
            full_name: 'Alice Wonder',
            role: 'user',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
      })
    );

    const data = await fetchAdminUsers(1, 20, 'ali');
    expect(data.items).toHaveLength(1);
    expect(data.items[0].username).toBe('alice');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/admin/users?page=1&limit=20&search=ali');
    expect(init?.cache).toBe('no-store');
  });

  it('fetchAdminUserDetails fetches single user details and organized/joined events', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'u1',
        username: 'alice',
        full_name: 'Alice Wonder',
        is_admin: false,
        role: 'user',
        created_at: '2026-01-01T00:00:00Z',
        organized_events: {
          upcoming: [{ id: 'e1', title: 'Tech Meetup', date: '2026-12-01T10:00:00Z', status: 'active' }],
          past: [],
          cancelled: [],
        },
        joined_events: {
          upcoming: [],
          past: [],
          cancelled: [],
        },
      })
    );

    const data = await fetchAdminUserDetails('u1');
    expect(data.full_name).toBe('Alice Wonder');
    expect(data.organized_events.upcoming).toHaveLength(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/admin/users/u1');
    expect(init?.cache).toBe('no-store');
  });

  it('grantAdminRole sends POST to promote user to administrator', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        message: 'Administrator role granted successfully.',
        user_id: 'u1',
        role: 'administrator',
      })
    );

    const res = await grantAdminRole('u1');
    expect(res.role).toBe('administrator');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/admin/users/u1/grant-admin');
    expect(init?.method).toBe('POST');
    expect(init?.cache).toBe('no-store');
  });

  it('grantAdminRole throws backend error message on failure', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'Account is already an administrator.' }, { status: 400 })
    );

    await expect(grantAdminRole('u1')).rejects.toThrow('Account is already an administrator.');
  });

  it('fetches warnings from GET /api/admin/users/{id}/warnings', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ warnings: [{ id: 'w1', reason: 'Spam', issued_at: '2026-01-01T00:00:00Z', issued_by: 'ada' }] }),
    );

    const rows = await fetchUserWarnings('u1');
    expect(rows).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/admin/users/u1/warnings');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('GET');
  });

  it('posts a warning to /api/admin/users/{id}/warnings', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Warned', warning_id: 'w2' }));

    const res = await warnUser('u1', 'Be kind');
    expect(res.warning_id).toBe('w2');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/admin/users/u1/warnings');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ reason: 'Be kind' });
  });

  it('withdraws a warning via POST /api/admin/warnings/{id}/withdraw', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Withdrawn' }));

    await withdrawWarning('u1', 'w2');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/admin/warnings/w2/withdraw');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
  });

  it('loads the audit log from GET /api/admin/audit-log', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [{ id: 'a1', action: 'warn', admin_id: 'ada', admin_name: 'Ada', created_at: '2026-01-01T00:00:00Z' }],
        total: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
      }),
    );

    const data = await fetchAdminAudit(1, 20);
    expect(data.items).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/admin/audit-log?page=1&limit=20');
  });
});
