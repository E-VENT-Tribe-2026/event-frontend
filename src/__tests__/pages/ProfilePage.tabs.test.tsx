import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '@/pages/ProfilePage';
import { clearAuthToken, setAuthToken } from '@/lib/auth';
import { setCurrentUserFromOAuth } from '@/lib/storage';
import { invalidatePrefix } from '@/lib/queryCache';

vi.mock('@/components/BottomNav', () => ({ default: () => null }));

describe('ProfilePage: Events / Friends tabs and event sub-tabs', () => {
  const currentUser = {
    id: 'user-me',
    email: 'me@test.com',
    name: 'My Name',
    username: 'my_username',
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    invalidatePrefix('/api');
    setAuthToken('mock-token');
    setCurrentUserFromOAuth(currentUser);
  });

  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  const setupMockData = () => {
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

    const json = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/profile/me')) {
        return json({
          id: 'user-me',
          email: 'me@test.com',
          username: 'my_username',
          full_name: 'My Name',
          avatar_url: '',
          avatar_kind: 'icon',
          icon_id: 'alex',
          banner_url: null,
        });
      }
      if (url.includes('/api/favorites/all')) return json([favEvent]);
      if (url.includes('/api/events/my-events')) {
        return json({ data: [orgUpcoming, orgPast, orgCancelled] });
      }
      if (url.includes('/api/participants/my/events')) {
        return json([joinedUpcoming, joinedPast, joinedCancelled]);
      }
      return json([]);
    });

    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  const renderPage = async () => {
    setupMockData();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ProfilePage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('profile-full-name')).toHaveTextContent('My Name'),
    );
  };

  const openSubTab = (id: 'upcoming' | 'past' | 'cancelled' | 'favourites') =>
    fireEvent.click(screen.getByTestId(`tab-${id}`));

  it('renders the Events and Friends main tabs, with Events selected by default', async () => {
    await renderPage();

    const eventsTab = screen.getByTestId('main-tab-events');
    const friendsTab = screen.getByTestId('main-tab-friends');

    expect(eventsTab).toHaveAttribute('role', 'tab');
    expect(friendsTab).toHaveAttribute('role', 'tab');
    expect(eventsTab).toHaveAttribute('aria-selected', 'true');
    expect(friendsTab).toHaveAttribute('aria-selected', 'false');
  });

  it('renders the four event sub-tabs with counts', async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('tab-upcoming')).toHaveTextContent('Upcoming (2)');
      expect(screen.getByTestId('tab-past')).toHaveTextContent('Past (2)');
      expect(screen.getByTestId('tab-cancelled')).toHaveTextContent('Cancelled (2)');
      expect(screen.getByTestId('tab-favourites')).toHaveTextContent('Favourites (1)');
    });
  });

  it('Upcoming tab (default) shows organized and joined upcoming events only', async () => {
    await renderPage();

    expect(await screen.findByText('Organized Upcoming Party')).toBeInTheDocument();
    expect(screen.getByText('Joined Upcoming Concert')).toBeInTheDocument();

    expect(screen.queryByText('Organized Cancelled Trip')).not.toBeInTheDocument();
    expect(screen.queryByText('Joined Cancelled Workshop')).not.toBeInTheDocument();
    expect(screen.queryByText('Organized Past Meetup')).not.toBeInTheDocument();
    expect(screen.queryByText('Joined Past Hackathon')).not.toBeInTheDocument();
  });

  it('labels organized events "Created" and joined events "Joined"', async () => {
    await renderPage();

    await screen.findByText('Organized Upcoming Party');
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Joined')).toBeInTheDocument();
  });

  it('Past tab shows organized and joined past events only', async () => {
    await renderPage();
    await screen.findByText('Organized Upcoming Party');

    openSubTab('past');

    expect(await screen.findByText('Organized Past Meetup')).toBeInTheDocument();
    expect(screen.getByText('Joined Past Hackathon')).toBeInTheDocument();

    expect(screen.queryByText('Organized Upcoming Party')).not.toBeInTheDocument();
    expect(screen.queryByText('Joined Upcoming Concert')).not.toBeInTheDocument();
    expect(screen.queryByText('Organized Cancelled Trip')).not.toBeInTheDocument();
    expect(screen.queryByText('Joined Cancelled Workshop')).not.toBeInTheDocument();
  });

  it('Cancelled tab shows organized and joined cancelled events only', async () => {
    await renderPage();
    await screen.findByText('Organized Upcoming Party');

    openSubTab('cancelled');

    expect(await screen.findByText('Organized Cancelled Trip')).toBeInTheDocument();
    expect(screen.getByText('Joined Cancelled Workshop')).toBeInTheDocument();

    expect(screen.queryByText('Organized Upcoming Party')).not.toBeInTheDocument();
    expect(screen.queryByText('Joined Upcoming Concert')).not.toBeInTheDocument();
    expect(screen.queryByText('Organized Past Meetup')).not.toBeInTheDocument();
    expect(screen.queryByText('Joined Past Hackathon')).not.toBeInTheDocument();
  });

  it('Favourites tab shows saved events only', async () => {
    await renderPage();
    await screen.findByText('Organized Upcoming Party');

    openSubTab('favourites');

    expect(await screen.findByText('Saved Events')).toBeInTheDocument();
    expect(screen.getByText('Saved Dream Vacation')).toBeInTheDocument();
    expect(screen.queryByText('Organized Upcoming Party')).not.toBeInTheDocument();
  });

  it('Friends tab shows empty states for accepted friends and requests', async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId('main-tab-friends'));
    expect(screen.getByTestId('main-tab-friends')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('No friends connected yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /requests/i }));
    expect(screen.getByText('No pending friend requests.')).toBeInTheDocument();

    // Event sub-tabs are not rendered while on Friends
    expect(screen.queryByTestId('tab-upcoming')).not.toBeInTheDocument();
  });
});