import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setAuthToken } from '@/lib/auth';
import FriendsPage from '@/pages/FriendsPage';

// Ticket #243: the backend deletes the "friend request received" notification
// when a request is accepted, declined or cancelled, and says the app must
// refetch the list afterwards. These tests check the Friends tab drops its
// cached notification list after each of those actions.

const { getCurrentUserMock, invalidateNotificationsMock, invalidatePrefixMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  invalidateNotificationsMock: vi.fn(),
  invalidatePrefixMock: vi.fn(),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return { ...mod, getCurrentUser: () => getCurrentUserMock() };
});
vi.mock('@/lib/queries', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/queries')>();
  return { ...mod, invalidateNotifications: invalidateNotificationsMock };
});
vi.mock('@/lib/queryCache', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/queryCache')>();
  return { ...mod, invalidatePrefix: invalidatePrefixMock };
});

const ME = 'aaaaaaaa-0000-4000-8000-000000000000';

const user = (id: string, username: string, full_name: string) => ({
  id,
  username,
  full_name,
  display_name: username,
  avatar_kind: 'icon',
  icon_id: 'sun',
  avatar_url: null,
});

const page = <T,>(data: T[]) => ({ page: 1, limit: 20, has_more: false, data });

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

type Handler = (url: URL, init: RequestInit) => Promise<Response> | undefined;
let handlers: Handler[] = [];
const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = new URL(String(input), 'http://localhost');
  for (const h of handlers) {
    const res = h(url, init);
    if (res) return res;
  }
  return json({ detail: 'not mocked' }, 404);
});
function route(method: string, path: string, respond: () => Promise<Response>): Handler {
  return (url, init) => ((init.method ?? 'GET') === method && url.pathname === path ? respond() : undefined);
}

function renderFriends(initial: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/friends" element={<FriendsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function expectNotificationsRefreshed() {
  expect(invalidatePrefixMock).toHaveBeenCalledWith('/api/notifications');
  expect(invalidateNotificationsMock).toHaveBeenCalled();
}

beforeEach(() => {
  setAuthToken('token-xyz');
  getCurrentUserMock.mockReturnValue({ id: ME, name: 'Me', email: 'me@x.com', role: 'participant' });
  invalidateNotificationsMock.mockClear();
  invalidatePrefixMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  handlers = [
    route('GET', '/api/profile/me', () => json({ id: ME })),
    route('GET', '/api/friends/requests/count', () => json({ count: 2 })),
    route('GET', '/api/friends', () => json(page([]))),
    route('GET', '/api/friends/requests/incoming', () =>
      json(page([
        { request_id: 57, created_at: '2026-09-30T09:00:00Z', user: user('i1', 'john_42', 'John Smith') },
        { request_id: 58, created_at: '2026-09-30T08:00:00Z', user: user('i2', 'mary_7', 'Mary Major') },
      ])),
    ),
    route('GET', '/api/friends/requests/sent', () =>
      json(page([{ request_id: 42, created_at: '2026-09-30T09:00:00Z', user: user('s1', 'jane_doe', 'Jane Doe') }])),
    ),
  ];
});

afterEach(() => {
  fetchMock.mockClear();
  vi.unstubAllGlobals();
});

describe('Friends tab refreshes the notification list (#243)', () => {
  it('after accepting a request', async () => {
    handlers.unshift(
      route('POST', '/api/friends/requests/57/accept', () =>
        json({ friend_since: '2026-09-30T11:00:00Z', user: user('i1', 'john_42', 'John Smith') }),
      ),
    );
    renderFriends('/friends?tab=incoming');
    const row = (await screen.findByText('@john_42')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: /Accept/ }));
    await waitFor(() => expect(screen.queryByText('@john_42')).not.toBeInTheDocument());
    expectNotificationsRefreshed();
  });

  it('after declining a request', async () => {
    handlers.unshift(route('POST', '/api/friends/requests/58/decline', () => json({ message: 'Friend request declined' })));
    renderFriends('/friends?tab=incoming');
    const row = (await screen.findByText('@mary_7')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: /Decline/ }));
    await waitFor(() => expect(screen.queryByText('@mary_7')).not.toBeInTheDocument());
    expectNotificationsRefreshed();
  });

  it('after cancelling a request I sent', async () => {
    handlers.unshift(route('DELETE', '/api/friends/requests/42', () => json({ message: 'Friend request cancelled' })));
    renderFriends('/friends?tab=sent');
    fireEvent.click(await screen.findByRole('button', { name: /Cancel/ }));
    await waitFor(() => expect(screen.queryByText('@jane_doe')).not.toBeInTheDocument());
    expectNotificationsRefreshed();
  });

  it('but not when the backend refuses the action (nothing changed)', async () => {
    handlers.unshift(
      route('DELETE', '/api/friends/requests/42', () =>
        json({ detail: { code: 'request_not_found', message: 'Friend request not found.', request_id: null } }, 404),
      ),
    );
    renderFriends('/friends?tab=sent');
    fireEvent.click(await screen.findByRole('button', { name: /Cancel/ }));
    expect(await screen.findByText('Friend request not found.')).toBeInTheDocument();
    expect(invalidateNotificationsMock).not.toHaveBeenCalled();
    expect(invalidatePrefixMock).not.toHaveBeenCalled();
  });
});
