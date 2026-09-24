import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { EventItem, User } from '@/lib/storage';
import EventCard from '@/components/EventCard';

const { getCurrentUserMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn<[], User | null>(),
}));

vi.mock('@/lib/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/storage')>();
  return {
    ...mod,
    getCurrentUser: () => getCurrentUserMock(),
  };
});

function makeEvent(over: Partial<EventItem>): EventItem {
  return {
    id: 'evt-1',
    title: 'Test Event',
    description: '',
    category: 'Music',
    date: '2026-10-01',
    time: '21:00',
    location: 'Somewhere',
    lat: 0,
    lng: 0,
    budget: 0,
    participantsLimit: 50,
    participants: [],
    image: '',
    organizer: '',
    organizerId: '',
    organizerAvatar: '',
    isPrivate: false,
    isDraft: false,
    requiresApproval: false,
    reviews: [],
    reports: [],
    collaborators: [],
    ...over,
  };
}

function renderCard(event: EventItem) {
  return render(
    <MemoryRouter>
      <EventCard event={event} />
    </MemoryRouter>
  );
}

describe('EventCard organizer display (#216)', () => {
  beforeEach(() => {
    getCurrentUserMock.mockReturnValue(null);
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);
  });

  it('shows "username (Full Name)" when the organizer has a username', () => {
    renderCard(
      makeEvent({ organizer: 'John Smith', organizerId: 'u1', organizerUsername: 'john_42' })
    );
    expect(screen.getByText('john_42 (John Smith)')).toBeInTheDocument();
  });

  it('falls back to full name alone when the organizer has no username yet', () => {
    renderCard(makeEvent({ organizer: 'Jane Doe', organizerId: 'u2', organizerUsername: undefined }));
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
  });

  it('lowercases nothing on its own — trusts the stored username as-is', () => {
    renderCard(
      makeEvent({ organizer: 'Alex Lee', organizerId: 'u3', organizerUsername: 'alex.lee_99' })
    );
    expect(screen.getByText('alex.lee_99 (Alex Lee)')).toBeInTheDocument();
  });
});
