export type RepeatFreq = 'none' | 'weekly' | 'monthly';

export const REPEAT_MAX = 12;
export const REPEAT_MIN = 2;

function addCalendarMonths(start: Date, months: number): Date {
  const next = new Date(start.getTime());
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() !== day) next.setDate(0);
  return next;
}

/** First occurrence plus follow-ups. `none` always returns a single date. */
export function recurringStartDates(start: Date, freq: RepeatFreq, count: number): Date[] {
  if (freq === 'none' || !Number.isFinite(start.getTime())) return [new Date(start.getTime())];
  const n = Math.max(1, Math.min(REPEAT_MAX, Math.floor(count) || 1));
  const out: Date[] = [];
  for (let i = 0; i < n; i++) {
    if (freq === 'weekly') {
      const next = new Date(start.getTime());
      next.setDate(start.getDate() + i * 7);
      out.push(next);
    } else {
      out.push(addCalendarMonths(start, i));
    }
  }
  return out;
}

export function clampRepeatCount(value: string | number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 4;
  return Math.min(REPEAT_MAX, Math.max(REPEAT_MIN, Math.floor(n)));
}
