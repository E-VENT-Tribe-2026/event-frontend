import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import UserProfilePage from '@/pages/UserProfilePage';
import { queryClient } from '@/lib/queryClient';
import { clearAuthToken, setAuthToken } from '@/lib/auth';
import { setCurrentUserFromOAuth } from '@/lib/storage';

vi.mock('@/components/BottomNav', () => ({ default: () => null }));

const OTHER_ID = '11111111-1111-1111-1111-111111111111';

const event = (id: string, title: string, start: string) => ({
  id, title, category: 'Music', start_datetime: start, created_by: OTHER_ID, status: 'active', cost: 0,
});

function friend(id: string, username: string, fullName: string) {
  return { id, username, full_name: fullName, display_name: username, avatar_kind: 'icon', icon_id: 'sun', avatar_url: null };
}

// The profile carries the first 10 friends as a plain list of UserSummary.
const FIRST_FRIENDS = [
  friend('f-1', 'amira', 'Amira Ben Ali'),
  ...Array.from({ length: 9 }, (_, i) => friend(`f-x${i}`, `friend_${i}`, `Friend ${i}`)),
];

const baseProfile = {
  id: OTHER_ID,
  username: 'jane_doe',
  full_name: 'Jane Doe',
  avatar_url: null,
  avatar_kind: 'icon',
  icon_id: 'sun',
  banner_url: 'https://picsum.photos/seed/city/1200/400',
  bio: 'I love live music.',
  interests: ['Music', 'Tech'],
  events: {
    organized: {
      upcoming: [event('o-up', 'Organized Upcoming', '2030-01-01T10:00:00Z')],
      past: [event('o-past', 'Organized Past', '2020-01-01T10:00:00Z')],
    },
    joined: {
      upcoming: [event('j-up', 'Joined Upcoming', '2030-02-01T10:00:00Z')],
      past: [event('j-past', 'Joined Past', '2020-02-01T10:00:00Z')],
    },
  },
  friends: FIRST_FRIENDS,
  friendship: { status: 'none', request_id: null },
};

type Friendship = { status: string; request_id: number | null };

