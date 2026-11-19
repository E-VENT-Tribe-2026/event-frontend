/** Local calendar date from an ISO `YYYY-MM-DD` value. */
export function dateFromIso(iso: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return date;
}

export function isoFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatIsoDateLabel(iso: string): string {
  const date = dateFromIso(iso);
  if (!date) return iso;
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTimeLabel(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return hhmm;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || hours > 23 || minutes > 59) return hhmm;
  const date = new Date(1970, 0, 1, hours, minutes);
  const twelve = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const twentyFour = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return twelve === twentyFour ? twentyFour : `${twentyFour} · ${twelve}`;
}

export function timeSlots(stepMinutes = 15): string[] {
  const step = Math.max(1, Math.min(60, Math.floor(stepMinutes)));
  const slots: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
}

export function parseHhmm(hhmm: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

function padHhmm(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Adds minutes to an `HH:mm` clock time and wraps at midnight. */
export function addMinutesHhmm(hhmm: string, deltaMinutes: number): string {
  const parsed = parseHhmm(hhmm);
  if (!parsed) return hhmm;
  const day = 24 * 60;
  let total = parsed.hours * 60 + parsed.minutes + deltaMinutes;
  total = ((total % day) + day) % day;
  return padHhmm(Math.floor(total / 60), total % 60);
}

/** Local start/end instants. If end is not after start on the same date, it runs overnight. */
export function eventRangeFromTimes(
  dateIso: string,
  startHhmm: string,
  endHhmm: string,
): { start: Date; end: Date } | null {
  const startParts = parseHhmm(startHhmm);
  const endParts = parseHhmm(endHhmm);
  const day = dateFromIso(dateIso);
  if (!startParts || !endParts || !day) return null;
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startParts.hours, startParts.minutes);
  let end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endParts.hours, endParts.minutes);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

export function formatEventDuration(start: Date, end: Date): string {
  const totalMin = Math.round((end.getTime() - start.getTime()) / 60000);
  if (!Number.isFinite(totalMin) || totalMin <= 0) return '';
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  if (mins === 30) return `${hours}.5 hours`;
  return `${hours}h ${mins}m`;
}
