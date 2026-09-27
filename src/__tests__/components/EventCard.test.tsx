import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EventCard from '@/components/EventCard';
import { type EventItem } from '@/lib/storage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function makeEvent(overrides?: Partial<EventItem>): EventItem {
  return {
    id: 'evt-1',
    title: 'Test Event',
    description: 'A test event',
    category: 'Music',
    date: '2026-10-01',
    time: '21:00',
    location: 'Somewhere',
    lat: 40.7128,
    lng: -74.006,
    budget: 0,
    participantsLimit: 50,
    participants: [],
    image: '',
    organizer: 'John Smith',
    organizerId: 'u1',
    organizerUsername: 'john_42',
    organizerAvatar: '',
    isPrivate: false,
    isDraft: false,
    requiresApproval: false,
    reviews: [],
    reports: [],
    collaborators: [],
    ...overrides,
  };
}

describe('EventCard organizer display (#216)', () => {
  it('shows full name and username when the organizer has a username', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EventCard event={makeEvent({ organizer: 'John Smith', organizerId: 'u1', organizerUsername: 'john_42' })} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('@john_42')).toBeInTheDocument();
  });

  it('falls back to full name alone when the organizer has no username yet', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EventCard event={makeEvent({ organizer: 'John Smith', organizerId: 'u1', organizerUsername: undefined })} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it('lowercases nothing on its own — trusts the stored username as-is', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EventCard event={makeEvent({ organizer: 'Alex Lee', organizerId: 'u3', organizerUsername: 'alex.lee_99' })} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText('Alex Lee')).toBeInTheDocument();
    expect(screen.getByText('@alex.lee_99')).toBeInTheDocument();
  });
});