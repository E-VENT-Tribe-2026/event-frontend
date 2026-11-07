import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MyCalendarSection from '@/components/MyCalendarSection';
import type { EventItem } from '@/lib/storage';

function event(partial: Partial<EventItem> & Pick<EventItem, 'id' | 'title' | 'date'>): EventItem {
  return {
    description: '',
    category: 'Music',
    time: '20:00',
    location: 'Berlin',
    lat: 0,
    lng: 0,
    budget: 0,
    participantsLimit: 10,
    participants: [],
    image: 'https://example.com/e.jpg',
    organizer: 'Org',
    organizerId: 'org',
    organizerAvatar: '',
    isPrivate: false,
    isDraft: false,
    requiresApproval: false,
    reviews: [],
    reports: [],
    collaborators: [],
    ...partial,
  };
}

describe('MyCalendarSection', () => {
  it('opens a calendar popup, highlights event days, and shows a day modal', () => {
    const onOpenEvent = vi.fn();
    render(
      <MyCalendarSection
        events={[event({ id: 'e1', title: 'Night Market', date: '2030-10-15' })]}
        onOpenEvent={onOpenEvent}
      />,
    );

    expect(screen.queryByTestId('my-calendar-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('my-calendar'));
    expect(screen.getByTestId('my-calendar-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Highlighted days have events/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('gridcell', { name: '15' }));
    const dayModal = screen.getByTestId('my-calendar-day-events');
    expect(within(dayModal).getByText('Night Market')).toBeInTheDocument();

    fireEvent.click(within(dayModal).getByRole('button', { name: /night market/i }));
    expect(onOpenEvent).toHaveBeenCalledWith('e1');
  });
});
