import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EventCard from '@/components/EventCard';
import InterestEventCard from '@/components/InterestEventCard';
import FriendsAttendingCount from '@/components/FriendsAttendingCount';
import { friendsAttendingHtml } from '@/lib/friendsAttendingPopup';
import { friendsAttendingCountFrom, mapApiEventToItem } from '@/lib/mapApiEvent';
import type { EventItem } from '@/lib/storage';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function makeEvent(overrides?: Partial<EventItem>): EventItem {
  return {
    id: 'evt-1', title: 'Test Event', description: 'A test event', category: 'Music',
    date: '2030-10-01', time: '21:00', location: 'Somewhere', lat: 40.7, lng: -74,
    budget: 0, participantsLimit: 50, participants: [], image: '', organizer: 'John Smith',
    organizerId: 'u1', organizerUsername: 'john_42', organizerAvatar: '',
    isPrivate: false, isDraft: false, requiresApproval: false, reviews: [], reports: [], collaborators: [],
    ...overrides,
  };
}

const renderCard = (event: EventItem) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EventCard event={event} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('FriendsAttendingCount', () => {
  it('shows the Friends icon with the number in green', () => {
    render(<FriendsAttendingCount count={3} />);
    const badge = screen.getByTestId('friends-attending-count');
    expect(badge).toHaveTextContent('3');
    expect(badge).toHaveAttribute('aria-label', '3 friends attending');
    expect(screen.getByText('3')).toHaveClass('text-green-500');
  });

  it('says "friend" for one friend', () => {
    render(<FriendsAttendingCount count={1} />);
    expect(screen.getByTestId('friends-attending-count')).toHaveAttribute('aria-label', '1 friend attending');
  });

  it.each([0, undefined, -2])('shows nothing when the count is %s', (count) => {
    const { container } = render(<FriendsAttendingCount count={count as number | undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Home event cards: friends attending (#290)', () => {
  it('an event card shows the green number when friends attend', () => {
    renderCard(makeEvent({ friendsAttendingCount: 2 }));
    expect(screen.getByTestId('friends-attending-count')).toHaveTextContent('2');
  });

  it('an event card shows nothing when no friend attends', () => {
    renderCard(makeEvent({ friendsAttendingCount: 0 }));
    expect(screen.queryByTestId('friends-attending-count')).not.toBeInTheDocument();
  });

  it('an event card shows nothing when the backend sent no number', () => {
    renderCard(makeEvent());
    expect(screen.queryByTestId('friends-attending-count')).not.toBeInTheDocument();
  });

  it('a recommended card shows the number when friends attend, and nothing otherwise', () => {
    const { rerender } = render(
      <MemoryRouter><InterestEventCard event={makeEvent({ friendsAttendingCount: 4 })} /></MemoryRouter>,
    );
    expect(screen.getByTestId('friends-attending-count')).toHaveTextContent('4');
    rerender(<MemoryRouter><InterestEventCard event={makeEvent({ friendsAttendingCount: 0 })} /></MemoryRouter>);
    expect(screen.queryByTestId('friends-attending-count')).not.toBeInTheDocument();
  });
});

describe('Map event window: friends attending (#290)', () => {
  it('writes the Friends icon and the green number when friends attend', () => {
    const html = friendsAttendingHtml(3);
    expect(html).toContain('<svg');
    expect(html).toContain('#22c55e">3</span>');
    expect(html).toContain('3 friends attending');
  });

  it('writes nothing when none attend or the number is not usable', () => {
    for (const bad of [0, undefined, -1, NaN]) expect(friendsAttendingHtml(bad as number | undefined)).toBe('');
  });

  it('only ever writes a whole number into the markup', () => {
    const html = friendsAttendingHtml('<img src=x onerror=alert(1)>' as unknown as number);
    expect(html).toBe('');
    expect(friendsAttendingHtml(2.9)).toContain('>2</span>');
  });
});

describe('friends_attending_count from the backend', () => {
  it('is read into the event item', () => {
    const item = mapApiEventToItem({ id: 'e1', title: 'T', category: 'Music', start_datetime: '2030-01-01T10:00:00Z', friends_attending_count: 5 });
    expect(item.friendsAttendingCount).toBe(5);
  });

  it('counts a missing, zero or invalid value as 0', () => {
    expect(mapApiEventToItem({ id: 'e1', title: 'T' }).friendsAttendingCount).toBe(0);
    for (const v of [0, null, 'abc', -3, NaN]) expect(friendsAttendingCountFrom(v)).toBe(0);
    expect(friendsAttendingCountFrom('2')).toBe(2);
  });
});
