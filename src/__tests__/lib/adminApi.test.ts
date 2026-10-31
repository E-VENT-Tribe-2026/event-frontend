import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkAdminVerified,
  fetchAdminAudit,
  matchesAuditFilters,
  auditActionFilterKey,
  localDateFromIso,
  fetchAdminCounts,
  fetchAdminUsers,
  fetchAdminUserDetails,
  fetchUserWarnings,
  grantAdminRole,
  warnUser,
  withdrawWarning,
  liftSuspension,
  isSuspendedAccount,
  sendSignupInvite,
  userReportListsFromDetails,
  readUserReportRefs,
  fetchAdminReports,
  fetchAdminReportDetail,
  dismissReport,
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
    expect(data.is_suspended).toBe(false);
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
    expect(data.items[0].admin_name).toBe('Ada');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/admin/audit-log?limit=20');
  });

  it('matches audit filters by administrator, action, and local date', () => {
    const noon = new Date(2026, 9, 25, 12, 0, 0).toISOString();
    const entry = {
      id: 'a1',
      action: 'lift_suspension',
      admin_id: 'ada',
      admin_name: 'Ada Lovelace',
      admin_username: 'ada.admin',
      created_at: noon,
    };
    expect(auditActionFilterKey('lift_suspension')).toBe('lift-suspension');
    expect(localDateFromIso(noon)).toBe('2026-10-25');
    expect(matchesAuditFilters(entry, { admin: 'ada.admin' })).toBe(true);
    expect(matchesAuditFilters(entry, { admin: 'bob' })).toBe(false);
    expect(matchesAuditFilters(entry, { action: 'lift-suspension' })).toBe(true);
    expect(matchesAuditFilters(entry, { action: 'warn' })).toBe(false);
    expect(matchesAuditFilters(entry, { date: '2026-10-25' })).toBe(true);
    expect(matchesAuditFilters(entry, { date: '2026-10-24' })).toBe(false);
  });

  it('maps nested administrator onto admin_name', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 'a3',
            action: 'warn',
            created_at: '2026-01-01T00:00:00Z',
            administrator: {
              id: 'ada-id',
              username: 'ada_admin',
              full_name: 'Ada Lovelace',
              display_name: 'Ada',
            },
            target: { type: 'user', id: 'u1', user: { id: 'u1', username: 'bob', full_name: 'Bob Baker' } },
            description: 'Warned for spam',
            details: [],
          },
        ],
        has_more: false,
        next_before: null,
      }),
    );

    const data = await fetchAdminAudit();
    expect(data.items[0].admin_id).toBe('ada-id');
    expect(data.items[0].admin_name).toBe('Ada Lovelace');
    expect(data.items[0].admin_username).toBe('ada_admin');
    expect(data.items[0].target_name).toBe('Bob Baker');
    expect(data.items[0].target_username).toBe('bob');
    expect(data.items[0].reason).toBe('Warned for spam');
  });

  it('maps an invite audit row to the invitee email', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 'a4',
            action: 'registration_invite',
            created_at: '2026-10-25T19:17:00Z',
            administrator: { id: 'ada', username: 'soniam', full_name: 'Sonia' },
            target: { type: 'invite', id: '1' },
            description: 'Sent a registration invitation to soniamangane@gmail.com.',
            details: ['email:soniamangane@gmail.com'],
          },
        ],
        has_more: false,
      }),
    );

    const data = await fetchAdminAudit();
    expect(data.items[0].target_email).toBe('soniamangane@gmail.com');
  });

  it('keeps a reported chat as a chat/report target, not an email', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 'a5',
            action: 'dismiss_report',
            created_at: '2026-10-04T14:10:00Z',
            administrator: { id: 'ada', username: 'alex.admin', full_name: 'Alex Morgan' },
            target: { type: 'report', id: 1033, event: { title: 'Pasta Workshop' } },
            description: 'Spam in the event chat.',
            details: ['chat'],
          },
        ],
        has_more: false,
      }),
    );

    const data = await fetchAdminAudit();
    expect(data.items[0].target_type).toBe('report');
    expect(data.items[0].target_id).toBe('1033');
    expect(data.items[0].target_title).toBe('Pasta Workshop');
  });

  it('treats status "suspended" as a suspended account', () => {
    expect(isSuspendedAccount({ status: 'suspended' })).toBe(true);
    expect(isSuspendedAccount({ is_suspended: true })).toBe(true);
    expect(isSuspendedAccount({ status: 'active' })).toBe(false);
  });

  it('maps status "suspended" on admin user details', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'u9',
        username: 'paused',
        full_name: 'Paused User',
        role: 'user',
        created_at: '2026-01-01T00:00:00Z',
        status: 'suspended',
        suspension: { reason: 'Spam', suspended_at: '2026-01-02T00:00:00Z', suspended_by: 'ada' },
      }),
    );

    const data = await fetchAdminUserDetails('u9');
    expect(data.is_suspended).toBe(true);
    expect(data.warnings).toEqual([]);
    expect(data.organized_events.upcoming).toEqual([]);
  });

  it('posts a lift-suspension reason to /api/admin/users/{id}/lift-suspension', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Suspension lifted.' }));

    const res = await liftSuspension('u1', 'Appeal accepted');
    expect(res.message).toBe('Suspension lifted.');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/admin/users/u1/lift-suspension');
    expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ reason: 'Appeal accepted' });
  });

  it('refuses to lift a suspension without a reason', async () => {
    await expect(liftSuspension('u1', '   ')).rejects.toThrow('A reason is required to lift a suspension.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the lift reason on audit-log entries', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 'a2',
            action: 'lift_suspension',
            admin_id: 'ada',
            admin_name: 'Ada',
            target_id: 'u1',
            target_type: 'user',
            reason: 'Appeal accepted',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
      }),
    );

    const data = await fetchAdminAudit(1, 20);
    expect(data.items[0].action).toBe('lift_suspension');
    expect(data.items[0].reason).toBe('Appeal accepted');
  });

  it('sendSignupInvite posts to invite_user with the encoded email', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ email: 'guest@example.com', invite_code: 'ABCD-2345', message: 'Invitation sent.' }),
    );
    const result = await sendSignupInvite('guest@example.com');
    expect(result.code).toBe('ABCD-2345');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/invite_user/guest%40example.com'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer mock_admin_token' }),
      }),
    );
  });

  it('reads an event report from target_id and event_title when event is not nested', () => {
    const refs = readUserReportRefs([
      {
        id: '41',
        status: 'open',
        reason: 'misleading_event',
        target_type: 'event',
        created_at: '2026-10-25T10:00:00Z',
        target_id: 'ev-1',
        event_title: 'Rooftop Jazz Night',
      },
    ]);
    expect(refs[0].event).toEqual({ id: 'ev-1', title: 'Rooftop Jazz Night' });
  });

  it('reads reports_made from nested reports.made', () => {
    const lists = userReportListsFromDetails({
      reports: {
        made: [{ id: '9', status: 'open', reason: 'spam', target_type: 'event', event: { id: 'ev-2', title: 'Brunch' } }],
        about: [],
      },
    });
    expect(lists.madeProvided).toBe(true);
    expect(lists.made[0].event?.title).toBe('Brunch');
  });

  it('asks the reports list for one reporter', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 11,
            status: 'open',
            target_type: 'event',
            reason: 'spam',
            origin: 'event_details',
            created_at: '2026-10-25T10:00:00Z',
            reporter: { id: 'u-alice', full_name: 'Alice' },
            event: { id: 'ev-1', title: 'Jazz' },
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        total_pages: 1,
      }),
    );
    const page = await fetchAdminReports(1, 50, undefined, { reporterId: 'u-alice' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('reporter_id=u-alice');
    expect(page.items[0].event?.title).toBe('Jazz');
  });

  it('reads a reported chat message’s text and sender from nested reported.message', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 13,
        status: 'open',
        reason: 'spam',
        origin: 'event_chat',
        created_at: '2026-10-23T08:00:00Z',
        reporter: { id: 'u-alice', full_name: 'Alice Martin', username: 'alice' },
        reported: {
          type: 'message',
          message: {
            id: 501,
            content: '{"v":1,"type":"text","text":"Buy cheap followers now!!!"}',
            sender: { id: 'u-bob', full_name: 'Bob Stone', username: 'bob' },
          },
        },
      }),
    );
    const detail = await fetchAdminReportDetail('13');
    expect(detail.target_type).toBe('message');
    expect(detail.message?.content).toBe('Buy cheap followers now!!!');
    expect(detail.message?.sender?.full_name).toBe('Bob Stone');
  });

  it('dismisses a report with POST /dismiss and no body, and reads a nested Dismissed status', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        report: {
          id: 11,
          status: 'Dismissed',
          target_type: 'event',
          reason: 'spam',
          origin: 'event_details',
          created_at: '2026-10-25T10:00:00Z',
          event: { id: 'ev-1', title: 'Jazz' },
        },
      }),
    );
    const closed = await dismissReport('11');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/admin/reports/11/dismiss');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect(closed.status).toBe('dismissed');
    expect(closed.outcome).toBe('dismissed');
    expect(closed.event?.title).toBe('Jazz');
  });

  it('falls back to POST /action when /dismiss is missing', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'Not Found' }, { status: 404 }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 11,
          status: 'dismissed',
          target_type: 'event',
          reason: 'spam',
          origin: 'event_details',
          created_at: '2026-10-25T10:00:00Z',
        }),
      );
    const closed = await dismissReport('11');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/admin/reports/11/action');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ action: 'dismiss' });
    expect(closed.status).toBe('dismissed');
  });

  it('falls back to POST /action when /dismiss returns 500', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('Internal Server Error', { status: 500, headers: { 'content-type': 'text/plain' } }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 11,
          status: 'dismissed',
          target_type: 'event',
          reason: 'spam',
          origin: 'event_details',
          created_at: '2026-10-25T10:00:00Z',
        }),
      );
    const closed = await dismissReport('11');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/admin/reports/11/action');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ action: 'dismiss' });
    expect(closed.status).toBe('dismissed');
  });

});
