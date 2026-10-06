import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  friendship: { status: 'none', request_id: null },
};

type Friendship = { status: string; request_id: number | null };

/** Fake backend: GET profile returns the current friendship; friend calls mutate it. */
function mockBackend(initial: Friendship, overrides: { failWith?: { status: number; detail: unknown } } = {}) {
  let friendship = { ...initial };
  const calls: Array<{ method: string; url: string; body?: string }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body as string | undefined });
    const json = (status: number, body: unknown) =>
      ({ ok: status < 400, status, json: async () => body }) as Response;

    if (method === 'GET' && url.includes(`/api/profile/${OTHER_ID}`)) {
      return json(200, { ...baseProfile, friendship });
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

  it('shows no owner-only parts, cancelled events or friends list', async () => {
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

  it('shows a clear message for a private profile', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ detail: 'This profile is private' }) }) as Response));
    renderPage();
    expect(await screen.findByText('This profile is private.')).toBeInTheDocument();
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
