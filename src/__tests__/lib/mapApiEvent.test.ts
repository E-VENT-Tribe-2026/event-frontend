import { describe, it, expect } from 'vitest';
import { mapApiEventToItem } from '@/lib/mapApiEvent';

const harryPotterNight = {
  id: 'db9627bd-84d2-460e-8a29-231ec963a1ee',
  title: 'Harry Potter Movie Night',
  description: 'Come and enjoy a magical evenning with fellow potterheads.',
  category: 'Movies',
  cost: 5,
  max_capacity: 20,
  status: 'active',
  start_datetime: '2026-12-25T19:30:00+00:00',
  end_datetime: '2026-12-25T21:30:00+00:00',
  location_name: 'InnoWi, 1, Fahrenheitstraße, BITZ, Lehe, Horn-Lehe, Bremen-Ost, Bremen, 28359, Germany',
  latitude: 53.107601,
  longitude: 8.848829,
  created_by: '8b8db79c-c44d-48a6-888c-0dc0aac6fb4e',
  created_at: '2026-10-23T20:25:28.120083+00:00',
  updated_at: '2026-10-23T20:25:28.120083+00:00',
  banner_url: null,
  banner: null,
  organizer: {
    id: '8b8db79c-c44d-48a6-888c-0dc0aac6fb4e',
    username: 'sonia',
    full_name: 'Sonia Mangane',
    display_name: 'sonia',
    avatar_kind: 'icon',
    icon_id: 'sam',
    avatar_url: 'https://api.dicebear.com/9.x/avataaars/svg?seed=sam',
  },
  friends_attending_count: 1,
};

describe('mapApiEventToItem', () => {
  it('maps a nested organizer and friends_attending_count from the events API', () => {
    const item = mapApiEventToItem(harryPotterNight);

    expect(item.id).toBe(harryPotterNight.id);
    expect(item.title).toBe('Harry Potter Movie Night');
    expect(item.organizer).toBe('Sonia Mangane');
    expect(item.organizerFullName).toBe('Sonia Mangane');
    expect(item.organizerUsername).toBe('sonia');
    expect(item.organizerId).toBe(harryPotterNight.created_by);
    expect(item.organizerAvatar).toBe(harryPotterNight.organizer.avatar_url);
    expect(item.friendsAttendingCount).toBe(1);
    expect(item.lat).toBe(53.107601);
    expect(item.lng).toBe(8.848829);
    expect(item.budget).toBe(5);
    expect(item.participantsLimit).toBe(20);
    expect(item.location).toContain('InnoWi');
  });

  it('still reads flat organizer_name / profiles fields', () => {
    const item = mapApiEventToItem({
      id: 'e1',
      title: 'T',
      organizer_name: 'Alex',
      organizer_username: 'alex',
      profiles: { full_name: 'Ignored', username: 'ignored' },
    });
    expect(item.organizerFullName).toBe('Alex');
    expect(item.organizerUsername).toBe('alex');
  });
});
