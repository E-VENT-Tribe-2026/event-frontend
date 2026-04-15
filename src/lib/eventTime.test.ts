import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { EventItem } from '@/lib/storage';
import { eventStartMs, isEventUpcoming } from './eventTime';

const baseEvent = (over: Partial<EventItem>): EventItem =>
  ({
    id: '1',
    title: 'T',
    description: 'D',
    category: 'Music',
    date: '2030-06-15',
    time: '18:00',
    location: 'L',
    lat: 1,
    lng: 2,
    budget: 0,
    participantsLimit: 10,
    participants: [],
    image: '',
    organizer: 'o',
    organizerId: 'oid',
    organizerAvatar: '',
    isPrivate: false,
    isDraft: false,
    requiresApproval: false,
    reviews: [],
    reports: [],
    collaborators: [],
    ...over,
  }) as EventItem;

describe('eventStartMs', () => {
  it('parses date and time to epoch ms', () => {
    const ms = eventStartMs(baseEvent({ date: '2030-01-02', time: '12:30' }));
    expect(Number.isFinite(ms)).toBe(true);
    expect(new Date(ms).toISOString().startsWith('2030-01-02')).toBe(true);
  });

  it('defaults time to midnight when empty', () => {
    const ms = eventStartMs(baseEvent({ date: '2030-03-04', time: '' }));
    expect(Number.isFinite(ms)).toBe(true);
  });
});

describe('isEventUpcoming', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-06-01T12:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when start is after “now”', () => {
    expect(isEventUpcoming(baseEvent({ date: '2030-12-01', time: '10:00' }))).toBe(true);
  });

  it('returns false when start is in the past', () => {
    expect(isEventUpcoming(baseEvent({ date: '2020-01-01', time: '10:00' }))).toBe(false);
  });

  it('returns false for invalid date', () => {
    expect(isEventUpcoming(baseEvent({ date: 'not-a-date', time: '10:00' }))).toBe(false);
  });
});
