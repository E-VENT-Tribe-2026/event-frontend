import type { EventItem } from '@/lib/storage';

/** Parse event start as epoch ms; NaN if invalid. */
export function eventStartMs(e: EventItem): number {
  const t = new Date(`${e.date}T${e.time || '00:00'}`);
  return t.getTime();
}

export function isEventUpcoming(e: EventItem): boolean {
  const ms = eventStartMs(e);
  if (Number.isNaN(ms)) return false;
  return ms >= Date.now();
}
