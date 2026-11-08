import { describe, it, expect } from 'vitest';
import { clampRepeatCount, recurringStartDates } from '@/lib/eventRecurrence';

describe('recurringStartDates', () => {
  it('returns only the original start when frequency is none', () => {
    const start = new Date(2026, 5, 10, 18, 0, 0);
    const dates = recurringStartDates(start, 'none', 8);
    expect(dates).toHaveLength(1);
    expect(dates[0].getTime()).toBe(start.getTime());
  });

  it('builds weekly starts seven days apart', () => {
    const start = new Date(2026, 5, 10, 18, 30, 0);
    const dates = recurringStartDates(start, 'weekly', 3);
    expect(dates).toHaveLength(3);
    expect(dates[1].getDate()).toBe(17);
    expect(dates[2].getDate()).toBe(24);
    expect(dates[2].getHours()).toBe(18);
    expect(dates[2].getMinutes()).toBe(30);
  });

  it('clamps January 31 monthly follow-ups to the end of shorter months', () => {
    const start = new Date(2026, 0, 31, 19, 0, 0);
    const dates = recurringStartDates(start, 'monthly', 3);
    expect(dates).toHaveLength(3);
    expect(dates[0].getMonth()).toBe(0);
    expect(dates[0].getDate()).toBe(31);
    expect(dates[1].getMonth()).toBe(1);
    expect(dates[1].getDate()).toBe(28);
    expect(dates[2].getMonth()).toBe(2);
    expect(dates[2].getDate()).toBe(31);
  });
});

describe('clampRepeatCount', () => {
  it('keeps counts between 2 and 12', () => {
    expect(clampRepeatCount(1)).toBe(2);
    expect(clampRepeatCount(4)).toBe(4);
    expect(clampRepeatCount(99)).toBe(12);
    expect(clampRepeatCount('nope')).toBe(4);
  });
});
