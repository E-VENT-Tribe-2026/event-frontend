import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setAuthToken } from '@/lib/auth';
import FriendsPage, { SEARCH_DEBOUNCE_MS } from '@/pages/FriendsPage';
import BottomNav from '@/components/BottomNav';

const { getCurrentUserMock } = vi.hoisted(() => ({ getCurrentUserMock: vi.fn() }));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return { ...mod, getCurrentUser: () => getCurrentUserMock() };
});


const ME = 'aaaaaaaa-0000-4000-8000-000000000000';

const user = (id: string, username: string, full_name = `${username} Full`) => ({
  id,
  username,
  full_name,
  display_name: username,
  avatar_kind: 'icon',
  icon_id: 'sun',
  avatar_url: null,
});

const page = <T,>(data: T[], has_more = false) => ({ page: 1, limit: 20, has_more, data });

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

function route(method: string, path: string, respond: (url: URL) => Promise<Response>): Handler {
  return (url, init) => ((init.method ?? 'GET') === method && url.pathname === path ? respond(url) : undefined);
}

function renderFriends(initial = '/friends') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/profile" element={<p>OWN PROFILE TAB</p>} />
        <Route path="/user/:id" element={<p>OTHER PROFILE</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setAuthToken('token-xyz');
  getCurrentUserMock.mockReturnValue({ id: ME, name: 'Me', email: 'me@x.com', role: 'participant' });
  vi.stubGlobal('fetch', fetchMock);
  handlers = [
    route('GET', '/api/profile/me', () => json({ id: ME })),
    route('GET', '/api/friends/requests/count', () => json({ count: 2 })),
    route('GET', '/api/friends', () => json(page([{ friend_since: '2026-09-30T11:00:00Z', user: user('f1', 'friend_one') }]))),
    route('GET', '/api/friends/requests/incoming', () =>
      json(page([
        { request_id: 57, created_at: '2026-09-30T09:00:00Z', user: user('i1', 'john_42', 'John Smith') },
        { request_id: 58, created_at: '2026-09-30T08:00:00Z', user: user('i2', 'mary_7', 'Mary Major') },
      ])),
    ),
    route('GET', '/api/friends/requests/sent', () =>
      json(page([{ request_id: 42, created_at: '2026-09-30T09:00:00Z', user: user('s1', 'jane_doe', 'Jane Doe') }])),
    ),
    route('GET', '/api/blocks', (url) =>
      url.searchParams.get('page') === '2'
        ? json({ page: 2, limit: 20, has_more: false, data: [{ blocked_at: '2026-10-01T09:00:00Z', user: user('b2', 'blocked_two', 'Bea Two') }] })
        : json(page([{ blocked_at: '2026-10-02T09:00:00Z', user: user('b1', 'blocked_one', 'Ben One') }], true)),
    ),
  ];
});

