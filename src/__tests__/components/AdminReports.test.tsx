/**
 * Ticket #328: Reports tab, report details and actions, content removal, report history
 * and the closed-reports count in the administrator panel.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setAuthToken, clearAuthToken } from '@/lib/auth';
import { setCurrentUserFromOAuth, logout } from '@/lib/storage';
import AdminReportsTab from '@/components/admin/AdminReportsTab';
import AdminReportDetail from '@/components/admin/AdminReportDetail';
import AdminEventChat from '@/components/admin/AdminEventChat';
import AdminEventDetail from '@/components/admin/AdminEventDetail';
import AdminUserDetail from '@/components/admin/AdminUserDetail';
import AdminMyAccount from '@/components/admin/AdminMyAccount';
import { readChatMessages } from '@/lib/adminApi';

const realtime = vi.hoisted(() => ({ handlers: new Map<string, () => void>() }));
vi.mock('@/hooks/useRealtimeTable', () => ({
  useRealtimeTable: ({ table, onData }: { table: string; onData: () => void }) => {
    realtime.handlers.set(table, onData);
  },
}));

type Call = { method: string; path: string; search: URLSearchParams; body: unknown; cache?: RequestCache };
type Route = (call: Call) => { status?: number; body: unknown } | undefined;

let routes: Route[] = [];
let calls: Call[] = [];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(String(input), 'http://localhost');
  const call: Call = {
    method: init.method ?? 'GET',
    path: url.pathname,
    search: url.searchParams,
    body: init.body ? JSON.parse(String(init.body)) : undefined,
    cache: init.cache,
  };
  calls.push(call);
  for (const r of routes) {
    const res = r(call);
    if (res) return json(res.body, res.status ?? 200);
  }
  return json({ detail: `not mocked: ${call.method} ${call.path}` }, 404);
});

function on(method: string, path: string, respond: (call: Call) => unknown, status = 200): Route {
  return (call) => (call.method === method && call.path === path ? { status, body: respond(call) } : undefined);
}

const person = (id: string, full_name: string, username: string) => ({
  id,
  full_name,
  username,
  avatar_kind: 'icon',
  icon_id: null,
  avatar_url: null,
});

const ALICE = person('u-alice', 'Alice Martin', 'alice');
const BOB = person('u-bob', 'Bob Stone', 'bob');
const ORG = person('u-org', 'Olga Organizer', 'olga');
const ADMIN = person('u-admin', 'Ada Admin', 'ada');

const eventReport = {
  id: 11,
  status: 'open',
  target_type: 'event',
  reason: 'misleading_event',
  origin: 'event_details',
  created_at: '2026-10-25T10:30:00Z',
  reporter: ALICE,
  event: { id: 'ev-1', title: 'Rooftop Jazz Night' },
  reported_user: null,
  message: null,
};

const userReport = {
  id: 12,
  status: 'open',
  target_type: 'user',
  reason: 'harassment_or_hate',
  origin: 'profile',
  created_at: '2026-10-24T09:00:00Z',
  reporter: ALICE,
  event: null,
  reported_user: BOB,
  message: null,
};

const messageReport = {
  id: 13,
  status: 'open',
  target_type: 'message',
  reason: 'spam',
  origin: 'event_chat',
  created_at: '2026-10-23T08:00:00Z',
  reporter: ALICE,
  event: { id: 'ev-2', title: 'Board Games Evening' },
  reported_user: BOB,
  message: { id: 501, content: 'Buy cheap followers now!!!', sender: BOB },
};

const dismissedReport = { ...userReport, id: 14, status: 'dismissed', created_at: '2026-10-20T08:00:00Z' };
const actionTakenReport = { ...userReport, id: 16, status: 'action_taken', created_at: '2026-10-18T09:00:00Z' };

function detail(summary: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    ...summary,
    description: 'Please check this.',
    chat_context: [],
    content_removed: false,
    target_user: summary.target_type === 'event' ? ORG : BOB,
    target_user_is_admin: false,
    outcome: null,
    closed_at: null,
    closed_by: null,
    ...extra,
  };
}

beforeEach(() => {
  setAuthToken('admin-token');
  setCurrentUserFromOAuth({
    id: 'u-admin',
    email: 'ada@test.com',
    name: 'Ada Admin',
    username: 'ada',
    role: 'administrator',
  });
  routes = [];
  calls = [];
  realtime.handlers.clear();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  clearAuthToken();
  logout();
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------------------ */
/* Reports tab                                                               */
/* ------------------------------------------------------------------------ */

