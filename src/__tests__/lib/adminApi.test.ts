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
  fetchAdminReportsList,
  fetchClosedAdminReports,
  fetchOpenReportCount,
  fetchAdminReportDetail,
  dismissReport,
  actOnReport,
  removeReportedContent,
  reportActionAssignmentError,
  warningReasonFromReport,
  assignReport,
  fetchAdministrators,
  fetchAdminAccount,
  fetchAdminWorkReports,
  isOwnAuditEntry,
  readChatMessages,
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
    vi.spyOn(storageModule, 'getCurrentUser').mockReturnValue({
      id: 'u-admin',
      role: 'administrator',
      name: 'Ada Admin',
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
    expect(isOwnAuditEntry(entry, { id: 'ada', username: 'ada.admin' })).toBe(true);
    expect(isOwnAuditEntry(entry, { id: 'bob' })).toBe(false);
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

  it('maps audit names and titles instead of guids', async () => {
    const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const eventId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'a6',
              action: 'warn',
              created_at: '2026-11-04T12:00:00Z',
              admin_id: adminId,
              admin_name: adminId,
              administrator: { id: adminId, username: 'ada.admin', name: 'Ada Lovelace' },
              target: { type: 'user', id: userId, name: 'Bob Stone', username: 'bob' },
              details: [userId],
            },
            {
              id: 'a7',
              action: 'remove_event',
              created_at: '2026-11-04T12:01:00Z',
              administrator: { id: adminId, full_name: 'Ada Lovelace' },
              target: { type: 'event', id: eventId, event: { id: eventId, title: 'Rooftop Jazz Night' } },
              details: [`event_id:${eventId}`],
            },
          ],
        }),
      );
    const data = await fetchAdminAudit();
    expect(data.items[0].admin_name).toBe('Ada Lovelace');
    expect(data.items[0].target_name).toBe('Bob Stone');
    expect(data.items[0].target_username).toBe('bob');
    expect(data.items[0].details).toBeNull();
    expect(data.items[1].target_title).toBe('Rooftop Jazz Night');
    expect(data.items[1].details).toBeNull();
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
    const page = await fetchAdminReports(1, 50, 'open', { reporterId: 'u-alice' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('reporter_id=u-alice');
    expect(String(fetchMock.mock.calls[0][0])).toContain('status=open');
    expect(page.items[0].event?.title).toBe('Jazz');
  });

  it('requests dismissed and closed report lists by status', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [], total: 0, page: 1, limit: 20, total_pages: 1 }))
      .mockResolvedValueOnce(jsonResponse({ items: [], total: 0, page: 1, limit: 20, total_pages: 1 }));
    await fetchAdminReports(1, 20, 'dismissed');
    await fetchAdminReports(1, 20, 'closed');
    expect(String(fetchMock.mock.calls[0][0])).toContain('status=dismissed');
    expect(String(fetchMock.mock.calls[1][0])).toContain('status=closed');
  });

  it('merges closed and resolved lists for the Closed tab', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 16,
              status: 'action_taken',
              target_type: 'user',
              reason: 'spam',
              origin: 'profile',
              created_at: '2026-10-18T09:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
          total_pages: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 18,
              status: 'resolved',
              target_type: 'user',
              reason: 'spam',
              origin: 'profile',
              created_at: '2026-10-17T09:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
          total_pages: 1,
        }),
      );
    const page = await fetchClosedAdminReports(1, 20);
    expect(page.items.map((row) => row.id)).toEqual(['16', '18']);
    expect(page.items[0].status).toBe('resolved');
    expect(page.items[1].status).toBe('resolved');
    expect(page.total).toBe(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('status=closed');
    expect(String(fetchMock.mock.calls[1][0])).toContain('status=resolved');
  });

  it('reads the open-reports number from GET /api/admin/reports?status=open total', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 4, page: 1, limit: 20, total_pages: 1 }),
    );
    await expect(fetchOpenReportCount()).resolves.toBe(4);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/api/admin/reports');
    expect(url).toContain('status=open');
    expect(url).not.toContain('open-count');
  });

  it('reads event, user and message from a nested reported envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 29,
            status: 'dismissed',
            reason: 'scam_or_fraud',
            created_at: '2026-11-03T09:18:19.751433+00:00',
            target_type: 'message',
            origin: 'event_chat',
            reporter: { id: 'u-alice', username: 'josephe', full_name: 'joseph' },
            reported: {
              type: 'message',
              event: { id: 'ev-b', title: 'testB', name: 'testB' },
              user: { id: 'u-bob', username: 'jossy', full_name: 'Yosef' },
              message: { id: 514, event_id: 'ev-b' },
            },
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
      }),
    );
    const page = await fetchAdminReports(1, 20);
    expect(page.items[0].event).toEqual({ id: 'ev-b', title: 'testB' });
    expect(page.items[0].reported_user?.full_name).toBe('Yosef');
    expect(page.items[0].message?.id).toBe('514');
    expect(page.items[0].message?.sender?.username).toBe('jossy');
  });

  it('filters a mixed reports page onto the requested tab and counts only those rows', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        items: [
          { id: 29, status: 'dismissed', target_type: 'event', reason: 'spam', origin: 'event_details', created_at: '2026-11-03T09:18:19Z' },
          { id: 26, status: 'open', target_type: 'user', reason: 'spam', origin: 'profile', created_at: '2026-11-03T08:56:13Z' },
          { id: 25, status: 'open', target_type: 'event', reason: 'spam', origin: 'event_details', created_at: '2026-11-03T08:55:55Z' },
        ],
        total: 29,
        page: 1,
        limit: 20,
        total_pages: 1,
      }),
    );
    const open = await fetchAdminReportsList(1, 20, 'open');
    expect(open.items.map((row) => row.id)).toEqual(['26', '25']);
    expect(open.total).toBe(2);
    const dismissed = await fetchAdminReportsList(1, 20, 'dismissed');
    expect(dismissed.items.map((row) => row.id)).toEqual(['29']);
    expect(dismissed.total).toBe(1);
    await expect(fetchOpenReportCount()).resolves.toBe(2);
  });

  it('does not count closed reports in the open-reports number', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { id: 1, status: 'open', target_type: 'event', reason: 'spam', origin: 'event_details', created_at: '2026-10-25T10:00:00Z' },
          { id: 2, status: 'closed', target_type: 'event', reason: 'spam', origin: 'event_details', created_at: '2026-10-24T10:00:00Z' },
        ],
        total: 2,
        page: 1,
        limit: 20,
        total_pages: 1,
      }),
    );
    await expect(fetchOpenReportCount()).resolves.toBe(1);
  });

  it('shows only the words of an event chat message, not the stored JSON payload', () => {
    const messages = readChatMessages([
      {
        id: 900,
        sender: { id: 'u-bob', full_name: 'Bob Stone', username: 'bob' },
        content: '{"v":1,"type":"text","text":"See you at 8"}',
        created_at: '2026-10-26T10:00:00Z',
      },
      {
        id: 901,
        sender: { id: 'u-alice', full_name: 'Alice Martin', username: 'alice' },
        content: { v: 1, type: 'text', text: 'On my way' },
        created_at: '2026-10-26T10:01:00Z',
      },
    ]);
    expect(messages.map((row) => row.content)).toEqual(['See you at 8', 'On my way']);
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
    expect(detail.status).toBe('open');
    expect(detail.target_type).toBe('message');
    expect(detail.message?.content).toBe('Buy cheap followers now!!!');
    expect(detail.message?.sender?.full_name).toBe('Bob Stone');
  });

  it('keeps an open report open when content_removed is live target state', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 11,
        status: 'open',
        target_type: 'event',
        reason: 'spam',
        origin: 'event_details',
        created_at: '2026-10-25T10:00:00Z',
        content_removed: true,
        outcome: null,
      }),
    );
    const detail = await fetchAdminReportDetail('11');
    expect(detail.status).toBe('open');
    expect(detail.outcome).toBeNull();
    expect(detail.content_removed).toBe(true);
  });

  it('reads a remove action as resolved with outcome content_removed', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 11,
        status: 'resolved',
        outcome: 'content_removed',
        content_removed: true,
        target_type: 'event',
        reason: 'spam',
        origin: 'event_details',
        created_at: '2026-10-25T10:00:00Z',
      }),
    );
    const closed = await actOnReport('11', 'remove');
    expect(closed.status).toBe('resolved');
    expect(closed.outcome).toBe('content_removed');
    expect(closed.content_removed).toBe(true);
  });

  it('keeps dismissed when the target content is also gone', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 11,
        status: 'dismissed',
        outcome: 'dismissed',
        content_removed: true,
        target_type: 'event',
        reason: 'spam',
        origin: 'event_details',
        created_at: '2026-10-25T10:00:00Z',
      }),
    );
    const detail = await fetchAdminReportDetail('11');
    expect(detail.status).toBe('dismissed');
    expect(detail.outcome).toBe('dismissed');
    expect(detail.content_removed).toBe(true);
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

  it('builds a warning reason from what was reported', () => {
    expect(warningReasonFromReport({ reason: 'spam', target_type: 'message' })).toBe(
      'User is spamming the group chat.',
    );
    expect(warningReasonFromReport({ reason: 'inappropriate_content', target_type: 'event' })).toBe(
      'Inappropriate content.',
    );
    expect(warningReasonFromReport({ reason: 'harassment_or_hate', target_type: 'user' })).toBe(
      'Harassment.',
    );
  });

  it('closes a report as content removed even when the action body has no status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Removed.' }));
    const closed = await actOnReport('11', 'remove');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ action: 'remove_content' });
    expect(closed.status).toBe('resolved');
    expect(closed.outcome).toBe('content_removed');
    expect(closed.content_removed).toBe(true);
  });

  it('removes the event then resolves the report by warning the user', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ is_removed: true, removed_at: '2026-10-27T15:00:00Z' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'resolved', outcome: 'warned' }));
    const closed = await removeReportedContent(
      {
        id: '11',
        status: 'open',
        target_type: 'event',
        reason: 'spam',
        origin: 'event_details',
        created_at: '2026-10-25T10:00:00Z',
        reporter: null,
        event: { id: 'ev-1', title: 'Jazz' },
        reported_user: null,
        message: null,
        description: null,
        chat_context: [],
        content_removed: false,
        target_user: null,
        target_user_is_admin: false,
        outcome: null,
        closed_at: null,
        closed_by: null,
        assigned_to: { id: 'u-admin', full_name: 'Ada Admin', username: 'ada' },
      },
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/admin/events/ev-1/remove');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/admin/reports/11/action');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      action: 'warn',
      reason: 'User is spamming events.',
    });
    expect(closed.status).toBe('resolved');
    expect(closed.outcome).toBe('warned');
    expect(closed.content_removed).toBe(true);
  });

  it('does not remove content when the report is not assigned to the caller', async () => {
    await expect(
      removeReportedContent({
        id: '11',
        status: 'open',
        target_type: 'event',
        reason: 'spam',
        origin: 'event_details',
        created_at: '2026-10-25T10:00:00Z',
        reporter: null,
        event: { id: 'ev-1', title: 'Jazz' },
        reported_user: null,
        message: null,
        description: null,
        chat_context: [],
        content_removed: false,
        target_user: null,
        target_user_is_admin: false,
        outcome: null,
        closed_at: null,
        closed_by: null,
        assigned_to: { id: 'u-other', full_name: 'Other Admin', username: 'other' },
      }),
    ).rejects.toThrow('This report is already assigned to someone else.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      reportActionAssignmentError({ assigned_to: null }, 'u-admin'),
    ).toBe('Assign this report to yourself before taking action.');
  });

  it('assigns a report with POST /assign { admin_id }', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 11,
        status: 'open',
        assigned_to: { id: 'u-admin', full_name: 'Ada Admin', username: 'ada' },
        target_type: 'event',
        reason: 'spam',
        origin: 'event_details',
        created_at: '2026-10-25T10:00:00Z',
      }),
    );
    const assigned = await assignReport('11', 'u-admin');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/admin/reports/11/assign');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ admin_id: 'u-admin' });
    expect(assigned.assigned_to?.id).toBe('u-admin');
    expect(assigned.status).toBe('open');
  });

  it('throws when assign returns 409 because the report is already taken', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'This report is already assigned to someone else.' }, { status: 409 }),
    );
    await expect(assignReport('11', 'u-admin')).rejects.toThrow(
      'This report is already assigned to someone else.',
    );
  });

  it('lists administrators from GET /api/admin/users', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { id: 'u-admin', username: 'ada', full_name: 'Ada Admin', role: 'administrator', created_at: '2026-01-01T00:00:00Z' },
          { id: 'u-bob', username: 'bob', full_name: 'Bob Stone', role: 'participant', created_at: '2026-01-01T00:00:00Z' },
        ],
        total: 2,
        page: 1,
        limit: 50,
        total_pages: 1,
      }),
    );
    const admins = await fetchAdministrators();
    expect(admins.map((row) => row.id)).toEqual(['u-admin']);
  });

  it('reads assigned and closed reports from GET /api/admin/account', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'u-admin',
        reports_closed: 2,
        assigned_reports: [
          {
            id: 11,
            status: 'open',
            reason: 'spam',
            target_type: 'event',
            origin: 'event_details',
            created_at: '2026-10-25T10:00:00Z',
            assigned_to: { id: 'u-admin', full_name: 'Ada Admin' },
            event: { id: 'ev-1', title: 'Jazz' },
          },
        ],
        closed_reports: [
          {
            id: 12,
            status: 'dismissed',
            reason: 'other',
            target_type: 'user',
            origin: 'profile',
            created_at: '2026-10-20T10:00:00Z',
            closed_by: { id: 'u-admin', full_name: 'Ada Admin' },
          },
          {
            id: 13,
            status: 'resolved',
            reason: 'spam',
            target_type: 'message',
            origin: 'event_chat',
            created_at: '2026-10-19T10:00:00Z',
            closed_by: { id: 'u-admin', full_name: 'Ada Admin' },
          },
        ],
      }),
    );
    const account = await fetchAdminAccount();
    expect(account.reports_closed).toBe(2);
    expect(account.assigned_reports.map((row) => row.id)).toEqual(['11']);
    expect(account.closed_reports.map((row) => row.id)).toEqual(['12', '13']);
  });

  it('collects this administrator’s assigned and closed reports from the report lists', async () => {
    const ada = { id: 'u-admin', full_name: 'Ada Admin' };
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      const status = new URL(url, 'http://localhost').searchParams.get('status');
      const items =
        status === 'open'
          ? [
              {
                id: 11,
                status: 'open',
                reason: 'spam',
                target_type: 'event',
                origin: 'event_details',
                created_at: '2026-10-25T10:00:00Z',
                assigned_to: ada,
                event: { id: 'ev-1', title: 'Jazz' },
              },
            ]
          : status === 'dismissed'
            ? [
                {
                  id: 12,
                  status: 'dismissed',
                  reason: 'other',
                  target_type: 'user',
                  origin: 'profile',
                  created_at: '2026-10-20T10:00:00Z',
                  closed_by: ada,
                },
              ]
            : [
                {
                  id: 13,
                  status: 'resolved',
                  reason: 'spam',
                  target_type: 'message',
                  origin: 'event_chat',
                  created_at: '2026-10-19T10:00:00Z',
                  closed_by: ada,
                },
              ];
      return jsonResponse({ items, total: items.length, page: 1, limit: 50, total_pages: 1 });
    });
    const work = await fetchAdminWorkReports('u-admin');
    expect(work.assigned.map((row) => row.id)).toEqual(['11']);
    expect(work.closed.map((row) => row.id).sort()).toEqual(['12', '13']);
  });

  it('treats a closed report assigned to this administrator as theirs when closed_by is missing', async () => {
    fetchMock.mockImplementation(async (input) => {
      const status = new URL(String(input), 'http://localhost').searchParams.get('status');
      const items =
        status === 'closed' || status === 'resolved'
          ? [
              {
                id: 21,
                status: 'resolved',
                reason: 'spam',
                target_type: 'event',
                origin: 'event_details',
                created_at: '2026-10-19T10:00:00Z',
                assigned_to: { administrator: { id: 'u-admin', full_name: 'Ada Admin' } },
              },
            ]
          : [];
      return jsonResponse({ items, total: items.length, page: 1, limit: 50, total_pages: 1 });
    });
    const work = await fetchAdminWorkReports('u-admin');
    expect(work.closed.map((row) => row.id)).toEqual(['21']);
  });

});
