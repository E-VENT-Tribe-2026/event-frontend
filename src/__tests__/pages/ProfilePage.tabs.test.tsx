import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '@/pages/ProfilePage';
import { clearAuthToken, setAuthToken } from '@/lib/auth';
import { setCurrentUserFromOAuth } from '@/lib/storage';

vi.mock('@/components/BottomNav', () => ({ default: () => null }));

describe('ProfilePage ticket #239: 4 Tabs (Upcoming, Past, Cancelled, Favourites)', () => {
  const currentUser = {
    id: 'user-me',
    email: 'me@test.com',
    name: 'My Name',
    username: 'my_username',
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    setAuthToken('mock-token');
    setCurrentUserFromOAuth(currentUser);
  });

  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  const setupMockData = () => {
    // 1. Organized upcoming event (active)
    const orgUpcoming = {
      id: 'org-up-1',
      title: 'Organized Upcoming Party',
      description: 'Party I organize',
      category: 'Music',
      start_datetime: '2030-10-01T20:00:00.000Z',
      end_datetime: '2030-10-01T23:00:00.000Z',
      created_by: 'user-me',
      status: 'active',
      cost: 0,
    };

    // 2. Organized past event (active)
    const orgPast = {
      id: 'org-past-1',
      title: 'Organized Past Meetup',
      description: 'Meetup I organized in the past',
      category: 'Tech',
      start_datetime: '2020-05-01T10:00:00.000Z',
      end_datetime: '2020-05-01T12:00:00.000Z',
      created_by: 'user-me',
      status: 'active',
      cost: 0,
    };

    // 3. Organized cancelled event
    const orgCancelled = {
      id: 'org-canc-1',
      title: 'Organized Cancelled Trip',
      description: 'Trip I cancelled',
      category: 'Travel',
      start_datetime: '2030-11-01T08:00:00.000Z',
      end_datetime: '2030-11-05T18:00:00.000Z',
      created_by: 'user-me',
      status: 'cancelled',
      cost: 0,
    };

    // 4. Joined upcoming event (active)
    const joinedUpcoming = {
      events: {
        id: 'join-up-1',
        title: 'Joined Upcoming Concert',
        description: 'Concert I joined',
        category: 'Music',
        start_datetime: '2030-12-01T19:00:00.000Z',
        end_datetime: '2030-12-01T22:00:00.000Z',
        created_by: 'other-user',
        status: 'active',
        cost: 0,
      },
    };

    // 5. Joined past event (active)
    const joinedPast = {
      events: {
        id: 'join-past-1',
        title: 'Joined Past Hackathon',
        description: 'Hackathon I joined in the past',
        category: 'Tech',
        start_datetime: '2021-02-01T09:00:00.000Z',
        end_datetime: '2021-02-02T18:00:00.000Z',
        created_by: 'other-user',
        status: 'active',
        cost: 0,
      },
    };

    // 6. Joined cancelled event
    const joinedCancelled = {
      events: {
        id: 'join-canc-1',
        title: 'Joined Cancelled Workshop',
        description: 'Workshop by someone else that got cancelled',
        category: 'Study',
        start_datetime: '2030-10-15T14:00:00.000Z',
        end_datetime: '2030-10-15T16:00:00.000Z',
        created_by: 'other-user',
        status: 'cancelled',
        cost: 0,
      },
    };

    // 7. Favorite / Saved event
    const favEvent = {
      id: 'fav-1',
      title: 'Saved Dream Vacation',
      description: 'Event I saved',
      category: 'Travel',
      start_datetime: '2031-01-01T10:00:00.000Z',
      end_datetime: '2031-01-07T18:00:00.000Z',
      created_by: 'someone-else',
      status: 'active',
      cost: 50,
      location_name: 'Hawaii',
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/profile/me')) {
        return new Response(
          JSON.stringify({
            id: 'user-me',
            email: 'me@test.com',
            username: 'my_username',
            full_name: 'My Name',
            avatar_url: '',
            avatar_kind: 'icon',
            icon_id: 'alex',
            banner_url: null,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('/api/favorites/all')) {
        return new Response(JSON.stringify([favEvent]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/api/events/my-events')) {
        return new Response(
          JSON.stringify({ data: [orgUpcoming, orgPast, orgCancelled] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('/api/participants/my/events')) {
        return new Response(
          JSON.stringify([joinedUpcoming, joinedPast, joinedCancelled]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    });

    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  it('renders a single row of four tabs: Upcoming, Past, Cancelled and Favourites, without a separate Events tab', async () => {
    setupMockData();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('profile-full-name')).toHaveTextContent('My Name'));

    // Check tabs exist
    const upcomingTab = screen.getByRole('tab', { name: /upcoming/i });
    const pastTab = screen.getByRole('tab', { name: /past/i });
    const cancelledTab = screen.getByRole('tab', { name: /cancelled/i });
    const favouritesTab = screen.getByRole('tab', { name: /favourites/i });

    expect(upcomingTab).toBeInTheDocument();
    expect(pastTab).toBeInTheDocument();
    expect(cancelledTab).toBeInTheDocument();
    expect(favouritesTab).toBeInTheDocument();

    // Verify there is NO separate "Events" tab
    expect(screen.queryByRole('tab', { name: /^events$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^events$/i })).not.toBeInTheDocument();
  });

  it('Upcoming tab covers both organized and joined upcoming events, and does not show cancelled events', async () => {
    setupMockData();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>,
    );

    // Default tab is Upcoming
    expect(await screen.findByText('Organized Upcoming Party')).toBeInTheDocument();
    expect(screen.getByText('Joined Upcoming Concert')).toBeInTheDocument();

    // Cancelled and Past events should NOT be visible in Upcoming tab
    expect(screen.queryByText('Organized Cancelled Trip')).not.toBeInTheDocument();
    expect(screen.queryByText('Joined Cancelled Workshop')).not.toBeInTheDocument();
    expect(screen.queryByText('Organized Past Meetup')).not.toBeInTheDocument();
    expect(screen.queryByText('Joined Past Hackathon')).not.toBeInTheDocument();
  });

  it('Past tab covers both organized and joined past events, and does not show cancelled events', async () => {
    setupMockData();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('tab', { name: /past/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /past/i }));

    // Past tab shows organized and joined past events
    expect(await screen.findByText('Organized Past Meetup')).toBeInTheDocument();
    expect(screen.getByText('Joined Past Hackathon')).toBeInTheDocument();

    // Upcoming and Cancelled events should NOT be visible in Past tab
    expect(screen.queryByText('Organized Upcoming Party')).not.toBeInTheDocument();
    expect(screen.queryByText('Joined Upcoming Concert')).not.toBeInTheDocument();
    expect(screen.queryByText('Organized Cancelled Trip')).not.toBeInTheDocument();
    expect(screen.queryByText('Joined Cancelled Workshop')).not.toBeInTheDocument();
  });

  it('Cancelled tab covers both organized and joined cancelled events, and shows in no other tab', async () => {
    setupMockData();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('tab', { name: /cancelled/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /cancelled/i }));

    // Cancelled tab shows both organized and joined cancelled events
    expect(await screen.findByText('Organized Cancelled Trip')).toBeInTheDocument();
    expect(screen.getByText('Joined Cancelled Workshop')).toBeInTheDocument();

    // Active upcoming and past events should NOT be in Cancelled tab
    expect(screen.queryByText('Organized Upcoming Party')).not.toBeInTheDocument();
    expect(screen.queryByText('Joined Upcoming Concert')).not.toBeInTheDocument();
    expect(screen.queryByText('Organized Past Meetup')).not.toBeInTheDocument();
    expect(screen.queryByText('Joined Past Hackathon')).not.toBeInTheDocument();
  });

  it('Favourites tab shows saved events', async () => {
    setupMockData();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('tab', { name: /favourites/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /favourites/i }));

    // Favourites tab shows saved events
    expect(await screen.findByText('Saved Dream Vacation')).toBeInTheDocument();

    // Non-favorite events should NOT be here
    expect(screen.queryByText('Organized Upcoming Party')).not.toBeInTheDocument();
  });
});
