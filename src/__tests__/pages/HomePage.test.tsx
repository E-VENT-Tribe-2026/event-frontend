import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventItem, User } from '@/lib/storage';
import HomePage from '@/pages/HomePage';
import { clearAuthToken, setAuthToken } from '@/lib/auth';

const { getCurrentUserMock, getUsersMock, getEventsMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn<[], User | null>(),
  getUsersMock: vi.fn<[], User[]>(),
  /** HomePage imports `getEvents as getLocalEvents` — must mock `getEvents`. */
  getEventsMock: vi.fn<[], EventItem[]>(),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...mod,
    getCurrentUser: () => getCurrentUserMock(),
    getUsers: () => getUsersMock(),
    getEvents: () => getEventsMock(),
  };
});

vi.mock('@/components/BottomNav', () => ({
  default: () => null,
}));

function makeUser(over: Partial<User> & Pick<User, 'id'>): User {
  return {
    name: 'User',
    email: 'u@u.com',
    role: 'participant',
    password: '',
    avatar: '',
    profilePhoto: '',
    coverPhoto: '',
    bio: '',
    interests: ['Music'],
    dob: '',
    gender: '',
    isPremium: false,
    friends: [],
    createdAt: '',
    ...over,
  } as User;
}

const uMe = makeUser({ id: 'u-me', name: 'Me', email: 'me@test.com' });

const apiEventRow = {
  id: 'api-e1',
  title: 'Backend Event Alpha',
  description: 'desc',
  category: 'Music',
  start_datetime: '2030-07-20T15:00:00.000Z',
  cost: 25,
  max_capacity: 50,
  location_name: 'Berlin',
  latitude: 52.5,
  longitude: 13.4,
  created_by: 'creator-1',
};

