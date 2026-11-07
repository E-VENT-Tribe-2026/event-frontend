import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FriendActivityMarquee from '@/components/FriendActivityMarquee';
import type { EventItem } from '@/lib/storage';
import type { UserSummary } from '@/lib/friendsApi';

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

const friend: UserSummary = {
  id: 'f1',
  username: 'maya',
  full_name: 'Maya',
  display_name: 'Maya',
  avatar_kind: 'icon',
  icon_id: 'sun',
  avatar_url: null,
};

describe('FriendActivityMarquee', () => {
  it('loops friend event cards so the strip can scroll like the welcome page', () => {
    render(
      <MemoryRouter>
        <FriendActivityMarquee items={[{ event, friends: [friend] }]} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('friends-marquee')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Quiet Jazz Night/i }).length).toBeGreaterThan(1);
    expect(screen.getAllByText('Maya is going').length).toBeGreaterThan(1);
  });
});
