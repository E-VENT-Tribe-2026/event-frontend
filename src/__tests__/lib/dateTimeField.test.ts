import { describe, it, expect } from 'vitest';
import { dateFromIso, formatIsoDateLabel, formatTimeLabel, isoFromDate, timeSlots } from '@/lib/dateTimeField';

describe('dateTimeField', () => {
  it('round-trips a local calendar date', () => {
    const date = dateFromIso('2026-10-30');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(30);
    expect(isoFromDate(date!)).toBe('2026-10-30');
  });

  it('formats a readable date and time label', () => {
    expect(formatIsoDateLabel('2026-10-30')).toMatch(/Oct/);
    expect(formatTimeLabel('15:00')).toMatch(/15:00/);
  });

  it('builds 15-minute time slots for a full day', () => {
    const slots = timeSlots(15);
    expect(slots[0]).toBe('00:00');
    expect(slots).toContain('15:00');
    expect(slots.at(-1)).toBe('23:45');
    expect(slots).toHaveLength(96);
  });
});
