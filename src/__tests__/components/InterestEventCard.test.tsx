import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InterestEventCard from '@/components/InterestEventCard';
import type { EventItem } from '@/lib/storage';

const event = {
  id: 'evt-mini',
  title: 'Quiet Jazz Night',
  description: 'desc',
  category: 'Music',
  date: '2030-06-15',
  time: '18:00',
  location: 'Paris',
  lat: 0,
  lng: 0,
  budget: 0,
  participantsLimit: 20,
  participants: [],
  image: '',
  organizer: 'Maya',
  organizerId: 'u1',
  organizerAvatar: '',
  isPrivate: false,
  isDraft: false,
  requiresApproval: false,
  reviews: [],
  reports: [],
  collaborators: [],
} as EventItem;

describe('InterestEventCard', () => {
  it('shows a welcome-style category card without a photo banner', () => {
    render(
      <MemoryRouter>
        <InterestEventCard event={event} />
      </MemoryRouter>,
    );
    const card = screen.getByRole('link', { name: /Quiet Jazz Night/i });
    expect(card).toHaveAttribute('href', '/event/evt-mini');
    expect(card).toHaveTextContent('🎵');
    expect(card.className).toContain('from-purple-500/20');
    expect(card.className).toContain('border-purple-500/30');
    expect(screen.getByText('Music')).toBeInTheDocument();
    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('Music')).not.toHaveClass('truncate');
    expect(card.querySelector('img')).toBeNull();
    expect(screen.queryByText('Free')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view details/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Maya')).not.toBeInTheDocument();
  });

  it('renders a full-width row card for the interests list', () => {
    render(
      <MemoryRouter>
        <InterestEventCard event={event} variant="row" />
      </MemoryRouter>,
    );
    const card = screen.getByTestId('interest-event-row');
    expect(card).toHaveAttribute('href', '/event/evt-mini');
    expect(card.className).toContain('w-full');
    expect(card.className).not.toContain('w-56');
    expect(screen.getByText('Quiet Jazz Night')).toBeInTheDocument();
    expect(card.querySelector('img')).toBeNull();
  });

  it('keeps the full category name even when the address is long', () => {
    render(
      <MemoryRouter>
        <InterestEventCard event={{ ...event, category: 'Networking', location: 'InnoWi, 1, Fahrenheitstraße, Bremen' }} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Networking')).toBeInTheDocument();
    expect(screen.getByText('Networking')).toHaveClass('shrink-0', 'whitespace-nowrap');
  });
});
