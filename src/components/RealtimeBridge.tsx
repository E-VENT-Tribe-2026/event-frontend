import { useEffect, useState } from 'react';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { AUTH_TOKEN_EVENT, getAuthToken } from '@/lib/auth';
import { noteIncomingChatMessage } from '@/lib/chatUnread';
import { FRIENDS_CHANGED_EVENT } from '@/lib/friendsApi';
import { invalidatePrefix } from '@/lib/queryCache';
import { invalidateEvents, invalidateNotifications } from '@/lib/queries';
import { eventIdFromRealtimeRow, notifyChatMessagesChanged } from '@/lib/realtimeEvents';
import { getCurrentUser } from '@/lib/storage';
import { SUPABASE_REALTIME_AUTH_EVENT, syncSupabaseSession } from '@/lib/supabase';

/**
 * App-wide Supabase Realtime subscriptions. Mount once near the router.
 * Individual screens still opt in via `useRealtimeTable` when they need a tighter filter.
 */
export default function RealtimeBridge() {
  const [hasSession, setHasSession] = useState(() => Boolean(getAuthToken()));
  const [realtimeReady, setRealtimeReady] = useState(false);

  useEffect(() => {
    const sync = () => setHasSession(Boolean(getAuthToken()));
    window.addEventListener(AUTH_TOKEN_EVENT, sync);
    return () => window.removeEventListener(AUTH_TOKEN_EVENT, sync);
  }, []);

  // Attach the FastAPI JWT before postgres_changes subscriptions, then resubscribe.
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setRealtimeReady(false);
      return;
    }
    let cancelled = false;
    const markReady = () => {
      if (!cancelled) setRealtimeReady(true);
    };
    void syncSupabaseSession(token).finally(markReady);
    window.addEventListener(SUPABASE_REALTIME_AUTH_EVENT, markReady);
    window.addEventListener(AUTH_TOKEN_EVENT, markReady);
    return () => {
      cancelled = true;
      window.removeEventListener(SUPABASE_REALTIME_AUTH_EVENT, markReady);
      window.removeEventListener(AUTH_TOKEN_EVENT, markReady);
    };
  }, [hasSession]);

  const live = hasSession && realtimeReady;

  useRealtimeTable({
    table: 'notifications',
    enabled: live,
    onData: () => {
      invalidatePrefix('/api/notifications');
      invalidateNotifications();
    },
  });

  useRealtimeTable({
    table: 'friend_requests',
    enabled: live,
    onData: () => {
      invalidatePrefix('/api/friends');
      invalidatePrefix('/api/notifications');
      invalidateNotifications();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(FRIENDS_CHANGED_EVENT));
      }
    },
  });

  useRealtimeTable({
    table: 'messages',
    enabled: live,
    onData: (payload) => {
      const eventId = eventIdFromRealtimeRow(payload);
      const row =
        payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old ?? {};
      const senderRaw = row.sender_id ?? row.user_id;
      const senderId = senderRaw == null || senderRaw === '' ? null : String(senderRaw);
      noteIncomingChatMessage(getCurrentUser()?.id, eventId, senderId);
      invalidatePrefix('/api/chats');
      notifyChatMessagesChanged(eventId, row);
    },
  });

  useRealtimeTable({
    table: 'events',
    enabled: live,
    onData: () => {
      invalidateEvents();
    },
  });

  useRealtimeTable({
    table: 'posts',
    enabled: live,
    onData: () => {
      invalidateEvents();
    },
  });

  useRealtimeTable({
    table: 'participants',
    enabled: live,
    onData: () => {
      invalidateEvents();
    },
  });

  return null;
}
