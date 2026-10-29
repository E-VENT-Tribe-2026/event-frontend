import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ApiNotification } from '@/lib/notificationsApi';
import NotificationsPage from '@/pages/NotificationsPage';
import { clearCache } from '@/lib/queryCache';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useNavigate: () => mockNavigate };
});

const { useNotificationsMock } = vi.hoisted(() => ({ useNotificationsMock: vi.fn() }));
vi.mock('@/lib/queries', () => ({
  useNotifications: () => useNotificationsMock(),
  invalidateNotifications: () => {},
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...mod,
    getCurrentUser: () => ({ id: 'me', name: 'Me', email: 'me@example.com' }),
    getNotifications: () => [],
    saveNotifications: () => {},
  };
});

vi.mock('@/lib/auth', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/auth')>();
  return { ...mod, getAuthToken: () => 'test-token', setAuthToken: () => {} };
});
vi.mock('@/components/BottomNav', () => ({ default: () => null }));

const EVENT_ROW: ApiNotification = {
  id: '280',
  type: 'event_updated',
  message: "Event 'Summer Picnic' was updated by john_42",
  related_event_id: 'c9f0f895-fb98-4b91-99f5-1fd0297e236d',
  event_title: 'Summer Picnic',
  created_at: new Date().toISOString(),
  read: true,
  related_user_id: null,
};

const REQUEST_ROW: ApiNotification = {
  id: '301',
  type: 'friend_request_received',
  message: 'john_42 sent you a friend request',
  related_event_id: null,
  event_title: null,
  created_at: new Date().toISOString(),
  read: false,
  related_user_id: '5d41402a-bc4b-4a2b-9f6e-3e8c2b7a1d90',
};

const JOHN = {
  request_id: 7,
  created_at: '2026-10-09T20:00:00Z',
  user: {
    id: '5d41402a-bc4b-4a2b-9f6e-3e8c2b7a1d90',
    username: 'john_42',
    full_name: 'John Smith',
    display_name: 'john_42',
    avatar_kind: 'icon',
    icon_id: null,
    avatar_url: null,
  },
};
const JANE = {
  request_id: 8,
  created_at: '2026-10-09T20:05:00Z',
  user: {
    id: '8f14e45f-ceea-4e67-a2c3-1c9d0f5b7a21',
    username: null,
    full_name: 'Jane Doe',
    display_name: 'Jane Doe',
    avatar_kind: 'icon',
    icon_id: null,
    avatar_url: null,
  },
};

function mockPending(requests: unknown[] | 'fail') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/api/friends/requests/incoming')) {
        return requests === 'fail'
          ? Promise.resolve(new Response('{}', { status: 500 }))
          : Promise.resolve(
              new Response(JSON.stringify({ page: 1, limit: 5, has_more: false, data: requests }), { status: 200 })
            );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    })
  );
}

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>
  );
}

describe('NotificationsPage — pending friend requests (#296)', () => {
  beforeEach(() => {
    clearCache();
    mockNavigate.mockReset();
    useNotificationsMock.mockReturnValue({ data: [EVENT_ROW], isLoading: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a waiting request in the All list alongside other notifications', async () => {
    mockPending([JOHN]);
    renderPage();
    expect(await screen.findByText("Event 'Summer Picnic' was updated by john_42")).toBeInTheDocument();
    expect(screen.getByText('John Smith sent you a friend request')).toBeInTheDocument();
  });

  it('shows one row per waiting person, a person without a username by full name alone', async () => {
    mockPending([JOHN, JANE]);
    renderPage();
    expect(await screen.findByText('John Smith sent you a friend request')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe sent you a friend request')).toBeInTheDocument();
    expect(screen.queryByText(/@null/)).not.toBeInTheDocument();
  });

  it('opens that person\'s profile when the row is pressed', async () => {
    mockPending([JOHN]);
    renderPage();
    fireEvent.click(await screen.findByText('John Smith sent you a friend request'));
    expect(mockNavigate).toHaveBeenCalledWith('/user/5d41402a-bc4b-4a2b-9f6e-3e8c2b7a1d90');
  });

  it('does not repeat a person whose friend request notification is already in the list', async () => {
    useNotificationsMock.mockReturnValue({ data: [REQUEST_ROW, EVENT_ROW], isLoading: false });
    mockPending([JOHN]);
    renderPage();
    await screen.findByText('john_42 sent you a friend request');
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText('John Smith sent you a friend request')).not.toBeInTheDocument();
  });

  it('still shows a waiting person whose notification is missing, next to other people\'s notifications', async () => {
    useNotificationsMock.mockReturnValue({ data: [REQUEST_ROW, EVENT_ROW], isLoading: false });
    mockPending([JOHN, JANE]);
    renderPage();
    expect(await screen.findByText('Jane Doe sent you a friend request')).toBeInTheDocument();
    expect(screen.getByText('john_42 sent you a friend request')).toBeInTheDocument();
    expect(screen.queryByText('John Smith sent you a friend request')).not.toBeInTheDocument();
  });

  it('shows nothing extra when no request is waiting', async () => {
    mockPending([]);
    renderPage();
    await screen.findByText("Event 'Summer Picnic' was updated by john_42");
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText(/sent you a friend request/)).not.toBeInTheDocument();
  });

  it('still lists the notifications when the waiting requests cannot be loaded', async () => {
    mockPending('fail');
    renderPage();
    expect(await screen.findByText("Event 'Summer Picnic' was updated by john_42")).toBeInTheDocument();
    expect(screen.queryByText(/sent you a friend request/)).not.toBeInTheDocument();
  });

  it('hides the rows on the Updates tab, where they do not belong', async () => {
    mockPending([JOHN]);
    renderPage();
    await screen.findByText('John Smith sent you a friend request');
    fireEvent.click(screen.getByText('Updates'));
    expect(screen.queryByText('John Smith sent you a friend request')).not.toBeInTheDocument();
  });

  it('keeps waiting requests visible on the Friends tab', async () => {
    mockPending([JOHN]);
    renderPage();
    fireEvent.click(await screen.findByText('Friends'));
    expect(await screen.findByText('John Smith sent you a friend request')).toBeInTheDocument();
  });
});
