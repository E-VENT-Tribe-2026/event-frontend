import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { User } from '@/lib/storage';
import EventDetailsPage from '@/pages/EventDetailsPage';

const { getCurrentUserMock, getAuthTokenMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn<[], User | null>(),
  getAuthTokenMock: vi.fn<[], string | null>(),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...mod,
    getCurrentUser: () => getCurrentUserMock(),
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

const organizerUser: User = {
  id: 'org-1',
  name: 'Organizer Name',
  email: 'org@test.com',
  role: 'organizer',
  password: 'secret',
  avatar: '',
  profilePhoto: '',
  coverPhoto: '',
  bio: '',
  interests: [],
  dob: '',
  gender: '',
  isPremium: false,
  friends: [],
  createdAt: '',
};

const attendeeUser: User = {
  id: 'att-1',
  name: 'Attendee Name',
  email: 'att@test.com',
  role: 'attendee',
  password: 'secret',
  avatar: '',
  profilePhoto: '',
  coverPhoto: '',
  bio: '',
  interests: [],
  dob: '',
  gender: '',
  isPremium: false,
  friends: [],
  createdAt: '',
};

describe('EventDetailsPage ticket #239: Cancel events', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    getAuthTokenMock.mockReturnValue('valid-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows cancel action instead of delete for organizer of upcoming event, confirms with undo warning, and cancels event', async () => {
    getCurrentUserMock.mockReturnValue(organizerUser);

    let eventStatus = 'active';
    let cancelCalled = false;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/events/evt-100/cancel') && init?.method === 'PATCH') {
        cancelCalled = true;
        eventStatus = 'cancelled';
        return new Response(JSON.stringify({ id: 'evt-100', status: 'cancelled' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/api/events/evt-100')) {
        return new Response(
          JSON.stringify({
            id: 'evt-100',
            title: 'Upcoming Festival',
            description: 'Grand upcoming festival',
            category: 'Music',
            start_datetime: '2030-08-01T18:00:00.000Z',
            end_datetime: '2030-08-01T22:00:00.000Z',
            cost: 0,
            max_capacity: 50,
            location_name: 'Main Park',
            latitude: 0,
            longitude: 0,
            created_by: 'org-1',
            status: eventStatus,
            profiles: { full_name: 'Organizer Name', username: 'org_one' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('/api/participants/evt-100/participants')) {
        return new Response(
          JSON.stringify([
            { user_id: 'org-1', status: 'going', profiles: { full_name: 'Organizer Name' } },
            { user_id: 'att-1', status: 'going', profiles: { full_name: 'Attendee Name' } },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={['/event/evt-100']}>
        <Routes>
          <Route path="/event/:id" element={<EventDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Verify event title is displayed
    expect(await screen.findByText('Upcoming Festival')).toBeInTheDocument();

    // Verify NO delete button is offered anywhere
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/delete event/i)).not.toBeInTheDocument();

    // Verify cancel action button is present for organizer
    const cancelBtn = screen.getByRole('button', { name: /cancel event/i });
    expect(cancelBtn).toBeInTheDocument();
    expect(cancelBtn).not.toBeDisabled();

    // Click cancel button
    fireEvent.click(cancelBtn);

    // Verify confirmation message states cancellation cannot be undone
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringMatching(/cannot be undone/i),
    );
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Are you sure you want to cancel "Upcoming Festival"\?/i),
    );

    await waitFor(() => expect(cancelCalled).toBe(true));

    // Verify "Cancelled" label is visible
    await waitFor(() => {
      const badges = screen.getAllByText('Cancelled');
      expect(badges.length).toBeGreaterThan(0);
    });

    // Verify cancel button is now disabled and displays "Cancelled"
    expect(screen.getByRole('button', { name: /^cancelled$/i })).toBeDisabled();

    // Verify edit button is disabled
    const editBtn = screen.getByRole('button', { name: /edit/i });
    expect(editBtn).toBeDisabled();

    confirmSpy.mockRestore();
  });

  it('does not offer cancel action if the event start has already passed', async () => {
    getCurrentUserMock.mockReturnValue(organizerUser);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/events/evt-past')) {
        return new Response(
          JSON.stringify({
            id: 'evt-past',
            title: 'Past Workshop',
            description: 'Already completed workshop',
            category: 'Tech',
            start_datetime: '2020-01-01T10:00:00.000Z',
            end_datetime: '2020-01-01T12:00:00.000Z',
            cost: 0,
            max_capacity: 30,
            location_name: 'Room 101',
            latitude: 0,
            longitude: 0,
            created_by: 'org-1',
            status: 'active',
            profiles: { full_name: 'Organizer Name', username: 'org_one' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/event/evt-past']}>
        <Routes>
          <Route path="/event/:id" element={<EventDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Past Workshop')).toBeInTheDocument();

    // Cancel action must not be offered for past events
    expect(screen.queryByRole('button', { name: /cancel event/i })).not.toBeInTheDocument();
    // Delete action must never be offered
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('allows organizer and participants to open chat from details page for cancelled event in read-only mode', async () => {
    getCurrentUserMock.mockReturnValue(attendeeUser);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/events/evt-canc')) {
        return new Response(
          JSON.stringify({
            id: 'evt-canc',
            title: 'Cancelled Meetup',
            description: 'This meetup was cancelled',
            category: 'Social',
            start_datetime: '2030-09-01T10:00:00.000Z',
            end_datetime: '2030-09-01T12:00:00.000Z',
            cost: 0,
            max_capacity: 20,
            location_name: 'Lounge',
            latitude: 0,
            longitude: 0,
            created_by: 'org-1',
            status: 'cancelled',
            profiles: { full_name: 'Organizer Name', username: 'org_one' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('/api/participants/evt-canc/participants')) {
        return new Response(
          JSON.stringify([
            { user_id: 'org-1', status: 'going', profiles: { full_name: 'Organizer Name' } },
            { user_id: 'att-1', status: 'going', profiles: { full_name: 'Attendee Name' } },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('/api/participants/evt-canc/my-status')) {
        return new Response(JSON.stringify({ status: 'going' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/api/auth/me') || url.includes('/api/profile/me')) {
        return new Response(JSON.stringify({ id: 'att-1', full_name: 'Attendee Name' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/event/evt-canc']}>
        <Routes>
          <Route path="/event/:id" element={<EventDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Cancelled Meetup')).toBeInTheDocument();

    // Verify "Cancelled" badge is shown
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);

    // Verify chat button is accessible and indicates read-only
    const chatBtn = await screen.findByRole('button', { name: /open event chat/i });
    expect(chatBtn).toBeInTheDocument();
    expect(chatBtn).not.toBeDisabled();
    expect(screen.getByText(/This event is cancelled\. Chat is read-only/i)).toBeInTheDocument();

    // Verify join button is disabled or indicates cancelled
    const joinBtn = screen.getByRole('button', { name: /event cancelled/i });
    expect(joinBtn).toBeDisabled();
  });
});
