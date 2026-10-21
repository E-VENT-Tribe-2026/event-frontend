import type { EventItem } from '@/lib/storage';
import { eventStartMs } from '@/lib/eventTime';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** UTC stamp Google Calendar and ICS both accept, e.g. 20300615T160000Z */
export function toUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function eventDateRange(event: EventItem): { start: Date; end: Date } {
  const startMs = eventStartMs(event);
  const start = Number.isNaN(startMs) ? new Date() : new Date(startMs);
  return { start, end: new Date(start.getTime() + TWO_HOURS_MS) };
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function googleCalendarUrl(event: EventItem): string {
  const { start, end } = eventDateRange(event);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || 'Event',
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
    details: event.description || '',
    location: event.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsContent(event: EventItem): string {
  const { start, end } = eventDateRange(event);
  const uid = `${event.id || 'event'}@e-vent.app`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//E-VENT//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${icsEscape(event.title || 'Event')}`,
    `DESCRIPTION:${icsEscape(event.description || '')}`,
    `LOCATION:${icsEscape(event.location || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function downloadIcs(event: EventItem): void {
  const blob = new Blob([icsContent(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(event.title || 'event').replace(/[^\w]+/g, '-').slice(0, 40)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
