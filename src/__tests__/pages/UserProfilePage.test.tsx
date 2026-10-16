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
  return {
    friend_since: '2026-01-01T00:00:00Z',
    user: { id, username, full_name: fullName, display_name: username, avatar_kind: 'icon', icon_id: 'sun', avatar_url: null },
  };
}

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
  friends: {
    page: 1,
    limit: 20,
    has_more: true,
    data: [friend('f-1', 'amira', 'Amira Ben Ali')],
  },
  friendship: { status: 'none', request_id: null },
};

type Friendship = { status: string; request_id: number | null };

/** Fake backend: GET profile returns the current friendship; friend calls mutate it. */
function mockBackend(
  initial: Friendship,
  overrides: { failWith?: { status: number; detail: unknown }; profile?: Record<string, unknown> } = {},
) {
  let friendship = { ...initial };
  let blocked = Boolean(overrides.profile?.is_blocked);
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body as string | undefined });
    const json = (status: number, body: unknown) =>
      ({ ok: status < 400, status, json: async () => body }) as Response;

    if (method === 'GET' && url.includes(`/api/profile/${OTHER_ID}/friends`)) {
      return json(200, { page: 2, limit: 20, has_more: false, data: [friend('f-2', 'sami', 'Sami Trabelsi')] });
    }
    if (method === 'GET' && url.includes(`/api/profile/${OTHER_ID}`)) {
      const profile = { ...baseProfile, ...overrides.profile, friendship };
      if (blocked) {
        // The backend leaves out events and the friends list for a user the viewer blocked.
        const { events: _events, friends: _friends, ...top } = profile;
        return json(200, { ...top, is_blocked: true });
      }
      return json(200, { ...profile, is_blocked: false });
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

    expect(calls.some((c) => c.url.includes(`/api/profile/${OTHER_ID}/friends?page=2`))).toBe(true);
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
    expect(JSON.parse(post!.body!)).toEqual({ blocked_id: OTHER_ID });
    expect(screen.getByText('I love live music.')).toBeInTheDocument();
    expect(screen.queryByText('Organized Upcoming')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove friend|send friend request/i })).not.toBeInTheDocument();
  });

  it('says the friendship is not restored before unblocking', async () => {
    const calls = mockBackend({ status: 'none', request_id: null }, { profile: { is_blocked: true } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /unblock/i }));
    expect(await screen.findByText(/previous friendship will not be restored/i)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/api/blocks/'))).toBe(false);

    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^unblock$/i }));

    expect(await screen.findByRole('button', { name: /send friend request/i })).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith(`/api/blocks/${OTHER_ID}`))).toBe(true);
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