describe('Reports tab', () => {
  const page = (items: unknown[], pageNo: number, totalPages: number, total: number) => ({
    items,
    page: pageNo,
    limit: 20,
    total,
    total_pages: totalPages,
  });
  /** GET /api/admin/reports/open: every open report with their number, not paged. */
  const openList = (items: () => unknown[]) => on('GET', '/api/admin/reports/open', () => ({ total: items().length, items: items() }));

  it('shows open reports by default, each with reporter, item, reason, time and status', async () => {
    routes.push(
      openList(() => [eventReport, userReport]),
      on('GET', '/api/admin/reports', () => page([dismissedReport], 1, 1, 1)),
    );
    render(<AdminReportsTab onOpenReport={vi.fn()} onErrorToast={vi.fn()} />);

    const open = await screen.findByRole('region', { name: 'open-reports' });
    await within(open).findByText('Rooftop Jazz Night');
    expect(within(open).getByTestId('open-reports-count')).toHaveTextContent('Open reports · 2');
    expect(within(open).getByText(/Reports not handled yet/)).toBeInTheDocument();
    const row = within(open).getByRole('button', { name: /report by Alice Martin about Rooftop Jazz Night/ });
    expect(row).toHaveTextContent('Reported by');
    expect(row).toHaveTextContent('Alice Martin');
    expect(row).toHaveTextContent('Misleading event');
    expect(row).toHaveTextContent('From event page');
    expect(row).toHaveTextContent('2026-10-25');
    expect(row).toHaveTextContent('Open');
    expect(within(open).queryByText('Dismissed')).not.toBeInTheDocument();
    expect(calls.some((c) => c.path === '/api/admin/reports/open')).toBe(true);
    expect(calls.every((c) => c.cache === 'no-store')).toBe(true);
  });

  it('filters to dismissed reports', async () => {
    routes.push(
      on('GET', '/api/admin/reports', (c) =>
        c.search.get('status') === 'dismissed'
          ? page([dismissedReport], 1, 1, 1)
          : page([eventReport, userReport], 1, 1, 2),
      ),
    );
    render(<AdminReportsTab onOpenReport={vi.fn()} onErrorToast={vi.fn()} />);
    await screen.findByRole('region', { name: 'open-reports' });

    fireEvent.click(screen.getByRole('tab', { name: 'Dismissed' }));

    const dismissed = await screen.findByRole('region', { name: 'dismissed-reports' });
    expect(within(dismissed).getByTestId('dismissed-reports-count')).toHaveTextContent('Dismissed reports · 1');
    expect(within(dismissed).getByText('Dismissed')).toBeInTheDocument();
    expect(within(dismissed).queryByText('Rooftop Jazz Night')).not.toBeInTheDocument();
    expect(calls.some((c) => c.search.get('status') === 'dismissed')).toBe(true);
  });

  it('filters to closed reports, including action taken', async () => {
    const closedStatusReport = { ...actionTakenReport, id: 17, status: 'closed', outcome: 'content_removed' };
    routes.push(
      on('GET', '/api/admin/reports', (c) => {
        const status = c.search.get('status');
        if (status === 'closed') return page([actionTakenReport, closedStatusReport], 1, 1, 2);
        if (status === 'resolved') {
          return page(
            [{ ...actionTakenReport, id: 18, status: 'resolved', created_at: '2026-10-17T09:00:00Z' }],
            1,
            1,
            1,
          );
        }
        return page([eventReport, userReport], 1, 1, 2);
      }),
    );
    render(<AdminReportsTab onOpenReport={vi.fn()} onErrorToast={vi.fn()} />);
    await screen.findByRole('region', { name: 'open-reports' });

    fireEvent.click(screen.getByRole('tab', { name: 'Closed' }));

    const closed = await screen.findByRole('region', { name: 'closed-reports' });
    expect(within(closed).getByTestId('closed-reports-count')).toHaveTextContent('Closed reports · 3');
    expect(within(closed).getAllByText('Resolved').length).toBeGreaterThanOrEqual(2);
    expect(within(closed).queryByText('Rooftop Jazz Night')).not.toBeInTheDocument();
    expect(calls.some((c) => c.search.get('status') === 'closed')).toBe(true);
    expect(calls.some((c) => c.search.get('status') === 'resolved')).toBe(true);
  });

  it('loads more closed reports on request', async () => {
    const closedPage2 = { ...actionTakenReport, id: 15, created_at: '2026-10-19T08:00:00Z' };
    routes.push(
      on('GET', '/api/admin/reports', (c) => {
        const status = c.search.get('status');
        if (status !== 'closed' && status !== 'resolved') return page([], 1, 1, 0);
        if (status === 'resolved') return page([], 1, 1, 0);
        return c.search.get('page') === '2' ? page([closedPage2], 2, 2, 2) : page([actionTakenReport], 1, 2, 2);
      }),
    );
    render(<AdminReportsTab onOpenReport={vi.fn()} onErrorToast={vi.fn()} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Closed' }));

    const closed = await screen.findByRole('region', { name: 'closed-reports' });
    fireEvent.click(await within(closed).findByRole('button', { name: 'Load more' }));
    expect(await within(closed).findByText(/2026-10-19/)).toBeInTheDocument();
    expect(within(closed).queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('fetches the open reports again on a live update', async () => {
    let openItems: unknown[] = [eventReport];
    routes.push(openList(() => openItems), on('GET', '/api/admin/reports', () => page([], 1, 1, 0)));
    const { rerender } = render(<AdminReportsTab onOpenReport={vi.fn()} onErrorToast={vi.fn()} liveVersion={0} />);
    const open = await screen.findByRole('region', { name: 'open-reports' });
    await within(open).findByText('Rooftop Jazz Night');

    openItems = [messageReport, eventReport];
    rerender(<AdminReportsTab onOpenReport={vi.fn()} onErrorToast={vi.fn()} liveVersion={1} />);
    expect(await within(open).findByText('Bob Stone')).toBeInTheDocument();
    expect(within(open).getByText('From event chat')).toBeInTheDocument();
    expect(within(open).getByTestId('open-reports-count')).toHaveTextContent('Open reports · 2');
  });

  it('lists a chat report with the sender and the reported text', async () => {
    routes.push(openList(() => [messageReport]));
    render(<AdminReportsTab onOpenReport={vi.fn()} onErrorToast={vi.fn()} />);
    const open = await screen.findByRole('region', { name: 'open-reports' });
    const row = await within(open).findByRole('button', { name: /report by Alice Martin about Message by Bob Stone/ });
    expect(row).toHaveTextContent('Message');
    expect(row).toHaveTextContent('Bob Stone');
    expect(row).toHaveTextContent('Buy cheap followers now!!!');
  });

  it('shows who an open report is assigned to', async () => {
    routes.push(
      openList(() => [{ ...eventReport, assigned_to: { id: 'u-admin', full_name: 'Ada Admin', username: 'ada' } }]),
    );
    render(<AdminReportsTab onOpenReport={vi.fn()} onErrorToast={vi.fn()} />);
    const open = await screen.findByRole('region', { name: 'open-reports' });
    expect(within(open).getByText(/Assigned to Ada Admin/)).toBeInTheDocument();
  });

  it('opens a report when its row is pressed', async () => {
    routes.push(openList(() => [userReport]));
    const onOpenReport = vi.fn();
    render(<AdminReportsTab onOpenReport={onOpenReport} onErrorToast={vi.fn()} />);
    const open = await screen.findByRole('region', { name: 'open-reports' });
    fireEvent.click(await within(open).findByRole('button', { name: /report by Alice Martin about Bob Stone/ }));
    expect(onOpenReport).toHaveBeenCalledWith('12');
  });
});

/* ------------------------------------------------------------------------ */
/* Report details                                                            */
/* ------------------------------------------------------------------------ */

function renderDetail(reportBody: unknown, props: Partial<React.ComponentProps<typeof AdminReportDetail>> = {}) {
  routes.push(on('GET', `/api/admin/reports/${(reportBody as { id: number }).id}`, () => reportBody));
  const handlers = {
    onOpenEvent: vi.fn(),
    onOpenUser: vi.fn(),
    onReportClosed: vi.fn(),
    onErrorToast: vi.fn(),
    onSuccessToast: vi.fn(),
  };
  render(
    <AdminReportDetail
      reportId={String((reportBody as { id: number }).id)}
      onBack={vi.fn()}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('Report details', () => {
  it('shows the reporter, the item with its open button, the reason, the description, the time and the origin', async () => {
    const h = renderDetail(detail(eventReport));
    expect(await screen.findByText('Reported item')).toBeInTheDocument();
    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('Misleading event')).toBeInTheDocument();
    expect(screen.getByText('Please check this.')).toBeInTheDocument();
    expect(screen.getByText(/Oct 25, 2026/)).toBeInTheDocument();
    expect(screen.getByText('Event details')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open event/ }));
    expect(h.onOpenEvent).toHaveBeenCalledWith('ev-1');
  });

  it('opens the reported user details for a user report', async () => {
    const h = renderDetail(detail(userReport));
    const item = await screen.findByLabelText('Reported item');
    fireEvent.click(within(item).getByRole('button', { name: /Open user/ }));
    expect(h.onOpenUser).toHaveBeenCalledWith('u-bob');
  });

  it('for a chat report, offers the event details and shows the chat context with the reported message marked', async () => {
    const h = renderDetail(
      detail(messageReport, {
        chat_context: [
          { id: 500, sender_name: 'Alice Martin', content: 'Who brings the dice?', created_at: '2026-10-23T07:58:00Z' },
          { id: 501, sender_name: 'Bob Stone', content: 'Buy cheap followers now!!!', created_at: '2026-10-23T07:59:00Z', reported: true },
        ],
      }),
    );
    const context = await screen.findByRole('list', { name: 'Chat context' });
    const marked = within(context).getByText('Reported message').closest('li')!;
    expect(marked).toHaveAttribute('data-reported', 'true');
    expect(marked).toHaveTextContent('Buy cheap followers now!!!');
    expect(within(context).getByText('Who brings the dice?').closest('li')).not.toHaveAttribute('data-reported');

    fireEvent.click(screen.getByRole('button', { name: /Open event details/ }));
    expect(h.onOpenEvent).toHaveBeenCalledWith('ev-2');
    expect(await screen.findByText('Sender: Bob Stone')).toBeInTheDocument();
    expect(screen.getByTestId('reported-message-text')).toHaveTextContent('Buy cheap followers now!!!');
  });

  it('offers Dismiss, Warn, Remove and Suspend on an open event report, and says warning and suspending apply to the organizer', async () => {
    renderDetail(detail(eventReport));
    for (const label of ['Dismiss', 'Warn the user', 'Remove the reported content', 'Suspend the user']) {
      expect(await screen.findByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText(/apply to the event's organizer, Olga Organizer/)).toBeInTheDocument();
    expect(screen.getByText(/Removing content also warns them/)).toBeInTheDocument();
  });

  it('does not offer removal for a profile report, and says why', async () => {
    renderDetail(detail(userReport));
    await screen.findByRole('button', { name: 'Dismiss' });
    expect(screen.queryByRole('button', { name: 'Remove the reported content' })).not.toBeInTheDocument();
    expect(screen.getByText(/no content to remove: this report is about a user/)).toBeInTheDocument();
  });

  it('does not offer removal when the content is already removed, and says why', async () => {
    renderDetail(detail(messageReport, { content_removed: true }));
    await screen.findByRole('button', { name: 'Dismiss' });
    expect(screen.queryByRole('button', { name: 'Remove the reported content' })).not.toBeInTheDocument();
    expect(screen.getByText('The reported message is already removed.')).toBeInTheDocument();
    expect(screen.getByText('Content is removed')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('does not offer Warn or Suspend when the reported user is now an administrator, and says so', async () => {
    renderDetail(detail(userReport, { target_user: ADMIN, target_user_is_admin: true }));
    await screen.findByRole('button', { name: 'Dismiss' });
    expect(screen.queryByRole('button', { name: 'Warn the user' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend the user' })).not.toBeInTheDocument();
    expect(screen.getByText(/Ada Admin is now an administrator/)).toBeInTheDocument();
  });

  it('shows the outcome of a closed report and no actions', async () => {
    renderDetail(
      detail(dismissedReport, { outcome: 'dismissed', closed_at: '2026-10-21T12:00:00Z', closed_by: ADMIN }),
    );
    const outcome = await screen.findByLabelText('Outcome');
    expect(outcome).toHaveTextContent('Outcome: Dismissed');
    expect(outcome).toHaveTextContent('Closed by Ada Admin');
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Warn the user' })).not.toBeInTheDocument();
  });

  it('shows dismissed even when the backend still returns the report as open', async () => {
    routes.push(
      on('POST', '/api/admin/reports/11/dismiss', () => detail(eventReport)),
    );
    renderDetail(detail(eventReport));
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Dismiss' }));

    expect(await screen.findByLabelText('Outcome')).toHaveTextContent('Dismissed');
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    expect(screen.getByText('Dismissed')).toBeInTheDocument();
  });

  it('dismisses after confirmation and then shows the outcome', async () => {
    routes.push(
      on('POST', '/api/admin/reports/11/dismiss', () =>
        detail(eventReport, { status: 'dismissed', outcome: 'dismissed', closed_by: ADMIN }),
      ),
    );
    const h = renderDetail(detail(eventReport));
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Dismiss' }));

    expect(await screen.findByLabelText('Outcome')).toHaveTextContent('Dismissed');
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/admin/reports/11/dismiss')).toBe(true);
    expect(h.onReportClosed).toHaveBeenCalled();
  });

  it('warns with a required reason', async () => {
    routes.push(
      on('POST', '/api/admin/reports/12/action', () =>
        detail(userReport, { status: 'resolved', outcome: 'warned' }),
      ),
    );
    renderDetail(detail(userReport));
    fireEvent.click(await screen.findByRole('button', { name: 'Warn the user' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByLabelText('Reason')).toHaveValue('Harassment.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Warn' }));

    expect(await screen.findByLabelText('Outcome')).toHaveTextContent('The user was warned');
    const post = calls.find((c) => c.path === '/api/admin/reports/12/action');
    expect(post?.body).toEqual({ action: 'warn', reason: 'Harassment.' });
  });

  it('removes the reported event through the report action, which resolves the report', async () => {
    routes.push(
      on('POST', '/api/admin/reports/11/action', () =>
        detail(eventReport, { status: 'resolved', outcome: 'content_removed', content_removed: true }),
      ),
    );
    const h = renderDetail(detail(eventReport, { assigned_to: ADMIN }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the reported content' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('marked as removed, not deleted');
    expect(within(dialog).queryByLabelText('Reason')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(await screen.findByLabelText('Outcome')).toHaveTextContent('The reported content was removed');
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].path).toBe('/api/admin/reports/11/action');
    expect(posts[0].body).toEqual({ action: 'remove_content' });
    expect(h.onReportClosed).toHaveBeenCalled();
  });

  it('removes the reported chat message through the report action', async () => {
    routes.push(
      on('POST', '/api/admin/reports/13/action', () =>
        detail(messageReport, { status: 'resolved', outcome: 'content_removed', content_removed: true }),
      ),
    );
    renderDetail(detail(messageReport, { assigned_to: ADMIN }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the reported content' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove' }));

    expect(await screen.findByLabelText('Outcome')).toHaveTextContent('The reported content was removed');
    expect(calls.find((c) => c.path === '/api/admin/reports/13/action')?.body).toEqual({ action: 'remove_content' });
  });

  it('offers Warn and Suspend from the backend fields: the reported user, or the organizer of an event', async () => {
    // Real backend shape: no target_user; the user is in reported.user, the admin flag is reported_user_is_administrator.
    const { target_user: _t, target_user_is_admin: _a, ...userBody } = detail(userReport) as Record<string, unknown>;
    renderDetail({ ...userBody, reported_user: undefined, reported: { type: 'user', user: BOB }, reported_user_is_administrator: false });
    expect(await screen.findByRole('button', { name: 'Warn the user' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suspend the user' })).toBeInTheDocument();
    expect(screen.queryByText(/no longer exists/)).not.toBeInTheDocument();
  });

  it('offers Warn and Suspend on an event report without the organizer in the data', async () => {
    const { target_user: _t, target_user_is_admin: _a, ...eventBody } = detail(eventReport) as Record<string, unknown>;
    renderDetail({ ...eventBody, reported: { type: 'event', event: { id: 'ev-1', title: 'Rooftop Jazz Night' } } });
    expect(await screen.findByRole('button', { name: 'Warn the user' })).toBeInTheDocument();
    expect(screen.getByText(/apply to the event's organizer\./)).toBeInTheDocument();
    expect(screen.queryByText(/no longer exists/)).not.toBeInTheDocument();
  });

  it('hides Warn and Suspend when reported_user_is_administrator is true', async () => {
    const { target_user: _t, target_user_is_admin: _a, ...userBody } = detail(userReport) as Record<string, unknown>;
    renderDetail({ ...userBody, reported_user: undefined, reported: { type: 'user', user: ADMIN }, reported_user_is_administrator: true });
    await screen.findByRole('button', { name: 'Dismiss' });
    expect(screen.queryByRole('button', { name: 'Warn the user' })).not.toBeInTheDocument();
    expect(screen.getByText(/Ada Admin is now an administrator/)).toBeInTheDocument();
  });

  it('names the event of an event report from reported.event', async () => {
    renderDetail({
      ...detail(eventReport),
      event: undefined,
      reported: { type: 'event', event: { id: 'ev-1', title: 'Rooftop Jazz Night', name: 'Rooftop Jazz Night' } },
    });
    expect(await screen.findByRole('heading', { name: 'Rooftop Jazz Night' })).toBeInTheDocument();
    expect(screen.queryByText('Unknown event')).not.toBeInTheDocument();
  });

  it('does not remove content when the report is assigned to someone else', async () => {
    routes.push(
      on('POST', '/api/admin/events/ev-1/remove', () => ({
        event_id: 'ev-1',
        is_removed: true,
      })),
    );
    const h = renderDetail(
      detail(eventReport, {
        assigned_to: { id: 'u-other', full_name: 'Other Admin', username: 'other' },
      }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the reported content' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(h.onErrorToast).toHaveBeenCalledWith('This report is already assigned to someone else.');
    });
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/admin/events/ev-1/remove')).toBe(false);
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/admin/reports/11/action')).toBe(false);
  });

  it('assigns an open report to the signed-in administrator', async () => {
    setCurrentUserFromOAuth({
      id: 'u-admin',
      email: 'ada@example.com',
      name: 'Ada Admin',
      username: 'ada',
      role: 'administrator',
    });
    routes.push(
      on('POST', '/api/admin/reports/11/assign', () =>
        detail(eventReport, {
          assigned_to: { id: 'u-admin', full_name: 'Ada Admin', username: 'ada' },
        }),
      ),
    );
    const h = renderDetail(detail(eventReport));
    fireEvent.click(await screen.findByRole('button', { name: 'Assign to me' }));
    expect(await screen.findByLabelText('Assigned administrator')).toHaveTextContent('Ada Admin');
    const post = calls.find((c) => c.path === '/api/admin/reports/11/assign');
    expect(post?.body).toEqual({ admin_id: 'u-admin' });
    expect(h.onSuccessToast).toHaveBeenCalledWith('Report assigned to you.');
    expect(screen.queryByRole('button', { name: 'Assign to me' })).not.toBeInTheDocument();
  });

  it('assigns an open report to another administrator', async () => {
    setCurrentUserFromOAuth({
      id: 'u-admin',
      email: 'ada@example.com',
      name: 'Ada Admin',
      username: 'ada',
      role: 'administrator',
    });
    routes.push(
      on('GET', '/api/admin/users', () => ({
        items: [
          { id: 'u-admin', username: 'ada', full_name: 'Ada Admin', role: 'administrator', created_at: '2026-01-01T00:00:00Z' },
          { id: 'u-alex', username: 'alex', full_name: 'Alex Morgan', role: 'administrator', created_at: '2026-01-01T00:00:00Z' },
        ],
        total: 2,
        page: 1,
        limit: 50,
        total_pages: 1,
      })),
      on('POST', '/api/admin/reports/11/assign', () =>
        detail(eventReport, {
          assigned_to: { id: 'u-alex', full_name: 'Alex Morgan', username: 'alex' },
        }),
      ),
    );
    renderDetail(detail(eventReport));
    fireEvent.click(await screen.findByRole('button', { name: 'Assign to another' }));
    fireEvent.click(await screen.findByRole('button', { name: /Alex Morgan/ }));
    expect(await screen.findByLabelText('Assigned administrator')).toHaveTextContent('Alex Morgan');
    const post = calls.find((c) => c.path === '/api/admin/reports/11/assign');
    expect(post?.body).toEqual({ admin_id: 'u-alex' });
  });

  it('shows the 409 when the report is already assigned to someone else', async () => {
    setCurrentUserFromOAuth({
      id: 'u-admin',
      email: 'ada@example.com',
      name: 'Ada Admin',
      username: 'ada',
      role: 'administrator',
    });
    routes.push(
      on(
        'POST',
        '/api/admin/reports/11/assign',
        () => ({ detail: 'This report is already assigned to someone else.' }),
        409,
      ),
    );
    const h = renderDetail(detail(eventReport));
    fireEvent.click(await screen.findByRole('button', { name: 'Assign to me' }));
    await waitFor(() =>
      expect(h.onErrorToast).toHaveBeenCalledWith('This report is already assigned to someone else.'),
    );
    expect(screen.getByRole('button', { name: 'Assign to me' })).toBeInTheDocument();
  });

  it('shows the reason when the backend refuses an action', async () => {
    routes.push(
      on('POST', '/api/admin/events/ev-1/remove', () => ({ is_removed: true })),
      on(
        'POST',
        '/api/admin/reports/11/action',
        () => ({ detail: { code: 'already_closed', message: 'This report is already closed.' } }),
        409,
      ),
    );
    const h = renderDetail(detail(eventReport, { assigned_to: ADMIN }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the reported content' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('marked as removed, not deleted');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(h.onErrorToast).toHaveBeenCalledWith('This report is already closed.'));
  });
});

/* ------------------------------------------------------------------------ */
/* Content removal                                                           */
/* ------------------------------------------------------------------------ */

const eventDetailBody = {
  id: 'ev-1',
  title: 'Rooftop Jazz Night',
  category: 'music',
  start_datetime: '2026-11-02T19:00:00Z',
  status: 'active',
  is_cancelled: false,
  organizer: ORG,
  participants: [],
  participant_count: 0,
  chats: [
    { id: 900, sender: BOB, content: 'Spam spam spam', created_at: '2026-10-26T10:00:00Z', is_removed: false },
  ],
};

describe('Admin event map', () => {
  it('pins the event at the coordinates from the admin event payload', async () => {
    routes.push(
      on('GET', '/api/admin/events/ev-1', () => ({
        ...eventDetailBody,
        location_name: 'InnoWi, Bremen',
        location: { type: 'Point', coordinates: [8.848829, 53.107601] },
      })),
    );
    render(
      <AdminEventDetail eventId="ev-1" onBack={vi.fn()} onErrorToast={vi.fn()} onSuccessToast={vi.fn()} />,
    );
    expect(await screen.findByRole('img', { name: /Map showing event location at 53.107601, 8.848829/ })).toBeInTheDocument();
    expect(screen.getAllByText('InnoWi, Bremen').length).toBeGreaterThan(0);
    expect(screen.queryByText('Map (placeholder)')).not.toBeInTheDocument();
  });
});

describe('Remove event', () => {
  it('asks for confirmation that says it is marked as removed, not deleted, and then shows who removed it and when', async () => {
    routes.push(
      on('GET', '/api/admin/events/ev-1', () => eventDetailBody),
      on('POST', '/api/admin/events/ev-1/remove', () => ({
        event_id: 'ev-1',
        is_removed: true,
        removed_at: '2026-10-27T15:00:00Z',
        removed_by: ADMIN,
      })),
    );
    render(<AdminEventDetail eventId="ev-1" onBack={vi.fn()} onErrorToast={vi.fn()} onSuccessToast={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /Remove event/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('marked as removed, not deleted');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove event' }));

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent('Removed by an administrator (Ada Admin)');
    expect(banner).toHaveTextContent('marked as removed, not deleted');
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/admin/events/ev-1/remove')).toBe(true);
    expect(screen.queryByRole('button', { name: /Remove event/ })).not.toBeInTheDocument();
  });

  it('shows an already removed event as removed', async () => {
    routes.push(
      on('GET', '/api/admin/events/ev-1', () => ({ ...eventDetailBody, is_removed: true, removed_at: '2026-10-27T15:00:00Z', removed_by: ADMIN })),
    );
    render(<AdminEventDetail eventId="ev-1" onBack={vi.fn()} onErrorToast={vi.fn()} onSuccessToast={vi.fn()} />);
    expect(await screen.findByRole('status')).toHaveTextContent('Removed by an administrator');
  });
});

describe('Remove message', () => {
  it('opens the event chat with the message text, not the stored JSON', async () => {
    routes.push(
      on('GET', '/api/admin/events/ev-1', () => ({
        ...eventDetailBody,
        chats: [
          {
            id: 900,
            sender: BOB,
            content: '{"v":1,"type":"text","text":"See you at 8"}',
            created_at: '2026-10-26T10:00:00Z',
            is_removed: false,
          },
        ],
      })),
    );
    render(<AdminEventDetail eventId="ev-1" onBack={vi.fn()} onErrorToast={vi.fn()} onSuccessToast={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Open event chat/i }));
    const chat = await screen.findByLabelText('Event chat');
    expect(within(chat).getByText('See you at 8')).toBeInTheDocument();
    expect(within(chat).queryByText(/"type":"text"/)).not.toBeInTheDocument();
  });

  it('removes a message through the backend after confirmation and shows it as removed by an administrator', async () => {
    routes.push(
      on('POST', '/api/admin/events/ev-1/messages/900/remove', () => ({
        event_id: 'ev-1',
        message_id: 900,
        is_removed: true,
        removed_at: '2026-10-27T15:00:00Z',
        removed_by: ADMIN,
      })),
    );
    function Harness() {
      const [messages, setMessages] = React.useState(readChatMessages(eventDetailBody.chats));
      return (
        <AdminEventChat
          eventId="ev-1"
          eventTitle="Rooftop Jazz Night"
          messages={messages}
          onMessageRemoved={(id, removal) =>
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_removed: true, ...removal } : m)))
          }
          onBack={vi.fn()}
          onErrorToast={vi.fn()}
          onSuccessToast={vi.fn()}
        />
      );
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove message by Bob Stone' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('marked as removed, not deleted');
    expect(calls).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove message' }));

    expect(await screen.findByText(/Removed by an administrator \(Ada Admin\)/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/api/admin/events/ev-1/messages/900/remove')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Remove message by Bob Stone' })).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------------ */
/* User details report history, My account                                   */
/* ------------------------------------------------------------------------ */

const userBody = (extra: Record<string, unknown>) => ({
  id: 'u-bob',
  username: 'bob',
  full_name: 'Bob Stone',
  created_at: '2026-01-01T00:00:00Z',
  is_admin: false,
  role: 'participant',
  status: 'active',
  organized_events: { upcoming: [], past: [], cancelled: [] },
  joined_events: { upcoming: [], past: [], cancelled: [] },
  warnings: [],
  ...extra,
});

describe('Report history in user details', () => {
  it('lists the reports about the user, marking their events, and the reports they made; each opens its report', async () => {
    routes.push(
      on('GET', '/api/admin/users/u-bob', () =>
        userBody({
          reports_about: [
            { id: 21, status: 'open', reason: 'spam', target_type: 'event', created_at: '2026-10-25T10:00:00Z', event: { id: 'ev-9', title: 'Bob Party' } },
            { id: 22, status: 'action_taken', reason: 'harassment_or_hate', target_type: 'user', created_at: '2026-10-20T10:00:00Z', event: null },
          ],
          reports_made: [
            { id: 23, status: 'dismissed', reason: 'other', target_type: 'user', created_at: '2026-10-19T10:00:00Z', event: null },
            {
              id: 24,
              status: 'open',
              reason: 'misleading_event',
              target_type: 'event',
              created_at: '2026-10-25T11:00:00Z',
              target_id: 'ev-1',
              event_title: 'Rooftop Jazz Night',
            },
          ],
        }),
      ),
      on('GET', '/api/admin/users/u-bob/warnings', () => ({ items: [] })),
    );
    const onOpenReport = vi.fn();
    render(
      <MemoryRouter>
        <AdminUserDetail userId="u-bob" onBack={vi.fn()} onOpenReport={onOpenReport} onErrorToast={vi.fn()} onSuccessToast={vi.fn()} />
      </MemoryRouter>,
    );

    const about = await screen.findByLabelText('Reports about this user');
    expect(within(about).getByText('Event: Bob Party')).toBeInTheDocument();
    expect(within(about).getByText('Open')).toBeInTheDocument();
    expect(within(about).getByText('Resolved')).toBeInTheDocument();
    expect(within(about).getByText('2026-10-25')).toBeInTheDocument();

    const made = screen.getByLabelText('Reports made by this user');
    expect(within(made).getByText('Dismissed')).toBeInTheDocument();
    expect(within(made).getByText('Event: Rooftop Jazz Night')).toBeInTheDocument();
    expect(screen.getByTestId('action-reports-made')).toHaveTextContent('Reports they made');
    fireEvent.click(within(made).getByRole('button', { name: /Open report: Other/ }));
    expect(onOpenReport).toHaveBeenCalledWith('23');
  });

  it('loads event reports they filed when user details omit reports_made', async () => {
    routes.push(
      on('GET', '/api/admin/users/u-bob', () => userBody({ reports_made: [] })),
      on('GET', '/api/admin/users/u-bob/warnings', () => ({ items: [] })),
      on('GET', '/api/admin/reports', () => ({
        items: [
          {
            id: 40,
            status: 'open',
            target_type: 'event',
            reason: 'spam',
            origin: 'event_details',
            created_at: '2026-10-25T12:00:00Z',
            reporter: BOB,
            event: { id: 'ev-jazz', title: 'Rooftop Jazz Night' },
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        total_pages: 1,
      })),
    );
    const onOpenEvent = vi.fn();
    render(
      <MemoryRouter>
        <AdminUserDetail userId="u-bob" onBack={vi.fn()} onOpenEvent={onOpenEvent} onErrorToast={vi.fn()} onSuccessToast={vi.fn()} />
      </MemoryRouter>,
    );
    const made = await screen.findByLabelText('Reports made by this user');
    expect(await within(made).findByText('Event: Rooftop Jazz Night')).toBeInTheDocument();
    fireEvent.click(within(made).getByRole('button', { name: /Open event/i }));
    expect(onOpenEvent).toHaveBeenCalledWith('ev-jazz');
  });

  it("shows no report history in an administrator's details", async () => {
    routes.push(
      on('GET', '/api/admin/users/u-bob', () => userBody({ is_admin: true, role: 'administrator', reports_about: [], reports_made: [] })),
      on('GET', '/api/admin/users/u-bob/warnings', () => ({ items: [] })),
    );
    render(
      <MemoryRouter>
        <AdminUserDetail userId="u-bob" onBack={vi.fn()} onErrorToast={vi.fn()} onSuccessToast={vi.fn()} />
      </MemoryRouter>,
    );
    await screen.findAllByText('Bob Stone');
    expect(screen.queryByText('Report history')).not.toBeInTheDocument();
  });
});

describe('My account', () => {
  it('shows how many reports this administrator closed', async () => {
    routes.push(
      on('GET', '/api/admin/users/u-admin', () => userBody({ id: 'u-admin', full_name: 'Ada Admin', is_admin: true, role: 'administrator' })),
      on('GET', '/api/admin/account', () => ({ id: 'u-admin', role: 'administrator', reports_closed: 7 })),
    );
    render(<AdminMyAccount adminId="u-admin" onClose={vi.fn()} />);
    expect(await screen.findByTestId('reports-closed-count')).toHaveTextContent('7');
  });

  it('lists assigned reports and every report this administrator closed', async () => {
    const ada = { id: 'u-admin', full_name: 'Ada Admin' };
    routes.push(
      on('GET', '/api/admin/users/u-admin', () => userBody({ id: 'u-admin', full_name: 'Ada Admin', is_admin: true, role: 'administrator' })),
      on('GET', '/api/admin/account', () => ({
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
            assigned_to: ada,
            event: { id: 'ev-1', title: 'Rooftop Jazz Night' },
          },
        ],
        closed_reports: [
          {
            id: 14,
            status: 'dismissed',
            reason: 'other',
            target_type: 'user',
            origin: 'profile',
            created_at: '2026-10-20T08:00:00Z',
            closed_by: ada,
            reported_user: BOB,
          },
          {
            id: 13,
            status: 'resolved',
            reason: 'spam',
            target_type: 'message',
            origin: 'event_chat',
            created_at: '2026-10-19T10:00:00Z',
            closed_by: ada,
            event: { id: 'ev-2', title: 'Board Games Evening' },
          },
        ],
      })),
    );
    const onOpenReport = vi.fn();
    render(<AdminMyAccount adminId="u-admin" onClose={vi.fn()} onOpenReport={onOpenReport} />);
    expect(await screen.findByTestId('reports-assigned-count')).toHaveTextContent('1');
    expect(screen.getByTestId('reports-closed-count')).toHaveTextContent('2');
    const assigned = screen.getByLabelText('Assigned to you');
    expect(within(assigned).getByText(/Rooftop Jazz Night/)).toBeInTheDocument();
    const closed = screen.getByLabelText('Closed by you');
    expect(within(closed).getByText('Dismissed')).toBeInTheDocument();
    expect(within(closed).getByText('Resolved')).toBeInTheDocument();
    fireEvent.click(within(assigned).getByRole('button', { name: /Open report: Spam/ }));
    expect(onOpenReport).toHaveBeenCalledWith('11');
  });

  it('shows this administrator’s audit activity', async () => {
    routes.push(
      on('GET', '/api/admin/users/u-admin', () => userBody({ id: 'u-admin', full_name: 'Ada Admin', username: 'ada', is_admin: true, role: 'administrator' })),
      on('GET', '/api/admin/account', () => ({ id: 'u-admin', reports_closed: 0, assigned_reports: [], closed_reports: [] })),
      on('GET', '/api/admin/audit-log', () => ({
        items: [
          {
            id: 'a1',
            action: 'warn',
            created_at: '2026-10-25T12:00:00Z',
            administrator: { id: 'u-admin', full_name: 'Ada Admin', username: 'ada' },
            target: { type: 'user', id: 'u-bob', user: { id: 'u-bob', full_name: 'Bob Stone', username: 'bob' } },
            description: 'Harassment.',
          },
          {
            id: 'a2',
            action: 'suspend',
            created_at: '2026-10-24T12:00:00Z',
            administrator: { id: 'u-other', full_name: 'Other Admin', username: 'other' },
            target: { type: 'user', id: 'u-bob', user: { id: 'u-bob', full_name: 'Bob Stone' } },
          },
        ],
        has_more: false,
        next_before: null,
      })),
    );
    render(<AdminMyAccount adminId="u-admin" onClose={vi.fn()} />);
    const activity = await screen.findByLabelText('Your activity');
    expect(within(activity).getByText('Warned')).toBeInTheDocument();
    expect(within(activity).getByText('Bob Stone')).toBeInTheDocument();
    expect(within(activity).getByText('Harassment.')).toBeInTheDocument();
    expect(within(activity).queryByText('Suspended')).not.toBeInTheDocument();
    expect(within(activity).queryByRole('button', { name: /see more/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Assigned to you')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Closed by you')).not.toBeInTheDocument();
  });

  it('keeps activity to five rows until See more', async () => {
    const own = Array.from({ length: 6 }, (_, index) => ({
      id: `a${index + 1}`,
      action: 'warn',
      created_at: `2026-10-${25 - index}T12:00:00Z`,
      administrator: { id: 'u-admin', full_name: 'Ada Admin', username: 'ada' },
      target: { type: 'user', id: 'u-bob', user: { id: 'u-bob', full_name: `User ${index + 1}`, username: 'bob' } },
    }));
    routes.push(
      on('GET', '/api/admin/users/u-admin', () => userBody({ id: 'u-admin', full_name: 'Ada Admin', username: 'ada', is_admin: true, role: 'administrator' })),
      on('GET', '/api/admin/account', () => ({ id: 'u-admin', reports_closed: 0, assigned_reports: [], closed_reports: [] })),
      on('GET', '/api/admin/audit-log', () => ({ items: own, has_more: false, next_before: null })),
    );
    render(<AdminMyAccount adminId="u-admin" onClose={vi.fn()} />);
    const activity = await screen.findByLabelText('Your activity');
    expect(within(activity).getByText('User 1')).toBeInTheDocument();
    expect(within(activity).queryByText('User 6')).not.toBeInTheDocument();
    fireEvent.click(within(activity).getByRole('button', { name: /see more/i }));
    expect(within(activity).getByText('User 6')).toBeInTheDocument();
    fireEvent.click(within(activity).getByRole('button', { name: /see less/i }));
    expect(within(activity).queryByText('User 6')).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------------ */
/* Panel: red number of open reports                                         */
/* ------------------------------------------------------------------------ */

describe('Open reports number next to the Reports tab', () => {
  it('changes while the panel is open, on live updates', async () => {
    const { default: AdminPanelPage } = await import('@/pages/AdminPanelPage');
    let openCount = 2;
    routes.push(
      on('GET', '/api/profile/me', () => ({ id: 'u-admin', full_name: 'Ada Admin' })),
      on('GET', '/api/admin/reports/open', () => ({
        items: Array.from({ length: openCount }, (_, i) => ({ ...eventReport, id: 100 + i })),
        total: openCount,
      })),
      on('GET', '/api/admin/users', () => ({ items: [], total: 0, page: 1, limit: 20, total_pages: 1 })),
      on('GET', '/api/admin/users/counters', () => ({ administrators: 1, suspended: 0, with_warnings: 0 })),
      on('GET', '/api/admin/counts', () => ({ total_users: 1, events: { total: 0, upcoming: 0, past: 0, cancelled: 0 } })),
    );
    render(
      <MemoryRouter>
        <AdminPanelPage />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('open-reports-badge')).toHaveTextContent('2');

    openCount = 3;
    await act(async () => {
      realtime.handlers.get('reports')?.();
    });
    await waitFor(() => expect(screen.getByTestId('open-reports-badge')).toHaveTextContent('3'));
  });
});
