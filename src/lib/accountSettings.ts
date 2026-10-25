import { getApiUrl } from '@/lib/api';
import { getOAuthRedirectBaseUrl } from '@/lib/oauthRedirect';
import { extractCityFromLocation } from '@/lib/eventLocation';

export const NOTIFICATION_PREFS_EVENT = 'eventapp:notification-prefs-changed';
export const HOME_LOCATION_EVENT = 'eventapp:home-location-changed';

const PREFS_PREFIX = 'eventapp:notif-prefs:';
const HOME_PREFIX = 'eventapp:home-location:';

export type SignInMethod = 'google' | 'email' | 'unknown';

export type NotificationPrefKey = 'friend_requests' | 'invitations' | 'event_chat' | 'reminders';

export type NotificationPrefs = Record<NotificationPrefKey, boolean>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  friend_requests: true,
  invitations: true,
  event_chat: true,
  reminders: true,
};

export type HomeLocation = {
  name: string;
  city: string;
  lat: number;
  lng: number;
};

function storageKey(prefix: string, userId: string | undefined): string {
  return `${prefix}${userId || 'anon'}`;
}

/** Detect Google vs email from GET /api/auth/me (or similar). */
export function signInMethodFromMe(body: unknown): SignInMethod {
  if (!body || typeof body !== 'object') return 'unknown';
  const row = body as Record<string, unknown>;
  const providers: string[] = [];

  const push = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) providers.push(value.trim().toLowerCase());
  };

  push(row.provider);
  push(row.auth_provider);
  push(row.app_provider);

  const appMeta = row.app_metadata;
  if (appMeta && typeof appMeta === 'object') {
    const meta = appMeta as Record<string, unknown>;
    push(meta.provider);
    if (Array.isArray(meta.providers)) meta.providers.forEach(push);
  }

  const identities = row.identities;
  if (Array.isArray(identities)) {
    for (const item of identities) {
      if (item && typeof item === 'object') push((item as { provider?: unknown }).provider);
    }
  }

  if (providers.some((p) => p.includes('google'))) return 'google';
  if (providers.some((p) => p === 'email' || p === 'password')) return 'email';
  return 'unknown';
}

export function readNotificationPrefs(userId: string | undefined): NotificationPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_NOTIFICATION_PREFS };
  try {
    const raw = window.localStorage.getItem(storageKey(PREFS_PREFIX, userId));
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      friend_requests: parsed.friend_requests !== false,
      invitations: parsed.invitations !== false,
      event_chat: parsed.event_chat !== false,
      reminders: parsed.reminders !== false,
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

export function writeNotificationPrefs(userId: string | undefined, prefs: NotificationPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(PREFS_PREFIX, userId), JSON.stringify(prefs));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFS_EVENT));
}

/** Backend types that mean a new event-chat message. */
export function isChatNotificationType(type: string): boolean {
  const t = type.toLowerCase().trim();
  if (!t) return false;
  if (t === 'message' || t === 'new_message' || t === 'chat' || t === 'event_chat' || t === 'chat_message') return true;
  return t.includes('chat');
}

/** Whether a notification type should appear given the user's choices. Warnings always show. */
export function notificationAllowed(type: string, prefs: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS): boolean {
  const t = type.toLowerCase().trim();
  if (t === 'warning' || t.includes('warn')) return true;
  if (t === 'friend_request_accepted' || t.startsWith('friend_request')) return prefs.friend_requests;
  if (t === 'event_invitation' || t.includes('invit')) return prefs.invitations;
  if (isChatNotificationType(t)) return prefs.event_chat;
  if (t === 'reminder' || t.includes('remind')) return prefs.reminders;
  return true;
}

export function readHomeLocation(userId: string | undefined): HomeLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(HOME_PREFIX, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HomeLocation>;
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') return null;
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) return null;
    const name = typeof parsed.name === 'string' ? parsed.name : '';
    const city =
      (typeof parsed.city === 'string' && parsed.city.trim()) || extractCityFromLocation(name) || name.split(',')[0]?.trim() || '';
    if (!city) return null;
    return { name: name || city, city, lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

export function writeHomeLocation(userId: string | undefined, location: HomeLocation | null): void {
  if (typeof window === 'undefined') return;
  try {
    const key = storageKey(HOME_PREFIX, userId);
    if (!location) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(location));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(HOME_LOCATION_EVENT));
}

export function homeLocationFromSearch(name: string, lat: number, lng: number): HomeLocation {
  const city = extractCityFromLocation(name) || name.split(',')[0]?.trim() || name;
  return { name, city, lat, lng };
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const res = await fetch(getApiUrl('/api/auth/forgot-password'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      redirect_origin: getOAuthRedirectBaseUrl(),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(String((body as { detail?: unknown }).detail || 'Unable to send a reset link.'));
  }
}

export async function changeAccountPassword(
  token: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  const res = await fetch(getApiUrl('/api/auth/reset-password'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      access_token: token,
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((body as { detail?: unknown }).detail || 'Failed to update password.'));
  }
}

const DELETE_PATHS = ['/api/profile/me', '/api/auth/me', '/api/account'];

export async function deleteAccount(token: string): Promise<void> {
  let lastError = 'Could not delete this account.';
  for (const path of DELETE_PATHS) {
    const res = await fetch(getApiUrl(path), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (res.ok || res.status === 204) return;
    const body = await res.json().catch(() => ({}));
    const detail = (body as { detail?: unknown; message?: unknown }).detail ?? (body as { message?: unknown }).message;
    if (typeof detail === 'string' && detail.trim()) lastError = detail;
    if (res.status !== 404 && res.status !== 405) throw new Error(lastError);
  }
  throw new Error(lastError);
}

export function mapStartView(userId: string | undefined): { center: [number, number]; zoom: number } {
  const home = readHomeLocation(userId);
  if (home) return { center: [home.lat, home.lng], zoom: 12 };
  return { center: [40.7128, -74.006], zoom: 3 };
}
