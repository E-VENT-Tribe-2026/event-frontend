import { describe, it, expect } from 'vitest';
import type { EventItem } from '@/lib/storage';
import { eventDateRange, googleCalendarUrl, icsContent, toUtcStamp } from '@/lib/calendar';

const event = {
  id: 'evt-cal',
  title: 'Jazz Night',
  description: 'Live band',
  category: 'Music',
  date: '2030-06-15',
  time: '18:00',
  location: 'Paris',
  lat: 0,
  lng: 0,
  budget: 0,
  participantsLimit: 10,
  participants: [],
  image: '',
  organizer: 'Org',
  organizerId: 'o1',
  organizerAvatar: '',
  isPrivate: false,
  isDraft: false,
  requiresApproval: false,
  reviews: [],
  reports: [],
  collaborators: [],
} as EventItem;

describe('calendar helpers', () => {
  it('builds a 2-hour UTC range from the event start', () => {
    const { start, end } = eventDateRange(event);
    expect(end.getTime() - start.getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it('builds a Google Calendar template URL', () => {
    const url = googleCalendarUrl(event);
    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    expect(url).toContain('text=Jazz+Night');
    expect(url).toContain('location=Paris');
    const { start, end } = eventDateRange(event);
    expect(decodeURIComponent(url)).toContain(`${toUtcStamp(start)}/${toUtcStamp(end)}`);
  });

  it('serializes an ICS event', () => {
    const ics = icsContent(event);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Jazz Night');
    expect(ics).toContain('LOCATION:Paris');
    expect(ics).toContain('UID:evt-cal@e-vent.app');
  });
});
