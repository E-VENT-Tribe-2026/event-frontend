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

const { useNotificationsMock } = vi.hoisted(() => ({ useNotificationsMock: vi.fn() }));
vi.mock('@/lib/queries', () => ({
  useNotifications: () => useNotificationsMock(),
  invalidateNotifications: () => {},
}));
vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return { ...mod, getCurrentUser: () => ({ id: 'me', name: 'Me', email: 'me@example.com' }), getNotifications: () => [], saveNotifications: () => {} };
});
vi.mock('@/lib/auth', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/auth')>();
  return { ...mod, getAuthToken: () => 'test-token', setAuthToken: () => {} };
});
vi.mock('@/components/BottomNav', () => ({ default: () => null }));

const EVENT_ID = 'c9f0f895-fb98-4b91-99f5-1fd0297e236d';

const ROWS: ApiNotification[] = [
  {
    id: '501',
    type: 'chat_message',
    message: "ann_a sent a message in 'Summer Picnic'",
    related_event_id: EVENT_ID,
    event_title: 'Summer Picnic',
    created_at: new Date().toISOString(),
    read: false,
    related_user_id: 'u-ann',
  },
];

describe('NotificationsPage: event chat notifications', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    useNotificationsMock.mockReturnValue({ data: ROWS, isLoading: false });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('labels a chat row and opens the event chat, not event details', async () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('event chat')).toBeInTheDocument();
    fireEvent.click(screen.getByText("ann_a sent a message in 'Summer Picnic'"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(`/chat?eventId=${EVENT_ID}`));
    expect(mockNavigate).not.toHaveBeenCalledWith(`/event/${EVENT_ID}`);
  });
});
