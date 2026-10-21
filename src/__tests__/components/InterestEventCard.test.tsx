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
  it('shows a compact title, time and place without join or organizer chrome', () => {
    render(
      <MemoryRouter>
        <InterestEventCard event={event} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Quiet Jazz Night/i })).toHaveAttribute('href', '/event/evt-mini');
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Music')).toBeInTheDocument();
    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view details/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Maya')).not.toBeInTheDocument();
  });
});