function localEvent(over: Partial<EventItem> & Pick<EventItem, 'id' | 'title'>): EventItem {
  return {
    description: '',
    category: 'Music',
    date: '2030-08-01',
    time: '12:00',
    location: 'Berlin',
    lat: 52,
    lng: 13,
    budget: 10,
    participantsLimit: 50,
    participants: [],
    image: 'https://example.com/i.jpg',
    organizer: 'Org',
    organizerId: 'o1',
    organizerAvatar: '',
    isPrivate: false,
    isDraft: false,
    requiresApproval: false,
    reviews: [],
    reports: [],
    collaborators: [],
    ...over,
  } as EventItem;
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('HomePage', () => {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

  beforeEach(() => {
    getCurrentUserMock.mockReturnValue(uMe);
    getUsersMock.mockReturnValue([uMe]);
    getEventsMock.mockReturnValue([]);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  function renderHome() {
    const testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/home']}>
          <Routes>
            <Route path="/home" element={<HomePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('shows loading then renders events from API response', async () => {
    let resolveEvents: (r: Response) => void;
    const eventsPromise = new Promise<Response>((res) => {
      resolveEvents = res;
    });
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('max-price')) return Promise.resolve(jsonOk({ max_price: 500 }));
      if (url.includes('/api/events')) return eventsPromise;
      return Promise.reject(new Error('unmocked'));
    });

    renderHome();
    expect(screen.getByText(/Loading the latest events/i)).toBeInTheDocument();
    resolveEvents!(jsonOk({ data: [apiEventRow] }));

    await waitFor(() => {
      expect(screen.getAllByText('Backend Event Alpha').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Loading the latest events/i)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'See what your friends are up to' })).toBeInTheDocument();
  });

  it('shows empty state when API returns no events and local storage is empty', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('max-price')) return Promise.resolve(jsonOk({ max_price: 500 }));
      if (url.includes('/api/events')) return Promise.resolve(jsonOk({ data: [] }));
      return Promise.reject(new Error('unmocked'));
    });

    renderHome();
    await waitFor(() => {
      expect(screen.getByText(/No events match your filters/i)).toBeInTheDocument();
    });
  });

  it('lets a live API event replace a stale local copy of the same id', async () => {
    getEventsMock.mockReturnValue([
      localEvent({ id: 'api-e1', title: 'Stale Local Title', budget: 25 }),
    ]);

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('max-price')) return Promise.resolve(jsonOk({ max_price: 500 }));
      if (url.includes('/api/events')) return Promise.resolve(jsonOk({ data: [apiEventRow] }));
      return Promise.reject(new Error('unmocked'));
    });

    renderHome();
    await waitFor(() => {
      expect(screen.getAllByText('Backend Event Alpha').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Stale Local Title')).not.toBeInTheDocument();
  });

  it('merges local events when API returns an empty list', async () => {
    const local = localEvent({ id: 'loc-1', title: 'Local Only Event', budget: 5 });
    getEventsMock.mockReturnValue([local]);

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('max-price')) return Promise.resolve(jsonOk({ max_price: 500 }));
      if (url.includes('/api/events')) return Promise.resolve(jsonOk({ data: [] }));
      return Promise.reject(new Error('unmocked'));
    });

    renderHome();
    await waitFor(() => {
      expect(screen.getAllByText('Local Only Event').length).toBeGreaterThan(0);
    });
  });

  it('requests filtered events when category chip is selected', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('max-price')) return Promise.resolve(jsonOk({ max_price: 500 }));
      if (url.includes('/api/events')) return Promise.resolve(jsonOk({ data: [apiEventRow] }));
      return Promise.reject(new Error('unmocked'));
    });

    renderHome();
    await waitFor(() => {
      expect(screen.getAllByText('Backend Event Alpha').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Sports' }));

    await waitFor(() => {
      const withCategory = fetchMock.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes('category=Sports'));
      expect(withCategory.length).toBeGreaterThan(0);
    });
  });

  it('hides people the user already sent a friend request to', async () => {
    setAuthToken('tok');
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('max-price')) return Promise.resolve(jsonOk({ max_price: 500 }));
      if (url.includes('/api/recommendations')) return Promise.resolve(jsonOk({ data: [] }));
      if (url.includes('/api/events/my-events')) return Promise.resolve(jsonOk({ data: [] }));
      if (url.includes('/api/participants/my/events')) return Promise.resolve(jsonOk([]));
      if (url.includes('/api/friends/suggestions')) {
        return Promise.resolve(jsonOk({
          data: [
            { id: 's1', username: 'jane_doe', full_name: 'Jane Doe' },
            { id: 's2', username: 'maya', full_name: 'Maya' },
          ],
        }));
      }
      if (url.includes('/api/friends/requests/sent')) {
        return Promise.resolve(jsonOk({
          page: 1,
          limit: 50,
          has_more: false,
          data: [{
            request_id: 1,
            created_at: '2030-01-01T00:00:00Z',
            user: {
              id: 's1', username: 'jane_doe', full_name: 'Jane Doe', display_name: 'Jane Doe',
              avatar_kind: null, icon_id: null, avatar_url: null,
            },
          }],
        }));
      }
      if (url.includes('/api/friends/requests/incoming')) return Promise.resolve(jsonOk({ data: [], has_more: false }));
      if (url.includes('/api/friends')) return Promise.resolve(jsonOk({ data: [], has_more: false }));
      if (url.includes('/api/blocks')) return Promise.resolve(jsonOk({ data: [], has_more: false }));
      if (url.includes('/api/profile/me')) return Promise.resolve(jsonOk({ id: 'u-me', interests: ['Music'] }));
      if (url.includes('/api/events')) return Promise.resolve(jsonOk({ data: [] }));
      return Promise.resolve(jsonOk({}));
    });

    renderHome();
    expect(await screen.findByText('Maya')).toBeInTheDocument();
    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
  });

  it('stacks interest matches as long cards, not a marquee', async () => {
    setAuthToken('tok');
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('max-price')) return Promise.resolve(jsonOk({ max_price: 500 }));
      if (url.includes('/api/recommendations')) return Promise.resolve(jsonOk({ data: [apiEventRow] }));
      if (url.includes('/api/events/my-events')) return Promise.resolve(jsonOk({ data: [] }));
      if (url.includes('/api/participants/my/events')) return Promise.resolve(jsonOk([]));
      if (url.includes('/api/friends')) return Promise.resolve(jsonOk({ data: [], has_more: false }));
      if (url.includes('/api/blocks')) return Promise.resolve(jsonOk({ data: [], has_more: false }));
      if (url.includes('/api/profile/me')) return Promise.resolve(jsonOk({ id: 'u-me', interests: ['Music'] }));
      if (url.includes('/api/events')) return Promise.resolve(jsonOk({ data: [] }));
      return Promise.resolve(jsonOk({}));
    });

    renderHome();
    expect(await screen.findByTestId('interest-event-list')).toBeInTheDocument();
    expect(screen.getByTestId('interest-event-row')).toBeInTheDocument();
    expect(screen.queryByTestId('interest-marquee')).not.toBeInTheDocument();
  });

});
