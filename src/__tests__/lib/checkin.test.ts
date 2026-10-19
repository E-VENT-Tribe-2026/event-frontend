import { describe, it, expect, beforeEach } from 'vitest';
import { addCheckin, isCheckedIn, isCheckinWindow, listCheckins, parseTicketQr } from '@/lib/checkin';

describe('checkin', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and lists check-ins per event', () => {
    addCheckin('evt-1', { userId: 'u1', name: 'Ada' });
    expect(isCheckedIn('evt-1', 'u1')).toBe(true);
    expect(isCheckedIn('evt-1', 'u2')).toBe(false);
    expect(listCheckins('evt-1').map((c) => c.name)).toEqual(['Ada']);
  });

  it('opens the door window from 3h before start until 12h after', () => {
    const start = Date.parse('2030-01-01T18:00:00.000Z');
    expect(isCheckinWindow(start, Date.parse('2030-01-01T14:59:00.000Z'))).toBe(false);
    expect(isCheckinWindow(start, Date.parse('2030-01-01T15:00:00.000Z'))).toBe(true);
    expect(isCheckinWindow(start, Date.parse('2030-01-02T06:00:00.000Z'))).toBe(true);
    expect(isCheckinWindow(start, Date.parse('2030-01-02T06:00:01.000Z'))).toBe(false);
  });

  it('parses ticket QR JSON or a raw id', () => {
    expect(parseTicketQr(JSON.stringify({ name: 'Ada', event: 'Jazz', ticketId: 't-1' }))).toEqual({
      name: 'Ada',
      event: 'Jazz',
      ticketId: 't-1',
    });
    expect(parseTicketQr('plain-id')).toEqual({ ticketId: 'plain-id' });
  });
});
