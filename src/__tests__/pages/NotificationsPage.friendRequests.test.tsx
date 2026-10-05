import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ApiNotification } from '@/lib/notificationsApi';
import NotificationsPage from '@/pages/NotificationsPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useNavigate: () => mockNavigate };
});

const { useNotificationsMock } = vi.hoisted(() => ({
  useNotificationsMock: vi.fn(),
}));
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

vi.mock('@/lib/auth', () => ({
  getAuthToken: () => 'test-token',
  setAuthToken: () => {},
}));

vi.mock('@/components/BottomNav', () => ({ default: () => null }));

const EXAMPLE_ROWS: ApiNotification[] = [
  {
    id: '301',
    type: 'friend_request_received',
    message: 'john_42 sent you a friend request',
    related_event_id: null,
    event_title: null,
    created_at: new Date().toISOString(),
    read: false,
    related_user_id: '5d41402a-bc4b-4a2b-9f6e-3e8c2b7a1d90',
  },
  {
    id: '302',
    type: 'friend_request_accepted',
    message: 'jane_doe accepted your friend request',
    related_event_id: null,
    event_title: null,
    created_at: new Date().toISOString(),
    read: false,
    related_user_id: '8f14e45f-ceea-4e67-a2c3-1c9d0f5b7a21',
  },
  {
    id: '280',
    type: 'event_updated',
    message: "Event 'Summer Picnic' was updated by john_42",
    related_event_id: 'c9f0f895-fb98-4b91-99f5-1fd0297e236d',
    event_title: 'Summer Picnic',
    created_at: new Date().toISOString(),
    read: true,
    related_user_id: null,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>
  );
}

describe('NotificationsPage — friend request notifications (#243)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    useNotificationsMock.mockReturnValue({ data: EXAMPLE_ROWS, isLoading: false });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a received friend request with its own kind label', () => {
    renderPage();
    expect(screen.getByText('friend request')).toBeInTheDocument();
    expect(screen.getByText('john_42 sent you a friend request')).toBeInTheDocument();
  });

  it('shows an accepted friend request with its own, different kind label', () => {
    renderPage();
    expect(screen.getByText('friend request accepted')).toBeInTheDocument();
    expect(screen.getByText('jane_doe accepted your friend request')).toBeInTheDocument();
  });

  it('still shows an existing event notification unchanged, with its event title', () => {
    renderPage();
    expect(screen.getByText('event updated')).toBeInTheDocument();
    expect(screen.getByText('Event: Summer Picnic')).toBeInTheDocument();
  });

  it('opens the sender\'s profile when a received friend request is selected', async () => {
    renderPage();
    fireEvent.click(screen.getByText('john_42 sent you a friend request'));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/user/5d41402a-bc4b-4a2b-9f6e-3e8c2b7a1d90')
    );
  });

  it('opens the other user\'s profile when an accepted friend request is selected', async () => {
    renderPage();
    fireEvent.click(screen.getByText('jane_doe accepted your friend request'));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/user/8f14e45f-ceea-4e67-a2c3-1c9d0f5b7a21')
    );
  });

  it('still opens the event page when an existing event notification is selected', async () => {
    renderPage();
    fireEvent.click(screen.getByText("Event 'Summer Picnic' was updated by john_42"));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/event/c9f0f895-fb98-4b91-99f5-1fd0297e236d')
    );
  });
});
