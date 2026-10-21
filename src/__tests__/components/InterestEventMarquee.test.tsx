import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InterestEventMarquee from '@/components/InterestEventMarquee';
import type { EventItem } from '@/lib/storage';

const event = {
  id: 'evt-jazz',
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

describe('InterestEventMarquee', () => {
  it('loops the interest cards so the strip can scroll like the welcome page', () => {
    render(
      <MemoryRouter>
        <InterestEventMarquee events={[event]} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('interest-marquee')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Quiet Jazz Night/i }).length).toBeGreaterThan(1);
  });
});
