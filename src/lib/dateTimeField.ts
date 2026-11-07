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
