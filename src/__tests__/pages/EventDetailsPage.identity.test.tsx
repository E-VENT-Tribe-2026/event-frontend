import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

const ownerUser = {
  id: 'org-1',
  name: 'Owner Name',
  email: 'owner@test.com',
  role: 'organizer' as const,
  password: 'secret123',
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
} satisfies User;

function mockFetch() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/events/evt-1')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'evt-1',
            title: 'Test Event',
            description: 'A test event',
            category: 'Music',
            start_datetime: '2030-05-01T12:00:00.000Z',
            end_datetime: '2030-05-01T14:00:00.000Z',
            cost: 10,
            max_capacity: 20,
            location_name: 'Test Venue',
            latitude: 0,
            longitude: 0,
            created_by: 'org-1',
            status: 'active',
            profiles: { full_name: 'Owner Name', username: 'owner_1', avatar_url: '' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    }
    if (url.includes('/api/participants/evt-1/participants')) {
      return Promise.resolve(
        new Response(
          JSON.stringify([
            { user_id: 'org-1', status: 'going', profiles: { full_name: 'Owner Name', username: 'owner_1' } },
            { user_id: 'p2', status: 'going', profiles: { full_name: 'Jane Doe' } },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    }
    return Promise.resolve(new Response('{}', { status: 500 }));
  });
}

function renderPage() {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/event/evt-1']}>
      <Routes>
        <Route path="/event/:id" element={<EventDetailsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EventDetailsPage organizer/attendee identity display (#215)', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReturnValue(ownerUser);
    getAuthTokenMock.mockReturnValue(null);
    vi.stubGlobal('fetch', mockFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the organizer full name above their @username', async () => {
    renderPage();

    const fullName = await screen.findByTestId('organizer-full-name');
    const username = screen.getByTestId('organizer-username');

    expect(fullName).toHaveTextContent('Owner Name');
    expect(username).toHaveTextContent('@owner_1');
    expect(
      fullName.compareDocumentPosition(username) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // The old combined "username (Full Name)" format is gone
    expect(screen.queryByText('owner_1 (Owner Name)')).not.toBeInTheDocument();
  });

  it('lists attendees: one with a username shows both identities, one without shows the full name alone', async () => {
    renderPage();

    // Attendee without a username: full name only, no "@" handle
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText(/@jane/i)).not.toBeInTheDocument();

    // Owner is both the organizer and an attendee, so their identity appears more than once
    await waitFor(() => {
      expect(screen.getAllByText(/Owner Name/).length).toBeGreaterThan(1);
      expect(screen.getAllByText(/owner_1/).length).toBeGreaterThan(1);
    });

    // Combined legacy format must not appear anywhere
    expect(screen.queryByText('owner_1 (Owner Name)')).not.toBeInTheDocument();
  });
});