afterEach(() => {
  fetchMock.mockClear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('FriendsPage', () => {
  it('shows the four sections and lists friends with picture, username and full name', async () => {
    renderFriends();
    for (const name of ['Friends', 'Requests', 'Sent', 'Blocked']) {
      expect(screen.getAllByRole('tab', { name: new RegExp(name) }).length).toBeGreaterThan(0);
    }
    expect(await screen.findByText('@friend_one')).toBeInTheDocument();
    expect(screen.getByText('friend_one Full')).toBeInTheDocument();
  });

  it('removes a friend from the list after confirming', async () => {
    handlers.unshift(route('DELETE', '/api/friends/f1', () => json({ message: 'Friend removed' })));
    renderFriends();
    fireEvent.click(await screen.findByRole('button', { name: /Remove friend_one from friends/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByText('@friend_one')).not.toBeInTheDocument());
  });

  it('accepting moves the sender into friends; declining removes the request', async () => {
    handlers.unshift(
      route('POST', '/api/friends/requests/57/accept', () =>
        json({ friend_since: '2026-09-30T11:00:00Z', user: user('i1', 'john_42', 'John Smith') }),
      ),
      route('POST', '/api/friends/requests/58/decline', () => json({ message: 'Friend request declined' })),
    );
    renderFriends('/friends?tab=incoming');

    const johnRow = (await screen.findByText('@john_42')).closest('li')!;
    fireEvent.click(within(johnRow).getByRole('button', { name: /Accept/ }));
    await waitFor(() => expect(screen.queryByText('@john_42')).not.toBeInTheDocument());

    const maryRow = screen.getByText('@mary_7').closest('li')!;
    fireEvent.click(within(maryRow).getByRole('button', { name: /Decline/ }));
    await waitFor(() => expect(screen.queryByText('@mary_7')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: /Friends/ }));
    expect(await screen.findByText('@john_42')).toBeInTheDocument();
    expect(screen.getByText('@friend_one')).toBeInTheDocument();
  });

  it('cancelling a sent request removes it', async () => {
    handlers.unshift(route('DELETE', '/api/friends/requests/42', () => json({ message: 'Friend request cancelled' })));
    renderFriends('/friends?tab=sent');
    fireEvent.click(await screen.findByRole('button', { name: /Cancel/ }));
    await waitFor(() => expect(screen.queryByText('@jane_doe')).not.toBeInTheDocument());
  });

  it('shows the backend reason when an action is refused', async () => {
    handlers.unshift(
      route('DELETE', '/api/friends/requests/42', () =>
        json({ detail: { code: 'request_not_found', message: 'Friend request not found.', request_id: null } }, 404),
      ),
    );
    renderFriends('/friends?tab=sent');
    fireEvent.click(await screen.findByRole('button', { name: /Cancel/ }));
    expect(await screen.findByText('Friend request not found.')).toBeInTheDocument();
    expect(screen.getByText('@jane_doe')).toBeInTheDocument();
  });

  it('lists blocked users page by page with picture, full name and username', async () => {
    renderFriends('/friends?tab=blocked');
    expect(await screen.findByText('@blocked_one')).toBeInTheDocument();
    expect(screen.getByText('Ben One')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Load more/ }));
    expect(await screen.findByText('@blocked_two')).toBeInTheDocument();
    expect(screen.getByText('@blocked_one')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();
  });

  it('opens a blocked user profile when selected', async () => {
    renderFriends('/friends?tab=blocked');
    fireEvent.click(await screen.findByText('@blocked_one'));
    expect(await screen.findByText('OTHER PROFILE')).toBeInTheDocument();
  });

  it('unblocks after a confirmation that says the friendship is not restored, then removes the user', async () => {
    const unblocked: string[] = [];
    handlers.unshift(
      route('DELETE', '/api/blocks/b1', (url) => {
        unblocked.push(url.pathname);
        return json({ message: 'User unblocked' });
      }),
    );
    renderFriends('/friends?tab=blocked');

    fireEvent.click(await screen.findByRole('button', { name: 'Unblock blocked_one' }));
    expect(await screen.findByText(/previous friendship will not be restored/i)).toBeInTheDocument();
    expect(unblocked).toEqual([]);

    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Unblock' }));
    await waitFor(() => expect(screen.queryByText('@blocked_one')).not.toBeInTheDocument());
    expect(unblocked).toEqual(['/api/blocks/b1']);
  });

  it('shows the limit message when a friend request action is refused by the request limit', async () => {
    handlers.unshift(
      route('POST', '/api/friends/requests/57/accept', () =>
        json({ detail: 'Too many requests. Try again in a minute.' }, 429),
      ),
    );
    renderFriends('/friends?tab=incoming');
    const row = (await screen.findByText('@john_42')).closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: /Accept/ }));
    expect(await screen.findByText('Too many requests. Try again in a minute.')).toBeInTheDocument();
  });

  it('opens a user profile when selected', async () => {
    renderFriends('/friends?tab=incoming');
    fireEvent.click(await screen.findByText('@john_42'));
    expect(await screen.findByText('OTHER PROFILE')).toBeInTheDocument();
  });
});

