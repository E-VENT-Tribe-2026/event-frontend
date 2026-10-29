/**
 * Ticket #328: Reports tab, report details and actions, content removal, report history
 * and the closed-reports count in the administrator panel.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { setAuthToken, clearAuthToken } from '@/lib/auth';
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

const closedReport = { ...userReport, id: 14, status: 'dismissed', created_at: '2026-10-20T08:00:00Z' };

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
  routes = [];
  calls = [];
  realtime.handlers.clear();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  clearAuthToken();
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

  it('shows the open reports with their number on top and all reports below, each with reporter, item, reason, time and status', async () => {
    routes.push(
      on('GET', '/api/admin/reports', (c) =>
        c.search.get('status') === 'open'
          ? page([eventReport, userReport], 1, 1, 2)
          : page([eventReport, userReport, closedReport], 1, 1, 3),
      ),
    );
    render(<AdminReportsTab onOpenReport={vi.fn()} onErrorToast={vi.fn()} />);

    const open = await screen.findByRole('region', { name: 'open-reports' });
    await within(open).findByText('Rooftop Jazz Night');
    expect(within(open).getByTestId('open-reports-count')).toHaveTextContent('2 reports');
    const row = within(open).getByRole('button', { name: /report about Rooftop Jazz Night/ });
    expect(row).toHaveTextContent('Misleading event');
    expect(row).toHaveTextContent('by Alice Martin');
    expect(row).toHaveTextContent('Oct 25, 2026');
    expect(row).toHaveTextContent('Open');

    const all = screen.getByRole('region', { name: 'all-reports' });
    expect(within(all).getByTestId('all-reports-count')).toHaveTextContent('3 reports');
    expect(within(all).getByText('Dismissed')).toBeInTheDocument();
    expect(calls.every((c) => c.cache === 'no-store')).toBe(true);
  });

  it('loads more of all reports on request', async () => {
    routes.push(
      on('GET', '/api/admin/reports', (c) => {
        if (c.search.get('status') === 'open') return page([], 1, 1, 0);
        return c.search.get('page') === '2' ? page([closedReport], 2, 2, 2) : page([userReport], 1, 2, 2);
      }),
    );
    render(<AdminReportsTab onOpenReport={vi.fn()} onErrorToast={vi.fn()} />);

    const all = await screen.findByRole('region', { name: 'all-reports' });
    fireEvent.click(await within(all).findByRole('button', { name: 'Load more' }));
    expect(await within(all).findByText('Dismissed')).toBeInTheDocument();
    expect(within(all).queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('fetches the open reports again on a live update', async () => {
    let openItems: unknown[] = [eventReport];
    routes.push(
      on('GET', '/api/admin/reports', (c) =>
        c.search.get('status') === 'open' ? page(openItems, 1, 1, openItems.length) : page([], 1, 1, 0),
      ),
    );
    const { rerender } = render(<AdminReportsTab onOpenReport={vi.fn()} onErrorToast={vi.fn()} liveVersion={0} />);
    const open = await screen.findByRole('region', { name: 'open-reports' });
    await within(open).findByText('Rooftop Jazz Night');

    openItems = [messageReport, eventReport];
    rerender(<AdminReportsTab onOpenReport={vi.fn()} onErrorToast={vi.fn()} liveVersion={1} />);
    expect(await within(open).findByText('Message by Bob Stone in Board Games Evening')).toBeInTheDocument();
    expect(within(open).getByTestId('open-reports-count')).toHaveTextContent('2 reports');
  });

  it('opens a report when its row is pressed', async () => {
    routes.push(on('GET', '/api/admin/reports', () => page([userReport], 1, 1, 1)));
    const onOpenReport = vi.fn();
    render(<AdminReportsTab onOpenReport={onOpenReport} onErrorToast={vi.fn()} />);
    const open = await screen.findByRole('region', { name: 'open-reports' });
    fireEvent.click(await within(open).findByRole('button', { name: /report about Bob Stone/ }));
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
  });

  it('offers Dismiss, Warn, Remove and Suspend on an open event report, and says warning and suspending apply to the organizer', async () => {
    renderDetail(detail(eventReport));
    for (const label of ['Dismiss', 'Warn the user', 'Remove the reported content', 'Suspend the user']) {
      expect(await screen.findByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText(/apply to the event's organizer, Olga Organizer/)).toBeInTheDocument();
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
      detail(closedReport, { outcome: 'dismissed', closed_at: '2026-10-21T12:00:00Z', closed_by: ADMIN }),
    );
    const outcome = await screen.findByLabelText('Outcome');
    expect(outcome).toHaveTextContent('Outcome: Dismissed');
    expect(outcome).toHaveTextContent('Closed by Ada Admin');
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Warn the user' })).not.toBeInTheDocument();
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
        detail(userReport, { status: 'action_taken', outcome: 'warned' }),
      ),
    );
    renderDetail(detail(userReport));
    fireEvent.click(await screen.findByRole('button', { name: 'Warn the user' }));
    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Warn' });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Insults in messages' } });
    fireEvent.click(confirm);

    expect(await screen.findByLabelText('Outcome')).toHaveTextContent('The user was warned');
    const post = calls.find((c) => c.path === '/api/admin/reports/12/action');
    expect(post?.body).toEqual({ action: 'warn', reason: 'Insults in messages' });
  });

  it('shows the reason when the backend refuses an action', async () => {
    routes.push(
      on(
        'POST',
        '/api/admin/reports/11/action',
        () => ({ detail: { code: 'already_closed', message: 'This report is already closed.' } }),
        409,
      ),
    );
    const h = renderDetail(detail(eventReport));
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
    expect(within(about).getByText('Action taken')).toBeInTheDocument();
    expect(within(about).getByText('2026-10-25')).toBeInTheDocument();

    const made = screen.getByLabelText('Reports made by this user');
    expect(within(made).getByText('Dismissed')).toBeInTheDocument();
    fireEvent.click(within(made).getByRole('button', { name: /Open report: Other/ }));
    expect(onOpenReport).toHaveBeenCalledWith('23');
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
      on('GET', '/api/admin/reports/open-count', () => ({ count: openCount })),
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
