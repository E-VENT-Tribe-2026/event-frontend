import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import RealtimeBridge from '@/components/RealtimeBridge';
import { FRIENDS_CHANGED_EVENT } from '@/lib/friendsApi';
import { CHAT_MESSAGES_CHANGED_EVENT } from '@/lib/realtimeEvents';
import { setAuthToken } from '@/lib/auth';

const { invalidateNotificationsMock, invalidateEventsMock } = vi.hoisted(() => ({
  invalidateNotificationsMock: vi.fn(),
  invalidateEventsMock: vi.fn(),
}));

const handlers: Array<{ table: string; onData: (payload: unknown) => void }> = [];

vi.mock('@/hooks/useRealtimeTable', () => ({
  useRealtimeTable: (opts: { table: string; enabled?: boolean; onData: (payload: unknown) => void }) => {
    if (opts.enabled === false) return;
    handlers.push({ table: opts.table, onData: opts.onData });
  },
}));

vi.mock('@/lib/queries', () => ({
  invalidateNotifications: () => invalidateNotificationsMock(),
  invalidateEvents: () => invalidateEventsMock(),
}));

describe('RealtimeBridge', () => {
  beforeEach(() => {
    handlers.length = 0;
    invalidateNotificationsMock.mockClear();
    invalidateEventsMock.mockClear();
    setAuthToken('bridge-token');
  });

  it('refreshes notifications, friends, chat, and events from table changes', () => {
    const chatChanged = vi.fn();
    const friendsChanged = vi.fn();
    window.addEventListener(CHAT_MESSAGES_CHANGED_EVENT, chatChanged);
    window.addEventListener(FRIENDS_CHANGED_EVENT, friendsChanged);

    render(<RealtimeBridge />);

    const tables = handlers.map((h) => h.table);
    expect(tables).toEqual(expect.arrayContaining(['notifications', 'friend_requests', 'messages', 'events', 'posts']));

    handlers.find((h) => h.table === 'notifications')?.onData({});
    handlers.find((h) => h.table === 'friend_requests')?.onData({});
    handlers.find((h) => h.table === 'messages')?.onData({ new: { event_id: 'evt-9' } });
    handlers.find((h) => h.table === 'events')?.onData({});

    expect(invalidateNotificationsMock).toHaveBeenCalled();
    expect(friendsChanged).toHaveBeenCalled();
    expect(chatChanged).toHaveBeenCalled();
    expect(invalidateEventsMock).toHaveBeenCalled();

    window.removeEventListener(CHAT_MESSAGES_CHANGED_EVENT, chatChanged);
    window.removeEventListener(FRIENDS_CHANGED_EVENT, friendsChanged);
  });
});