describe('FriendsPage search', () => {
  it('searches once after typing stops, shows only the latest results with full names, and loads more', async () => {
    const searchCalls: string[] = [];
    handlers.unshift(
      route('GET', '/api/profile/search', (url) => {
        const q = url.searchParams.get('q')!;
        const p = Number(url.searchParams.get('page'));
        searchCalls.push(`${q}:${p}`);
        if (p === 2) return json({ page: 2, limit: 10, has_more: false, data: [{ ...user('u3', 'johnny_b'), visibility: 'public' }] });
        return json({ page: 1, limit: 10, has_more: true, data: [{ ...user('u2', 'john_42', 'John Smith'), visibility: 'public' }] });
      }),
    );
    renderFriends('/friends?tab=search');
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const input = screen.getByRole('searchbox', { name: 'Search by username' });
    for (const text of ['J', 'JO', 'JOH', 'JOHN']) fireEvent.change(input, { target: { value: text } });
    await act(async () => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 10); });

    expect(await screen.findByText('@john_42')).toBeInTheDocument();
    expect(searchCalls).toEqual(['JOHN:1']);
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search by username' })).toHaveAttribute('placeholder', 'Search by username...');

    fireEvent.click(screen.getByRole('button', { name: /Load more/ }));
    expect(await screen.findByText('@johnny_b')).toBeInTheDocument();
    expect(searchCalls).toEqual(['JOHN:1', 'JOHN:2']);
  });

  it('typing letter by letter with pauses sends one search per pause and reuses cached results', async () => {
    const searchCalls: string[] = [];
    handlers.unshift(
      route('GET', '/api/profile/search', (url) => {
        searchCalls.push(url.searchParams.get('q')!);
        return json(page([user(`u-${url.searchParams.get('q')}`, `user_${url.searchParams.get('q')}`)]));
      }),
    );
    renderFriends('/friends?tab=search');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const input = screen.getByRole('searchbox', { name: 'Search by username' });

    for (const text of ['pa', 'pau', 'pa', 'pau']) {
      fireEvent.change(input, { target: { value: text } });
      await act(async () => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 10); });
      expect(await screen.findByText(`@user_${text}`)).toBeInTheDocument();
    }
    expect(searchCalls).toEqual(['pa', 'pau']);
  });

  it('shows the limit message when a search is refused by the request limit', async () => {
    handlers.unshift(
      route('GET', '/api/profile/search', () => json({ detail: 'You are searching too often. Please wait a moment.' }, 429)),
    );
    renderFriends('/friends?tab=search');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search by username' }), { target: { value: 'limit' } });
    expect(await screen.findByText('You are searching too often. Please wait a moment.', {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it('ignores a slow response for older text', async () => {
    let releaseOld: () => void = () => {};
    handlers.unshift(
      route('GET', '/api/profile/search', (url) => {
        const q = url.searchParams.get('q')!;
        if (q === 'old') {
          return new Promise((resolve) => {
            releaseOld = () => resolve(new Response(JSON.stringify(page([user('o1', 'old_user')])), { status: 200 }));
          });
        }
        return json(page([user('n1', 'new_user')]));
      }),
    );
    renderFriends('/friends?tab=search');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const input = screen.getByRole('searchbox', { name: 'Search by username' });

    fireEvent.change(input, { target: { value: 'old' } });
    await act(async () => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 10); });
    fireEvent.change(input, { target: { value: 'new' } });
    await act(async () => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 10); });
    expect(await screen.findByText('@new_user')).toBeInTheDocument();

    await act(async () => { releaseOld(); });
    expect(screen.queryByText('@old_user')).not.toBeInTheDocument();
    expect(screen.getByText('@new_user')).toBeInTheDocument();
  });

  it("opens one's own Profile tab when selecting oneself in the results", async () => {
    handlers.unshift(route('GET', '/api/profile/search', () => json(page([user(ME, 'me_myself')]))));
    renderFriends('/friends?tab=search');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search by username' }), { target: { value: 'me' } });
    fireEvent.click(await screen.findByText('@me_myself', {}, { timeout: 2000 }));
    expect(await screen.findByText('OWN PROFILE TAB')).toBeInTheDocument();
  });
});

describe('BottomNav Friends entry', () => {
  it('shows the pending incoming request count and opens the Friends tab', async () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<BottomNav />} />
          <Route path="/friends" element={<p>FRIENDS TAB</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('friends-badge')).toHaveTextContent('2');
    fireEvent.click(screen.getByRole('link', { name: /Friends/ }));
    expect(await screen.findByText('FRIENDS TAB')).toBeInTheDocument();
  });
});
