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
    location: (api.location_name as string) ?? '',
    lat: parseCoord(api.latitude),
    lng: parseCoord(api.longitude),
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
