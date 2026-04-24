import type { EventItem } from '@/lib/storage';
import { getGeneratedAvatarUrl, pickImageUrl } from '@/lib/avatars';

export const DEFAULT_EVENT_IMAGE =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80';

/** Map backend event row to frontend EventItem */
export function mapApiEventToItem(api: Record<string, unknown>): EventItem {
  const start = api.start_datetime ? new Date(api.start_datetime as string) : new Date();
  const dateStr = start.toISOString().slice(0, 10);
  const timeStr = start.toTimeString().slice(0, 5);
  const cost = Number(api.cost);
  const capacity = Number(api.max_capacity);
  const rawCreator = api.created_by ?? api.createdBy;
  const createdBy =
    rawCreator != null && String(rawCreator).trim() !== '' ? String(rawCreator).trim() : '';

  const profiles = api.profiles as Record<string, unknown> | undefined;
  let organizerNameFromProfile = '';
  let organizerPhoto = '';
  if (profiles && typeof profiles === 'object') {
    if (typeof profiles.full_name === 'string') organizerNameFromProfile = profiles.full_name;
    if (typeof profiles.avatar_url === 'string') organizerPhoto = profiles.avatar_url;
  }
  const organizerFlat = typeof api.organizer_name === 'string' ? api.organizer_name : '';
  const organizerName = organizerNameFromProfile || organizerFlat;
  const avatarSeed = createdBy || organizerName || (api.title as string) || 'organizer';
  const organizerAvatar =
    pickImageUrl(organizerPhoto) ?? getGeneratedAvatarUrl(avatarSeed);

  return {
    id: (api.id as string) ?? '',
    title: (api.title as string) ?? '',
    description: (api.description as string) ?? '',
    category: (api.category as string) ?? 'Other',
    date: dateStr,
    time: timeStr,
    location: (api.location_name as string) ?? '',
    lat: typeof api.latitude === 'number' ? api.latitude : 0,
    lng: typeof api.longitude === 'number' ? api.longitude : 0,
    budget: Number.isFinite(cost) ? cost : 0,
    participantsLimit: Number.isFinite(capacity) ? capacity : 0,
    participants: [],
    image: DEFAULT_EVENT_IMAGE,
    organizer: organizerName,
    organizerId: createdBy,
    organizerAvatar,
    isPrivate: false,
    isDraft: false,
    requiresApproval: false,
    reviews: [],
    reports: [],
    collaborators: [],
  };
}

/** Normalize list from GET /api/events (wrapped or raw array). */
export function parseEventsApiList(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== 'object') return [];
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.data)) return b.data as Record<string, unknown>[];
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  return [];
}

export function apiRowCreatedBy(row: Record<string, unknown>): string {
  const v = row.created_by ?? row.createdBy;
  return typeof v === 'string' ? v : '';
}
