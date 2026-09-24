import { describe, expect, it } from 'vitest';
import { mapApiEventToItem } from '@/lib/mapApiEvent';

describe('mapApiEventToItem organizer identity', () => {
  it('shows username (Full Name) and the organizer picture', () => {
    const item = mapApiEventToItem({
      id: 'e1',
      title: 'Night',
      start_datetime: '2026-06-01T18:00:00Z',
      created_by: 'u1',
      organizer_username: 'john_42',
      organizer_name: 'John Smith',
      organizer_avatar: 'https://cdn.example.com/john.jpg',
      organizer_avatar_kind: 'photo',
    });
    expect(item.organizer).toBe('john_42 (John Smith)');
    expect(item.organizerAvatar).toBe('https://cdn.example.com/john.jpg');
  });

  it('shows the full name when the organizer has no username', () => {
    const item = mapApiEventToItem({
      id: 'e2',
      title: 'Day',
      start_datetime: '2026-06-01T18:00:00Z',
      organizer_name: 'Jane Doe',
      organizer_avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=aurora',
    });
    expect(item.organizer).toBe('Jane Doe');
    expect(item.organizer).not.toContain('()');
  });
});
