import type { EventItem } from '@/lib/storage';
import { getGeneratedAvatarUrl, pickImageUrl } from '@/lib/avatars';
import { eventBannerFrom } from '@/lib/eventBanner';
import { localDateTimeParts } from '@/lib/eventTime';

/** @deprecated Use getCategoryBanner() for category-aware defaults. */
export const DEFAULT_EVENT_IMAGE =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80';

function parseEventStart(raw: unknown): Date {
  if (typeof raw !== 'string' || !raw.trim()) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nestedRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function parseCoord(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function firstCoord(...values: unknown[]): number {
  for (const value of values) {
    const n = parseCoord(value);
    if (n !== 0) return n;
    if (typeof value === 'number' && value === 0) return 0;
  }
  return 0;
}

function namedCoords(row: Record<string, unknown>): { lat: number; lng: number } {
  return {
    lat: firstCoord(row.latitude, row.lat, row.y),
    lng: firstCoord(row.longitude, row.lng, row.lon, row.x),
  };
}

/** GeoJSON Position is [longitude, latitude]. */
function geoJsonPosition(value: unknown): { lat: number; lng: number } | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lng = parseCoord(value[0]);
  const lat = parseCoord(value[1]);
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function coordsFromUnknown(value: unknown): { lat: number; lng: number } | null {
  const fromArray = geoJsonPosition(value);
  if (fromArray) return fromArray;
  if (typeof value === 'string' && value.trim()) {
    const wkt = value.match(/POINT\s*\(\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s*\)/i);
    if (wkt) {
      const lng = parseCoord(wkt[1]);
      const lat = parseCoord(wkt[2]);
      if (lat !== 0 || lng !== 0) return { lat, lng };
    }
  }
  const rec = nestedRecord(value);
  if (!rec) return null;
  const named = namedCoords(rec);
  if (named.lat !== 0 || named.lng !== 0) return named;
  return (
    geoJsonPosition(rec.coordinates) ??
    coordsFromUnknown(rec.geometry) ??
    coordsFromUnknown(rec.location) ??
    coordsFromUnknown(rec.geo) ??
    coordsFromUnknown(rec.point)
  );
}

function coordsFromRow(row: Record<string, unknown>): { lat: number; lng: number } {
  const named = namedCoords(row);
  if (named.lat !== 0 || named.lng !== 0) return named;
  return (
    coordsFromUnknown(row.location) ??
    coordsFromUnknown(row.geo) ??
    coordsFromUnknown(row.point) ??
    coordsFromUnknown(row.geometry) ??
    coordsFromUnknown(row.coordinates) ?? { lat: 0, lng: 0 }
  );
}

/** latitude/longitude, lat/lng, nested location, or GeoJSON [lng, lat]. */
export function readEventCoordinates(
  row: Record<string, unknown> | null | undefined,
  depth = 0,
): {
  lat: number;
  lng: number;
} {
  if (!row || depth > 3) return { lat: 0, lng: 0 };
  const fromRow = coordsFromRow(row);
  if (fromRow.lat !== 0 || fromRow.lng !== 0) return fromRow;
  for (const key of ['data', 'event', 'item'] as const) {
    const nested = nestedRecord(row[key]);
    if (!nested) continue;
    const fromNested = readEventCoordinates(nested, depth + 1);
    if (fromNested.lat !== 0 || fromNested.lng !== 0) return fromNested;
  }
  return fromRow;
}

/** The backend sends friends_attending_count with each event; anything else counts as 0. */
export function friendsAttendingCountFrom(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Map backend event row to frontend EventItem */
export function mapApiEventToItem(api: Record<string, unknown>): EventItem {
  const start = parseEventStart(api.start_datetime);
  const { date: dateStr, time: timeStr } = localDateTimeParts(start);
  const cost = Number(api.cost);
  const capacity = Number(api.max_capacity);
  const organizer = nestedRecord(api.organizer);
  const profiles = nestedRecord(api.profiles);

  const rawCreator = api.created_by ?? api.createdBy ?? organizer?.id;
  const createdBy =
    rawCreator != null && String(rawCreator).trim() !== '' ? String(rawCreator).trim() : '';

  const organizerFullName =
    text(api.organizer_name) ||
    text(organizer?.full_name) ||
    text(organizer?.display_name) ||
    text(profiles?.full_name);

  const organizerUsername =
    text(api.organizer_username) ||
    text(organizer?.username) ||
    text(profiles?.username);

  const organizerPhoto =
    text(api.organizer_avatar) ||
    text(organizer?.avatar_url) ||
    text(profiles?.avatar_url);

  const organizerName = organizerFullName || organizerUsername;
  const avatarSeed =
    text(organizer?.icon_id) || createdBy || organizerName || (api.title as string) || 'organizer';
  const organizerAvatar =
    pickImageUrl(organizerPhoto) ?? getGeneratedAvatarUrl(avatarSeed);

  const rawStatus = typeof api.status === 'string' ? api.status : undefined;
  const isCancelled = rawStatus
    ? rawStatus.toLowerCase() === 'cancelled' || rawStatus.toLowerCase() === 'canceled'
    : Boolean(api.isCancelled);

  return {
    id: (api.id as string) ?? '',
    title: (api.title as string) ?? '',
    description: (api.description as string) ?? '',
    category: (api.category as string) ?? 'Other',
    date: dateStr,
    time: timeStr,
    location:
      (typeof api.location_name === 'string' && api.location_name) ||
      (typeof api.location === 'string' ? api.location : '') ||
      '',
    lat: readEventCoordinates(api).lat,
    lng: readEventCoordinates(api).lng,
    budget: Number.isFinite(cost) ? cost : 0,
    participantsLimit: Number.isFinite(capacity) ? capacity : 0,
    participants: [],
    image: eventBannerFrom(api, api.category as string | undefined),
    organizer: organizerName,
    organizerId: createdBy,
    organizerAvatar,
    organizerUsername: organizerUsername || undefined,
    organizerFullName: organizerFullName || undefined,
    status: rawStatus,
    isCancelled,
    friendsAttendingCount: friendsAttendingCountFrom(api.friends_attending_count),
    isPrivate: false,
    isDraft: false,
    requiresApproval: false,
    reviews: [],
    reports: [],
    collaborators: [],
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function looksLikeEvent(row: Record<string, unknown>): boolean {
  return Boolean(row.id || row.title || row.start_datetime);
}

/** Unwrap a GET /api/participants/my/events row (`events`, `event`, or the event itself). */
export function nestedEventFromParticipantRow(row: unknown): Record<string, unknown> | null {
  const rec = asRecord(row);
  if (!rec) return null;
  for (const key of ['events', 'event', 'item']) {
    const nested = asRecord(rec[key]);
    if (nested && looksLikeEvent(nested)) return nested;
  }
  return looksLikeEvent(rec) ? rec : null;
}

/** Normalize list from GET /api/events (wrapped or raw array). */
export function parseEventsApiList(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  const b = asRecord(body);
  if (!b) return [];
  for (const key of ['data', 'events', 'items', 'results', 'participants']) {
    if (Array.isArray(b[key])) return b[key] as Record<string, unknown>[];
  }
  return [];
}

const MY_EVENT_BUCKETS = [
  'data',
  'events',
  'items',
  'results',
  'upcoming',
  'past',
  'cancelled',
  'organized',
  'joined',
  'created',
] as const;

/** GET /api/events/my-events: a flat list, or upcoming/past/organized buckets. */
export function parseMyEventsApiList(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) {
    const rows: Record<string, unknown>[] = [];
    for (const row of body) {
      const rec = asRecord(row);
      if (rec && looksLikeEvent(rec)) rows.push(rec);
    }
    return rows;
  }
  const rec = asRecord(body);
  if (!rec) return [];
  const direct = parseEventsApiList(body).filter((row) => looksLikeEvent(row));
  if (direct.length) return direct;
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const key of MY_EVENT_BUCKETS) {
    if (!(key in rec)) continue;
    for (const row of parseMyEventsApiList(rec[key])) {
      const id = String(row.id || '').trim();
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      out.push(row);
    }
  }
  return out;
}

/** Normalize GET /api/participants/my/events into event records. */
export function parseJoinedEventsApiList(body: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const row of parseEventsApiList(body)) {
    const event = nestedEventFromParticipantRow(row);
    if (!event) continue;
    const id = String(event.id || '').trim();
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(event);
  }
  return out;
}

export function apiRowCreatedBy(row: Record<string, unknown>): string {
  const v = row.created_by ?? row.createdBy;
  return typeof v === 'string' ? v : '';
}
