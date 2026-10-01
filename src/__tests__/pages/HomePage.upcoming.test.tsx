import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { User } from '@/lib/storage';
import HomePage from '@/pages/HomePage';

const { getCurrentUserMock, getUsersMock, getEventsMock, getAuthTokenMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn<[], User | null>(),
  getUsersMock: vi.fn<[], User[]>(),
  getEventsMock: vi.fn<[], []>(),
  getAuthTokenMock: vi.fn<[], string | null>(),
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

vi.mock('@/lib/auth', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...mod,
    getAuthToken: () => getAuthTokenMock(),
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

function apiEventRow(over: Record<string, unknown>) {
  return {
    id: 'evt-x',
    title: 'Some Event',
    description: 'desc',
    category: 'Music',
    start_datetime: '2030-07-20T15:00:00.000Z',
    cost: 10,
    max_capacity: 50,
    location_name: 'Berlin',
    latitude: 52.5,
    longitude: 13.4,
    created_by: 'creator-1',
    status: 'active',
    ...over,
  };
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('HomePage — Upcoming For You section (#244)', () => {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

  beforeEach(() => {
    getCurrentUserMock.mockReturnValue(uMe);
    getUsersMock.mockReturnValue([uMe]);
    getEventsMock.mockReturnValue([]);
    getAuthTokenMock.mockReturnValue('tok-test');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
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

  function mockFetch({
    myEvents = [],
    joinedEvents = [],
  }: {
    myEvents?: unknown[];
    joinedEvents?: unknown[];
  }) {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('max-price')) return Promise.resolve(jsonOk({ max_price: 500 }));
      if (url.includes('/api/events/my-events')) return Promise.resolve(jsonOk({ data: myEvents }));
      if (url.includes('/api/participants/my/events')) {
        return Promise.resolve(jsonOk(joinedEvents.map((events) => ({ events }))));
      }
      if (url.includes('/api/events')) return Promise.resolve(jsonOk({ data: [] }));
      return Promise.reject(new Error(`unmocked: ${url}`));
    });
  }

  it('shows upcoming organized and joined events, but excludes cancelled and past ones', async () => {
    mockFetch({
      myEvents: [
        apiEventRow({ id: 'organized-1', title: 'My Organized Event', status: 'active' }),
        apiEventRow({ id: 'cancelled-1', title: 'Cancelled Event', status: 'cancelled' }),
        apiEventRow({ id: 'past-1', title: 'Past Event', start_datetime: '2020-01-01T00:00:00.000Z' }),
      ],
      joinedEvents: [apiEventRow({ id: 'joined-1', title: 'Event I Joined', status: 'active' })],
    });

    renderHome();

    await waitFor(() => expect(screen.getByText('Upcoming For You')).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText('My Organized Event').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Event I Joined').length).toBeGreaterThan(0);
    expect(screen.queryByText('Cancelled Event')).not.toBeInTheDocument();
    expect(screen.queryByText('Past Event')).not.toBeInTheDocument();
  });

  it('shows each event once even if it appears in both organized and joined lists', async () => {
    const shared = apiEventRow({ id: 'shared-1', title: 'Own Event I Also Joined', status: 'active' });
    mockFetch({ myEvents: [shared], joinedEvents: [shared] });

    renderHome();

    await waitFor(() => expect(screen.getAllByText('Own Event I Also Joined').length).toBeGreaterThan(0));
    // Only one card in the Upcoming For You section — not two.
    const upcomingSection = screen.getByText('Upcoming For You').closest('div');
    const cardsInSection = upcomingSection?.parentElement?.querySelectorAll('h3');
    const matching = Array.from(cardsInSection ?? []).filter((el) => el.textContent === 'Own Event I Also Joined');
    expect(matching.length).toBe(1);
  });

  it('shows an empty-state message when the user has no upcoming events', async () => {
    mockFetch({ myEvents: [], joinedEvents: [] });

    renderHome();

    await waitFor(() => expect(screen.getByText('You have no upcoming events yet.')).toBeInTheDocument());
  });
});
