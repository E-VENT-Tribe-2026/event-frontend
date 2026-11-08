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

  it('DELETEs /api/auth/account with the session token and no body', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(deleteAccount('tok')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/account'),
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    );
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('body');
  });

  it('explains a 403 for administrators', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ detail: 'Forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })),
    );
    await expect(deleteAccount('tok')).rejects.toThrow('Forbidden');
  });

  it('keeps a 503 retryable after event updates succeed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } })),
    );
    await expect(deleteAccount('tok')).rejects.toThrow(/Try again/);
  });
});

