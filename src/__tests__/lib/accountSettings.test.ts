import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFS,
  deleteAccount,
  homeLocationFromSearch,
  isChatNotificationType,
  mapStartView,
  notificationAllowed,
  readHomeLocation,
  readNotificationPrefs,
  signInMethodFromMe,
  writeHomeLocation,
  writeNotificationPrefs,
} from '@/lib/accountSettings';

describe('signInMethodFromMe', () => {
  it('detects Google from identities', () => {
    expect(signInMethodFromMe({ identities: [{ provider: 'google' }] })).toBe('google');
  });

  it('detects email from app_metadata', () => {
    expect(signInMethodFromMe({ app_metadata: { provider: 'email', providers: ['email'] } })).toBe('email');
  });

  it('returns unknown when the payload is empty', () => {
    expect(signInMethodFromMe({})).toBe('unknown');
  });
});

describe('notificationAllowed', () => {
  const off = { ...DEFAULT_NOTIFICATION_PREFS, friend_requests: false, invitations: false, event_chat: false, reminders: false };

  it('always shows warnings', () => {
    expect(notificationAllowed('warning', off)).toBe(true);
  });

  it('hides opted-out kinds', () => {
    expect(notificationAllowed('friend_request_received', off)).toBe(false);
    expect(notificationAllowed('event_invitation', off)).toBe(false);
    expect(notificationAllowed('invitation', off)).toBe(false);
    expect(notificationAllowed('event_chat', off)).toBe(false);
    expect(notificationAllowed('chat_message', off)).toBe(false);
    expect(notificationAllowed('reminder', off)).toBe(false);
    expect(notificationAllowed('event_updated', off)).toBe(true);
  });

  it('treats chat_message and event_chat as chat types, not generic updates', () => {
    expect(isChatNotificationType('chat_message')).toBe(true);
    expect(isChatNotificationType('event_chat')).toBe(true);
    expect(isChatNotificationType('event_updated')).toBe(false);
  });
});

describe('home location and prefs storage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('round-trips notification prefs per user', () => {
    writeNotificationPrefs('u-a', { ...DEFAULT_NOTIFICATION_PREFS, invitations: false });
    expect(readNotificationPrefs('u-a').invitations).toBe(false);
    expect(readNotificationPrefs('u-b').invitations).toBe(true);
  });

  it('stores a searchable home city and map start', () => {
    const loc = homeLocationFromSearch('Kreuzberg, Berlin, Germany', 52.5, 13.4);
    writeHomeLocation('u-a', loc);
    expect(readHomeLocation('u-a')?.city).toBeTruthy();
    expect(mapStartView('u-a')).toEqual({ center: [52.5, 13.4], zoom: 12 });
    expect(mapStartView('nobody')).toEqual({ center: [40.7128, -74.006], zoom: 3 });
  });
});

describe('deleteAccount', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('succeeds on the first supported DELETE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes('/api/profile/me') && init?.method === 'DELETE') {
          return new Response(null, { status: 204 });
        }
        return new Response('{}', { status: 404 });
      }),
    );
    await expect(deleteAccount('tok')).resolves.toBeUndefined();
  });

  it('skips 404/405 and uses a later path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/profile/me')) return new Response('{}', { status: 404 });
        if (url.includes('/api/auth/me')) return new Response('{}', { status: 405 });
        if (url.includes('/api/account') && init?.method === 'DELETE') {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response('{}', { status: 500 });
      }),
    );
    await expect(deleteAccount('tok')).resolves.toBeUndefined();
  });
});
