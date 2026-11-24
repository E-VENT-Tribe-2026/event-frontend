import type { EventItem } from '@/lib/storage';
import { dateFromIso } from '@/lib/dateTimeField';

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
  const rawDate = (e.date || '').trim();
  const rawTime = (e.time || '').trim();
  if (!rawDate) return NaN;
  if (/T/.test(rawDate) || /Z|[+-]\d{2}:\d{2}$/.test(rawDate)) {
    const parsed = new Date(rawDate);
    return parsed.getTime();
  }
  const day = dateFromIso(rawDate.slice(0, 10));
  if (!day) {
    const parsed = new Date(rawTime ? `${rawDate}T${rawTime}` : rawDate);
    return parsed.getTime();
  }
  const tm = /^(\d{1,2}):(\d{2})/.exec(rawTime);
  day.setHours(tm ? Number(tm[1]) : 0, tm ? Number(tm[2]) : 0, 0, 0);
  return day.getTime();
}

/** Local midnight of the event’s calendar day, for month grids. */
export function eventLocalDay(e: EventItem): Date | null {
  const fromIso = dateFromIso((e.date || '').trim().slice(0, 10));
  if (fromIso) return fromIso;
  const ms = eventStartMs(e);
  if (Number.isNaN(ms)) return null;
  const value = new Date(ms);
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
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
