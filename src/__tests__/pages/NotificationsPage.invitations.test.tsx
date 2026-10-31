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

const ROWS: ApiNotification[] = [
  {
    id: '401',
    type: 'event_invitation',
    message: "ann_a invited you to 'Summer Picnic' on 2027-01-01",
    related_event_id: 'c9f0f895-fb98-4b91-99f5-1fd0297e236d',
    event_title: 'Summer Picnic',
    created_at: new Date().toISOString(),
    read: false,
    related_user_id: 'u-ann',
  },
];

describe('NotificationsPage: invitation notification (#291)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    useNotificationsMock.mockReturnValue({ data: ROWS, isLoading: false });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens the event's details when an invitation notification is selected", async () => {
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);
    expect(screen.getByText('event invitation')).toBeInTheDocument();
    fireEvent.click(screen.getByText("ann_a invited you to 'Summer Picnic' on 2027-01-01"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/event/c9f0f895-fb98-4b91-99f5-1fd0297e236d'));
  });

  it('keeps invitation and chat rows on the Activity filter', () => {
    useNotificationsMock.mockReturnValue({
      data: [
        ...ROWS,
        {
          id: '402',
          type: 'invitation',
          message: 'Sam invited you to Brunch',
          related_event_id: 'ev-2',
          event_title: 'Brunch',
          created_at: new Date().toISOString(),
          read: false,
        },
        {
          id: '280',
          type: 'event_updated',
          message: 'Picnic moved',
          related_event_id: 'ev-3',
          event_title: 'Picnic',
          created_at: new Date().toISOString(),
          read: true,
        },
      ],
      isLoading: false,
    });
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('tab', { name: /Activity/ }));
    expect(screen.getByText("ann_a invited you to 'Summer Picnic' on 2027-01-01")).toBeInTheDocument();
    expect(screen.getByText('Sam invited you to Brunch')).toBeInTheDocument();
    expect(screen.queryByText('Picnic moved')).not.toBeInTheDocument();
  });
});
