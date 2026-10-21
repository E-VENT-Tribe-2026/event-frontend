export const CHECKINS_CHANGED_EVENT = 'eventapp:checkins-changed';

export type CheckinRecord = {
  userId: string;
  name: string;
  at: string;
  ticketId?: string;
};

function storageKey(eventId: string) {
  return `eventapp:checkins:${eventId}`;
}

function read(eventId: string): Record<string, CheckinRecord> {
  try {
    const raw = localStorage.getItem(storageKey(eventId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CheckinRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function write(eventId: string, map: Record<string, CheckinRecord>) {
  try {
    localStorage.setItem(storageKey(eventId), JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHECKINS_CHANGED_EVENT, { detail: { eventId } }));
  }
}

export function listCheckins(eventId: string): CheckinRecord[] {
  return Object.values(read(eventId)).sort((a, b) => a.at.localeCompare(b.at));
}

export function isCheckedIn(eventId: string, userId: string | null | undefined): boolean {
  if (!userId) return false;
  return Boolean(read(eventId)[userId]);
}

export function addCheckin(eventId: string, record: Omit<CheckinRecord, 'at'> & { at?: string }): CheckinRecord {
  const map = read(eventId);
  const saved: CheckinRecord = {
    userId: record.userId,
    name: record.name,
    ticketId: record.ticketId,
    at: record.at || new Date().toISOString(),
  };
  map[record.userId] = saved;
  write(eventId, map);
  return saved;
}

/** Check-in is offered from 3h before start until 12h after start. */
export function isCheckinWindow(startMs: number, now = Date.now()): boolean {
  if (!Number.isFinite(startMs)) return false;
  const threeHours = 3 * 60 * 60 * 1000;
  const twelveHours = 12 * 60 * 60 * 1000;
  return now >= startMs - threeHours && now <= startMs + twelveHours;
}

export function parseTicketQr(raw: string): { name?: string; event?: string; ticketId?: string } | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      event: typeof parsed.event === 'string' ? parsed.event : undefined,
      ticketId: typeof parsed.ticketId === 'string' ? parsed.ticketId : undefined,
    };
  } catch {
    return { ticketId: text };
  }
}
