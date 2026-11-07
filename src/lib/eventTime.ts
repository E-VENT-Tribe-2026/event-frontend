import type { EventItem } from '@/lib/storage';

/** Calendar date and clock time in the viewer's timezone (not UTC slices). */
export function localDateTimeParts(value: Date): { date: string; time: string } {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  const hh = String(value.getHours()).padStart(2, '0');
  const mm = String(value.getMinutes()).padStart(2, '0');
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

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

export function isEventCancelled(e: { status?: string; isCancelled?: boolean } | null | undefined): boolean {
  if (!e) return false;
  if (e.isCancelled) return true;
  const s = String(e.status || '').toLowerCase();
  return s === 'cancelled' || s === 'canceled';
}
