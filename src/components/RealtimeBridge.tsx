import { useEffect, useState } from 'react';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { AUTH_TOKEN_EVENT, getAuthToken } from '@/lib/auth';
import { FRIENDS_CHANGED_EVENT } from '@/lib/friendsApi';
import { invalidatePrefix } from '@/lib/queryCache';
import { invalidateEvents, invalidateNotifications } from '@/lib/queries';
import { eventIdFromRealtimeRow, notifyChatMessagesChanged } from '@/lib/realtimeEvents';

/**
 * App-wide Supabase Realtime subscriptions. Mount once near the router.
 * Individual screens still opt in via `useRealtimeTable` when they need a tighter filter.
 */
export default function RealtimeBridge() {
  const [hasSession, setHasSession] = useState(() => Boolean(getAuthToken()));

  useEffect(() => {
    const sync = () => setHasSession(Boolean(getAuthToken()));
    window.addEventListener(AUTH_TOKEN_EVENT, sync);
    return () => window.removeEventListener(AUTH_TOKEN_EVENT, sync);
  }, []);

  useRealtimeTable({
    table: 'notifications',
    enabled: hasSession,
    onData: () => {
      invalidatePrefix('/api/notifications');
      invalidateNotifications();
    },
  });

  useRealtimeTable({
    table: 'friend_requests',
    enabled: hasSession,
    onData: () => {
      invalidatePrefix('/api/friends');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(FRIENDS_CHANGED_EVENT));
      }
    },
  });

  useRealtimeTable({
    table: 'messages',
    enabled: hasSession,
    onData: (payload) => {
      notifyChatMessagesChanged(eventIdFromRealtimeRow(payload));
    },
  });

  useRealtimeTable({
    table: 'events',
    enabled: hasSession,
    onData: () => {
      invalidateEvents();
    },
  });

  useRealtimeTable({
    table: 'posts',
    enabled: hasSession,
    onData: () => {
      invalidateEvents();
    },
  });

  return null;
}