/** Fake backend: GET profile returns the current friendship; friend calls mutate it. */
function mockBackend(
  initial: Friendship,
  overrides: { failWith?: { status: number; detail: unknown }; profile?: Record<string, unknown> } = {},
) {
  let friendship = { ...initial };
  let blocked = Boolean(overrides.profile?.blocked_by_me);
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body as string | undefined });
    const json = (status: number, body: unknown) =>
      ({ ok: status < 400, status, json: async () => body }) as Response;

    if (method === 'GET' && url.includes('/api/friends/requests/sent')) {
      const id = friendship.request_id;
      return json(200, {
        page: 1,
        limit: 50,
        has_more: false,
        data: id
          ? [{ request_id: id, created_at: '2026-01-01T00:00:00Z', user: { id: OTHER_ID, username: 'jane_doe', full_name: 'Jane Doe', display_name: 'Jane Doe', avatar_kind: 'icon', icon_id: 'sun', avatar_url: null } }]
          : [],
      });
    }
    if (method === 'GET' && url.includes(`/api/profile/${OTHER_ID}/friends`)) {
      return json(200, { page: 2, limit: 10, has_more: false, data: [friend('f-2', 'sami', 'Sami Trabelsi')] });
    }
    if (method === 'GET' && url.includes(`/api/profile/${OTHER_ID}`)) {
      const profile = { ...baseProfile, ...overrides.profile, friendship };
      if (blocked) {
        // The backend leaves out events and the friends list for a user the viewer blocked.
        const { events: _events, friends: _friends, ...top } = profile;
        return json(200, { ...top, blocked_by_me: true });
      }
      return json(200, { ...profile, blocked_by_me: false });
    }
    if (method === 'POST' && url.endsWith('/api/blocks')) {
      blocked = true;
      friendship = { status: 'none', request_id: null };
      return json(200, { message: 'ok' });
    }
    if (method === 'DELETE' && url.endsWith(`/api/blocks/${OTHER_ID}`)) {
      blocked = false;
      return json(200, { message: 'ok' });
    }
    if (overrides.failWith) return json(overrides.failWith.status, { detail: overrides.failWith.detail });
    if (method === 'POST' && url.endsWith('/api/friends/requests')) {
      friendship = { status: 'request_sent', request_id: 7 };
      return json(201, { request_id: 7 });
    }
    if (method === 'DELETE' && url.includes('/api/friends/requests/')) {
      friendship = { status: 'none', request_id: null };
      return json(200, { message: 'ok' });
    }
    if (method === 'POST' && url.endsWith('/accept')) {
      friendship = { status: 'friends', request_id: null };
      return json(200, {});
    }
    if (method === 'POST' && url.endsWith('/decline')) {
      friendship = { status: 'none', request_id: null };
      return json(200, { message: 'ok' });
    }
    if (method === 'DELETE' && url.includes(`/api/friends/${OTHER_ID}`)) {
      friendship = { status: 'none', request_id: null };
      return json(200, { message: 'ok' });
    }
    return json(404, { detail: 'not found' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

function renderPage(userId = OTHER_ID) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/user/${userId}`]}>
        <Routes>
          <Route path="/user/:userId" element={<UserProfilePage />} />
          <Route path="/profile" element={<div>My own profile tab</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('UserProfilePage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    queryClient.clear();
    setAuthToken('mock-token');
    setCurrentUserFromOAuth({ id: 'viewer-1', email: 'v@test.com', name: 'Viewer', username: 'viewer' });
  });
  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  it('shows the profile details and upcoming/past, organized/joined events', async () => {
    mockBackend({ status: 'none', request_id: null });
    renderPage();

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('@jane_doe')).toBeInTheDocument();
    expect(screen.getByText('I love live music.')).toBeInTheDocument();
    expect(screen.getByText('Music')).toBeInTheDocument();
    expect(screen.getByTestId('profile-banner')).toBeInTheDocument();
    expect(screen.getByText('Organized Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Joined Upcoming')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('user-tab-past'));
    expect(screen.getByText('Organized Past')).toBeInTheDocument();
    expect(screen.getByText('Joined Past')).toBeInTheDocument();
  });

  it('shows no owner-only parts or cancelled events', async () => {
    mockBackend({ status: 'none', request_id: null });
    renderPage();
    await screen.findByText('Jane Doe');

    for (const text of [/edit profile/i, /change password/i, /favourites/i, /sign out|log ?out/i, /cancelled/i]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
  });

  it('offers "Send Friend Request" to a stranger and sends it, then offers cancel', async () => {
    const calls = mockBackend({ status: 'none', request_id: null });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /send friend request/i }));

    expect(await screen.findByRole('button', { name: /cancel friend request/i })).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/api/friends/requests'));
    expect(JSON.parse(post!.body!)).toEqual({ receiver_id: OTHER_ID });
    expect(screen.queryByRole('button', { name: /send friend request/i })).not.toBeInTheDocument();
  });

  it('cancels a request the viewer sent, then offers "Send Friend Request" again', async () => {
    const calls = mockBackend({ status: 'request_sent', request_id: 7 });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /cancel friend request/i }));

    expect(await screen.findByRole('button', { name: /send friend request/i })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/api/friends/requests/7'))).toBe(true);
  });

  it('still cancels when the profile omitted request_id', async () => {
    let friendship = { status: 'request_sent', request_id: null as number | null };
    const calls: Array<{ method: string; url: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ method, url });
      const json = (status: number, body: unknown) =>
        ({ ok: status < 400, status, json: async () => body }) as Response;
      if (method === 'GET' && url.includes('/api/friends/requests/sent')) {
        return json(200, {
          page: 1, limit: 50, has_more: false,
          data: [{ request_id: 7, created_at: '2026-01-01T00:00:00Z', user: { id: OTHER_ID, username: 'jane_doe', full_name: 'Jane Doe', display_name: 'Jane', avatar_kind: 'icon', icon_id: 'sun', avatar_url: null } }],
        });
      }
      if (method === 'GET' && url.includes(`/api/profile/${OTHER_ID}`)) {
        return json(200, { ...baseProfile, friendship });
      }
      if (method === 'DELETE' && url.includes('/api/friends/requests/7')) {
        friendship = { status: 'none', request_id: null };
        return json(200, { message: 'ok' });
      }
      return json(404, { detail: 'not found' });
    }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /cancel friend request/i }));
    expect(await screen.findByRole('button', { name: /send friend request/i })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/api/friends/requests/7'))).toBe(true);
  });

  it('offers accept and decline for a received request; accepting makes them friends', async () => {
    const calls = mockBackend({ status: 'request_received', request_id: 9 });
    renderPage();

    expect(await screen.findByRole('button', { name: /decline/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send friend request/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));

    expect(await screen.findByRole('button', { name: /remove friend/i })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/api/friends/requests/9/accept'))).toBe(true);
  });

  it('declining removes the request', async () => {
    const calls = mockBackend({ status: 'request_received', request_id: 9 });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /decline/i }));

    expect(await screen.findByRole('button', { name: /send friend request/i })).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/api/friends/requests/9/decline'))).toBe(true);
  });

  it('removes a friend, then offers "Send Friend Request" again', async () => {
    const calls = mockBackend({ status: 'friends', request_id: null });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /remove friend/i }));

    expect(await screen.findByRole('button', { name: /send friend request/i })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith(`/api/friends/${OTHER_ID}`))).toBe(true);
  });

  it('shows the backend reason when an action is refused', async () => {
    mockBackend(
      { status: 'none', request_id: null },
      { failWith: { status: 409, detail: { code: 'request_already_received', message: 'This user has already sent you a friend request.' } } },
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /send friend request/i }));

    expect(await screen.findByText('This user has already sent you a friend request.')).toBeInTheDocument();
  });

  it.each([403, 404])('shows "This profile is unavailable" when the backend answers %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status, json: async () => ({ detail: 'Profile unavailable' }) }) as Response));
    renderPage();
    expect(await screen.findByText('This profile is unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
  });

  it('lets an administrator see a suspended profile that the public API hides', async () => {
    setCurrentUserFromOAuth({
      id: 'viewer-1',
      email: 'v@test.com',
      name: 'Viewer',
      username: 'viewer',
      role: 'administrator',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes(`/api/profile/${OTHER_ID}`)) {
          return {
            ok: false,
            status: 404,
            json: async () => ({ detail: { code: 'profile_unavailable' } }),
          } as Response;
        }
        if (url.includes(`/api/admin/users/${OTHER_ID}`)) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              id: OTHER_ID,
              username: 'jane_doe',
              full_name: 'Jane Doe',
              is_admin: false,
              role: 'user',
              created_at: '2026-01-01T00:00:00Z',
              status: 'suspended',
              suspension: { reason: 'Spam', suspended_at: '2026-01-01T00:00:00Z', suspended_by: 'ada' },
              organized_events: { upcoming: [], past: [], cancelled: [] },
              joined_events: { upcoming: [], past: [], cancelled: [] },
              warnings: [],
            }),
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      }),
    );

    renderPage();
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByTestId('account-status-badge')).toHaveTextContent('Suspended');
    expect(screen.getByText(/Reason: Spam/)).toBeInTheDocument();
    expect(screen.queryByText('This profile is unavailable')).not.toBeInTheDocument();
  });

  it('shows only the parts the backend returns, with no empty sections', async () => {
    // Friends-only profile seen by someone who is not a friend: only the top of the profile.
    mockBackend(
      { status: 'none', request_id: null },
      { profile: { bio: undefined, interests: undefined, events: undefined, friends: undefined } },
    );
    renderPage();

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('@jane_doe')).toBeInTheDocument();
    expect(screen.getByTestId('profile-banner')).toBeInTheDocument();
    expect(screen.queryByText('I love live music.')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText(/no events/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no friends/i)).not.toBeInTheDocument();
    // Friendship actions still work on a friends-only profile.
    expect(screen.getByRole('button', { name: /send friend request/i })).toBeInTheDocument();
  });

  it('shows no upcoming events when the backend leaves them out', async () => {
    mockBackend(
      { status: 'none', request_id: null },
      {
        profile: {
          events: {
            organized: { past: [event('o-past', 'Organized Past', '2020-01-01T10:00:00Z')] },
            joined: { past: [] },
          },
        },
      },
    );
    renderPage();

    expect(await screen.findByText('Organized Past')).toBeInTheDocument();
    expect(screen.queryByTestId('user-tab-upcoming')).not.toBeInTheDocument();
    expect(screen.queryByText('Organized Upcoming')).not.toBeInTheDocument();
  });

  it("lists the viewed user's friends, not the viewer's, and loads more on request", async () => {
    const calls = mockBackend({ status: 'none', request_id: null });
    renderPage();

    fireEvent.click(await screen.findByTestId('user-main-tab-friends'));
    expect(screen.getByText('Amira Ben Ali')).toBeInTheDocument();
    expect(screen.getByText('@amira')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    expect(await screen.findByText('Sami Trabelsi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();

    expect(calls.some((c) => c.url.includes(`/api/profile/${OTHER_ID}/friends?page=2&limit=10`))).toBe(true);
    expect(calls.some((c) => /\/api\/friends\?/.test(c.url))).toBe(false);
  });

  it('blocks after confirmation, then shows only the top of the profile with Unblock', async () => {
    const calls = mockBackend({ status: 'friends', request_id: null });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /^block$/i }));
    expect(await screen.findByText(/no longer be able to see your profile/i)).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/api/blocks'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /^block$/i, hidden: false }));
    expect(await screen.findByRole('button', { name: /unblock/i })).toBeInTheDocument();

    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/api/blocks'));
    expect(JSON.parse(post!.body!)).toEqual({ user_id: OTHER_ID });
    expect(screen.getByText('I love live music.')).toBeInTheDocument();
    expect(screen.queryByText('Organized Upcoming')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove friend|send friend request/i })).not.toBeInTheDocument();
  });

  it('says the friendship is not restored before unblocking', async () => {
    const calls = mockBackend({ status: 'none', request_id: null }, { profile: { blocked_by_me: true } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /unblock/i }));
    expect(await screen.findByText(/previous friendship will not be restored/i)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/api/blocks/'))).toBe(false);

    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^unblock$/i }));

    expect(await screen.findByRole('button', { name: /send friend request/i })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith(`/api/blocks/${OTHER_ID}`))).toBe(true);
  });

  it('hides "Load more" when the first page of friends is not full', async () => {
    mockBackend({ status: 'none', request_id: null }, { profile: { friends: [friend('f-1', 'amira', 'Amira Ben Ali')] } });
    renderPage();
    fireEvent.click(await screen.findByTestId('user-main-tab-friends'));
    expect(screen.getByText('Amira Ben Ali')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('shows the rate limiter message when it answers with an error field', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url.includes(`/api/profile/${OTHER_ID}`)) {
        return { ok: true, status: 200, json: async () => ({ ...baseProfile, blocked_by_me: false }) } as Response;
      }
      return { ok: false, status: 429, json: async () => ({ error: 'Rate limit exceeded: 200 per 1 minute' }) } as Response;
    }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /send friend request/i }));
    expect(await screen.findByText('Rate limit exceeded: 200 per 1 minute')).toBeInTheDocument();
  });

  it('shows a friendly error when sending a request to a user you blocked', async () => {
    mockBackend(
      { status: 'none', request_id: null },
      { failWith: { status: 403, detail: { code: 'user_blocked' } } },
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /send friend request/i }));

    expect(await screen.findByText('You cannot send a friend request to this user.')).toBeInTheDocument();
  });

  it('treats a "blocked" friendship status as a profile the viewer blocked', async () => {
    mockBackend(
      { status: 'blocked', request_id: null },
      { profile: { events: undefined, friends: undefined } },
    );
    renderPage();

    expect(await screen.findByRole('button', { name: /^unblock$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^block$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('shows the message the backend returns when the request limit is reached', async () => {
    mockBackend(
      { status: 'none', request_id: null },
      { failWith: { status: 429, detail: 'You have reached the limit of friend requests for today.' } },
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /send friend request/i }));

    expect(await screen.findByText('You have reached the limit of friend requests for today.')).toBeInTheDocument();
  });

  it('opens the own profile tab instead when the id is the viewer\'s own', async () => {
    mockBackend({ status: 'none', request_id: null });
    renderPage('viewer-1');
    await waitFor(() => expect(screen.getByText('My own profile tab')).toBeInTheDocument());
  });

  it('caches the profile: a second visit does not refetch while fresh', async () => {
    const calls = mockBackend({ status: 'none', request_id: null });
    const first = renderPage();
    await screen.findByText('Jane Doe');
    first.unmount();

    renderPage();
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'GET' && c.url.includes(`/api/profile/${OTHER_ID}`))).toHaveLength(1);
  });
});
