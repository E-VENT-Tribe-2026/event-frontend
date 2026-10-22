import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Smile, AlertTriangle, Calendar, Clock, Ban, ListChecks, MapPinned } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentUser } from '@/lib/storage';
import BottomNav from '@/components/BottomNav';
import TopBar from '@/components/TopBar';
import { UserAvatar } from '@/components/UserAvatar';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import AppToast from '@/components/AppToast';
import { mapApiEventToItem } from '@/lib/mapApiEvent';
import { fetchAuthUserFromToken, sameAuthUserId } from '@/lib/authProfile';
import { isEventUpcoming } from '@/lib/eventTime';
import { userProfilePath } from '@/lib/friendsApi';
import { cachedFetch, invalidate, peekCache, setCacheEntry, TTL } from '@/lib/queryCache';
import { chatLiveHoldUntil, publishLiveChatMessage, useChatLiveChannels } from '@/lib/chatLive';
import { CHAT_MESSAGES_CHANGED_EVENT, eventIdFromRealtimeRow } from '@/lib/realtimeEvents';
import {
  CHAT_UNREAD_CHANGED_EVENT,
  isChatUnread,
  markChatRead,
  noteIncomingChatMessage,
  noteNewerChatMessage,
  rememberSeen,
  setViewingChatId,
} from '@/lib/chatUnread';
import EventPollCard from '@/components/EventPollCard';
import { addCheckin, isCheckedIn } from '@/lib/checkin';
import {
  chatMessagesPath,
  encodeChatPayload,
  parseChatPayload,
} from '@/lib/chatPayload';

type ChatEvent = {
  id: string;
  name: string;
  avatar: string;
  lastMsg: string;
  time: string;
  unread: number;
  isPast: boolean;
  isCancelled?: boolean;
  eventDate: string;
  organizerId: string;
};

type ChatMessage = {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
  dateKey: string;
  kind?: 'user' | 'system';
  messageType?: 'text' | 'file' | 'voice' | 'notification' | 'poll' | 'poll_vote' | 'checkin';
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
  senderName?: string;
  senderAvatar?: string;
  senderId?: string;
  pollId?: string;
  question?: string;
  options?: string[];
  optionIndex?: number;
  liveUntil?: number;
};

export const CHAT_OPEN_POLL_MS = 1000;
export const CHAT_LIST_POLL_MS = 4000;
export const CHAT_LIVE_POLL_MS = CHAT_OPEN_POLL_MS;

const LOCAL_MESSAGE_PREFIX = 'local:';

function isLocalChatMessage(id: string) {
  return id.startsWith(LOCAL_MESSAGE_PREFIX);
}

function sameLiveMessage(a: ChatMessage, b: ChatMessage): boolean {
  return a.from === b.from && a.text === b.text && a.messageType === b.messageType;
}

/** Keep optimistic / just-broadcast rows while the GET is still a beat behind. */
function mergeLiveMessages(server: ChatMessage[], prev: ChatMessage[]): ChatMessage[] {
  const now = Date.now();
  const extras = prev.filter((local) => {
    if (server.some((row) => row.id === local.id || sameLiveMessage(row, local))) return false;
    if (isLocalChatMessage(local.id)) return true;
    return Boolean(local.liveUntil && local.liveUntil > now);
  });
  return extras.length ? [...server, ...extras] : server;
}

function messageFieldsFromPostBody(
  body: unknown,
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  if (!body || typeof body !== 'object') return fallback;
  const row = body as Record<string, unknown>;
  if (Array.isArray(row.data) && row.data[0] && typeof row.data[0] === 'object') {
    return { ...fallback, ...(row.data[0] as Record<string, unknown>) };
  }
  if (row.id != null || row.content != null || row.sender_id != null) {
    return { ...fallback, ...row, content: fallback.content };
  }
  return fallback;
}

function messageRowId(row: Record<string, unknown>): string {
  if (row.id != null && String(row.id).trim()) return String(row.id);
  const sender = row.sender_id || row.user_id || row.created_by || '';
  const at = row.created_at || row.sent_at || row.timestamp || '';
  const content = row.content || row.message || row.text || '';
  return `${sender}:${at}:${String(content).slice(0, 48)}`;
}

function sameVisibleMessages(prev: ChatMessage[], next: ChatMessage[]): boolean {
  if (prev.length !== next.length) return false;
  return prev.every((m, i) => m.id === next[i].id && m.text === next[i].text && m.from === next[i].from);
}

function isNearBottom(el: HTMLElement, threshold = 96): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

function latestMessageMeta(
  rows: Record<string, unknown>[],
): { createdAt: string; senderId: string | null; messageId: string } | null {
  let latest: { createdAt: string; senderId: string | null; messageId: string } | null = null;
  for (const row of rows) {
    const raw = row.created_at || row.sent_at || row.timestamp;
    if (!raw) continue;
    const createdAt = new Date(String(raw)).toISOString();
    if (Number.isNaN(Date.parse(createdAt))) continue;
    if (!latest || createdAt > latest.createdAt) {
      const sender = row.sender_id || row.user_id || row.created_by;
      latest = {
        createdAt,
        senderId: sender == null || sender === '' ? null : String(sender),
        messageId: messageRowId(row),
      };
    }
  }
  return latest;
}

function isExpiredOver48h(eventDate: string): boolean {
  if (!eventDate) return false;
  const normalized = /[Zz]|[+-]\d{2}:\d{2}$/.test(eventDate) ? eventDate : `${eventDate}T00:00:00Z`;
  const ts = new Date(normalized).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > 48 * 60 * 60 * 1000;
}

function formatDateSeparator(dateKey: string): string {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  if (dateKey === todayKey) return 'Today';
  if (dateKey === yesterdayKey) return 'Yesterday';

  const d = new Date(dateKey);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Cache key for one user's saved copy of one event chat's messages. */
function chatMessagesCacheKey(eventId: string, userId: string) {
  return `${chatMessagesPath(eventId)}:${userId}`;
}

/** Thrown inside a cached fetcher so a failed response is never stored in the cache. */
class ChatHttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`Chat request failed with status ${status}`);
    this.status = status;
  }
}

export default function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const token = getAuthToken();
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [chatListLoading, setChatListLoading] = useState(true);
  const [chats, setChats] = useState<ChatEvent[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [chatUnavailable, setChatUnavailable] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as 'error' | 'success' });
  const [selectedEventFromUrl] = useState(() => new URLSearchParams(location.search).get('eventId'));
  const [handledSelectedParam, setHandledSelectedParam] = useState(false);
  const [chatApiMissing, setChatApiMissing] = useState(false);
  const [chatTab, setChatTab] = useState<'active' | 'past' | 'cancelled'>('active');
  const [search, setSearch] = useState('');
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pinToBottomRef = useRef(true);
  // Only the newest loadMessages call may update the screen, so a slow response
  // for a chat you already left cannot overwrite the chat you are looking at.
  const messagesRequestRef = useRef(0);
  const activeChatRef = useRef<string | null>(null);
  const chatsRef = useRef<ChatEvent[]>([]);
  const loadMessagesRef = useRef<(eventId: string, silent?: boolean) => Promise<void>>(async () => {});
  const loadChatListRef = useRef<(silent?: boolean) => Promise<void>>(async () => {});
  activeChatRef.current = activeChat;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = getAuthToken();
      if (!t) { if (!cancelled) setAuthUserId(null); return; }
      const me = await fetchAuthUserFromToken(t);
      if (!cancelled) setAuthUserId(me?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [token, user?.id]);

  useEffect(() => {
    if (!activeChat || chatListLoading) return;
    if (chats.some((entry) => entry.id === activeChat)) return;
    setActiveChat(null);
  }, [activeChat, chats, chatListLoading]);

  useEffect(() => {
    pinToBottomRef.current = true;
  }, [activeChat]);

  useEffect(() => {
    if (!pinToBottomRef.current || messagesLoading) return;
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
      return;
    }
    const el = messagesEndRef.current;
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [messages, messagesLoading, activeChat]);

  const liveEventIds = chats.map((c) => c.id);
  if (activeChat && !liveEventIds.includes(activeChat)) liveEventIds.push(activeChat);
  useChatLiveChannels(liveEventIds);

  if (!user) return <Navigate to="/login" replace />;

  const resolveMeId = () => authUserId || user.id;

  const mapMessageRow = useCallback(
    (row: Record<string, unknown>): ChatMessage | null => {
      const rawContent = String(row.content || row.message || row.text || '').trim();
      const parsed = rawContent ? parseChatPayload(rawContent) : null;
      const text = parsed
        ? String(
            parsed.text ||
              parsed.question ||
              (parsed.type === 'voice'
                ? 'Voice message'
                : parsed.type === 'poll_vote'
                  ? `vote:${parsed.optionIndex ?? 0}`
                  : parsed.type === 'checkin'
                    ? 'is here'
                    : parsed.fileName || 'Attachment'),
          )
        : rawContent;
      if (!text && parsed?.type !== 'poll') return null;
      const senderId = String(row.sender_id || row.user_id || row.created_by || '');
      const sentAtRaw = row.created_at || row.sent_at || row.timestamp;
      const sentAt = sentAtRaw ? new Date(String(sentAtRaw)) : new Date();
      const rawType = String(row.type || row.message_type || row.kind || '').toLowerCase();
      const isCheckin = parsed?.type === 'checkin';
      const isSystem =
        isCheckin ||
        Boolean(row.is_system) ||
        rawType === 'system' || rawType === 'notification' ||
        rawType === 'join' || rawType === 'leave' ||
        rawType === 'participant_joined' || rawType === 'participant_left' ||
        /\b(joined|left|was (added|removed|kicked)|has (joined|left)|added .+ to the chat|removed .+ from|is now (an admin|a member)|chat history|created (this|the) (group|chat)|changed the (subject|icon|description))\b/i.test(text);
      const meId = resolveMeId();
      const isMe = !isSystem && Boolean(senderId) &&
        (sameAuthUserId(senderId, meId) || sameAuthUserId(senderId, user.id));

      const profiles = row.profiles as Record<string, unknown> | undefined;
      const senderObj = row.sender as Record<string, unknown> | undefined;
      const senderName =
        String(profiles?.full_name || senderObj?.full_name || senderObj?.name || row.sender_name || '').trim() || undefined;
      const senderAvatar =
        String(profiles?.avatar_url || senderObj?.avatar_url || senderObj?.avatar || row.sender_avatar || '').trim() || undefined;

      return {
        id: messageRowId(row),
        from: isMe ? 'me' : 'them',
        text: isCheckin ? `${senderName || 'Someone'} is here` : text,
        time: sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateKey: sentAt.toISOString().slice(0, 10),
        kind: isSystem ? 'system' : 'user',
        messageType: parsed?.type || 'text',
        fileName: parsed?.fileName,
        mimeType: parsed?.mimeType,
        dataUrl: parsed?.dataUrl,
        senderName,
        senderAvatar,
        senderId: senderId || undefined,
        pollId: parsed?.pollId,
        question: parsed?.question,
        options: parsed?.options,
        optionIndex: parsed?.optionIndex,
      };
    },
    [authUserId, user.id],
  );

  const mapMessageRowRef = useRef(mapMessageRow);
  useEffect(() => { mapMessageRowRef.current = mapMessageRow; }, [mapMessageRow]);

  useEffect(() => {
    if (!activeChat) return;
    for (const m of messages) {
      if (m.messageType === 'checkin' && m.senderId && !isCheckedIn(activeChat, m.senderId)) {
        addCheckin(activeChat, { userId: m.senderId, name: m.senderName || 'Someone' });
      }
    }
  }, [messages, activeChat]);

  const activeChatObj = chats.find((entry) => entry.id === activeChat) || null;
  chatsRef.current = chats;

  const loadChatList = useCallback(async (silent = false) => {
    if (!token) { if (!silent) setChatListLoading(false); return; }
    if (!silent && chatsRef.current.length === 0) setChatListLoading(true);
    try {
      // Cached for 30 s (TTL.SHORT): a joined or created event shows up quickly,
      // and a failed request throws so it is never stored.
      const [joinedBody, organizedBody] = await Promise.all([
        cachedFetch(
          `/api/participants/my/events:chat:${user.id}`,
          async () => {
            const res = await fetch(getApiUrl('/api/participants/my/events'), { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new ChatHttpError(res.status);
            return res.json(); // an unreadable body rejects, so it is not stored
          },
          TTL.SHORT,
        ).catch(() => []),
        cachedFetch(
          `/api/events/my-events:chat:${user.id}`,
          async () => {
            const res = await fetch(getApiUrl('/api/events/my-events'), { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new ChatHttpError(res.status);
            return res.json(); // an unreadable body rejects, so it is not stored
          },
          TTL.SHORT,
        ).catch(() => ({})),
      ]);
      const joinedRows = Array.isArray(joinedBody)
        ? joinedBody
        : Array.isArray(joinedBody?.data)
          ? joinedBody.data
          : [];
      const organizedRows = Array.isArray(organizedBody?.data)
        ? organizedBody.data
        : Array.isArray(organizedBody)
          ? organizedBody
          : [];
      const joinedEvents = joinedRows
        .map((row: Record<string, unknown>) => (row?.events || row) as Record<string, unknown>)
        .filter((row) => row && (row.id || row.title));
      const allEvents = [...joinedEvents, ...organizedRows];

      const byId = new Map<string, ChatEvent>();
      allEvents
        .filter(Boolean)
        .forEach((rawEvt) => {
          const evt = mapApiEventToItem(rawEvt as Record<string, unknown>);
          const rawStatus = String((rawEvt as Record<string, unknown>).status || evt.status || '').toLowerCase();
          const isCancelled = evt.isCancelled || rawStatus === 'cancelled' || rawStatus === 'canceled';
          byId.set(evt.id, {
            id: evt.id,
            name: evt.title,
            avatar: evt.image,
            lastMsg: 'Open conversation',
            time: evt.time || '',
            unread: isChatUnread(user.id, evt.id) ? 1 : 0,
            isPast: !isEventUpcoming(evt),
            isCancelled,
            eventDate: evt.date || '',
            organizerId: evt.organizerId || '',
          });
        });

      const mapped = Array.from(byId.values());
      setChats(mapped);

      const openId = activeChatRef.current;
      if (!silent && openId && mapped.length > 0 && !mapped.some((entry) => entry.id === openId)) {
        setActiveChat(null);
        setChatUnavailable(true);
        setMessages([]);
        setToast({ show: true, message: 'Chat is no longer available for this event.', type: 'error' });
      }

      if (selectedEventFromUrl && !handledSelectedParam) {
        if (mapped.some((entry) => entry.id === selectedEventFromUrl)) {
          setActiveChat(selectedEventFromUrl);
        } else {
          try {
            const singleRes = await fetch(getApiUrl(`/api/events/${selectedEventFromUrl}`), {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (singleRes.ok) {
              const singleData = await singleRes.json();
              const singleItem = mapApiEventToItem(singleData);
              const rawSt = String(singleData.status || singleItem.status || '').toLowerCase();
              const isCanc = singleItem.isCancelled || rawSt === 'cancelled' || rawSt === 'canceled';
              const newChat: ChatEvent = {
                id: singleItem.id,
                name: singleItem.title,
                avatar: singleItem.image,
                lastMsg: 'Open conversation',
                time: singleItem.time || '',
                unread: isChatUnread(user.id, singleItem.id) ? 1 : 0,
                isPast: !isEventUpcoming(singleItem),
                isCancelled: isCanc,
                eventDate: singleItem.date || '',
                organizerId: singleItem.organizerId || '',
              };
              setChats((prev) => [newChat, ...prev.filter((c) => c.id !== newChat.id)]);
              setActiveChat(selectedEventFromUrl);
            } else {
              setToast({ show: true, message: 'You no longer have access to this event chat.', type: 'error' });
              navigate('/chat', { replace: true });
            }
          } catch {
            setToast({ show: true, message: 'You no longer have access to this event chat.', type: 'error' });
            navigate('/chat', { replace: true });
          }
        }
        setHandledSelectedParam(true);
      }
    } catch {
      if (!silent && chatsRef.current.length === 0) setChats([]);
    } finally {
      if (!silent) setChatListLoading(false);
    }
  }, [token, user.id, selectedEventFromUrl, handledSelectedParam, navigate]);

  loadChatListRef.current = loadChatList;
  useEffect(() => { void loadChatList(); }, [loadChatList]);

  const normalizeMessageList = (body: unknown): Record<string, unknown>[] => {
    if (!body || typeof body !== 'object') return [];
    const b = body as Record<string, unknown>;
    if (Array.isArray(b.data)) return b.data as Record<string, unknown>[];
    if (Array.isArray(body)) return body as Record<string, unknown>[];
    return [];
  };

  const loadMessages = useCallback(
    async (eventId: string, silent = false) => {
      if (!token) return;
      const requestId = ++messagesRequestRef.current;
      const isCurrent = () => requestId === messagesRequestRef.current;
      const cacheKey = chatMessagesCacheKey(eventId, user.id);
      const showRows = (rows: Record<string, unknown>[]) => {
        const next = rows.map(mapMessageRowRef.current).filter(Boolean) as ChatMessage[];
        if (next.length) rememberSeen(user.id, eventId, next[next.length - 1].id);
        setMessages((prev) => {
          const merged = mergeLiveMessages(next, prev);
          return sameVisibleMessages(prev, merged) ? prev : merged;
        });
      };

      // Show the saved copy at once (whatever its age), then always refresh from the server below.
      const saved = peekCache<Record<string, unknown>[]>(cacheKey);
      if (!silent) {
        if (saved) {
          showRows(saved);
          setMessagesLoading(false);
        } else {
          setMessagesLoading(true);
          setMessages([]); // Clears old messages immediately to prevent bleed-over
        }
      }
      try {
        const primaryUrl = `${getApiUrl(chatMessagesPath(eventId))}?limit=100&page=1`;
        const res = await fetch(primaryUrl, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        // Never keep messages from a chat you can no longer access, even if you have moved on.
        if (res.status === 403) invalidate(cacheKey);
        if (!isCurrent()) return;
        if (res.status === 403) {
          setChatUnavailable(true);
          setMessages([]);
          setToast({ show: true, message: 'You can no longer access this chat.', type: 'error' });
          return;
        }
        // Failed or unreadable responses are never saved; keep the saved copy on screen if there is one.
        const body = res.ok ? await res.json().catch(() => null) : null;
        if (!isCurrent()) return;
        if (body === null) {
          if (!saved) setMessages([]);
          setChatUnavailable(false);
          setChatApiMissing(true);
          return;
        }
        const rows = normalizeMessageList(body);
        setCacheEntry(cacheKey, rows, TTL.SHORT);
        showRows(rows);
        setChatUnavailable(false);
        setChatApiMissing(false);
      } catch {
        if (isCurrent() && !saved) setMessages([]); // network error
      } finally {
        // The newest request ends loading, silent or not, so a send during a load cannot leave it stuck.
        if (isCurrent()) setMessagesLoading(false);
      }
    },
    [token, user.id],
  );
  loadMessagesRef.current = loadMessages;

  useEffect(() => {
    if (!activeChat) return;
    void loadMessages(activeChat);
  }, [activeChat, loadMessages]);

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ eventId?: string | null; row?: Record<string, unknown> | null }>).detail;
      const row = detail?.row ?? null;
      const eventId =
        detail?.eventId ??
        (row ? eventIdFromRealtimeRow({ new: row }) : null);
      const openId = activeChatRef.current;
      const matchesOpen =
        Boolean(openId && eventId && String(eventId).toLowerCase() === String(openId).toLowerCase());
      if (openId && (matchesOpen || !eventId)) {
        const mapped = row ? mapMessageRowRef.current(row) : null;
        if (mapped) {
          const live = { ...mapped, liveUntil: chatLiveHoldUntil() };
          setMessages((prev) => (prev.some((m) => m.id === live.id || sameLiveMessage(m, live)) ? prev : [...prev, live]));
          invalidate(chatMessagesCacheKey(openId, user.id));
        } else {
          invalidate(chatMessagesCacheKey(openId, user.id));
          void loadMessagesRef.current(openId, true);
        }
      }
      // List and other threads must still light up after the first chat was opened.
      // Do not require `activeChat` — going back to the list used to drop every later tag.
      if (eventId && !matchesOpen) {
        const sender = row?.sender_id ?? row?.user_id;
        noteIncomingChatMessage(user.id, eventId, sender == null ? null : String(sender));
      }
      void loadChatListRef.current(true);
    };
    window.addEventListener(CHAT_MESSAGES_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CHAT_MESSAGES_CHANGED_EVENT, onChange);
  }, [user.id]);

  useEffect(() => {
    if (!token || !activeChat) return;
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadMessages(activeChat, true);
    };
    const id = window.setInterval(tick, CHAT_OPEN_POLL_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [activeChat, token, loadMessages]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const peek = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const openId = activeChatRef.current;
      const others = chatsRef.current.filter((chat) => chat.id !== openId);
      await Promise.allSettled(
        others.map(async (chat) => {
          if (cancelled) return;
          try {
            const res = await fetch(`${getApiUrl(chatMessagesPath(chat.id))}?limit=100&page=1`, {
              cache: 'no-store',
              headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            });
            if (!res.ok) return;
            const body = await res.json().catch(() => null);
            const latest = latestMessageMeta(normalizeMessageList(body));
            if (latest) {
              noteNewerChatMessage(user.id, chat.id, latest.createdAt, latest.senderId, latest.messageId);
            }
          } catch {
            /* ignore a single chat peek */
          }
        }),
      );
    };
    let interval = 0;
    const timeout = window.setTimeout(() => {
      void peek();
      interval = window.setInterval(() => { void peek(); }, CHAT_LIST_POLL_MS);
    }, CHAT_LIST_POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [token, user.id]);

  const closeActiveChat = () => {
    const openId = activeChatRef.current;
    if (openId) {
      const lastId = messages.length ? messages[messages.length - 1].id : null;
      markChatRead(user.id, openId, lastId);
    }
    setViewingChatId(null);
    setActiveChat(null);
  };

  useEffect(() => {
    setViewingChatId(activeChat);
    if (!activeChat) return;
    const lastId = messages.length ? messages[messages.length - 1].id : null;
    markChatRead(user.id, activeChat, lastId);
    setChats((prev) => prev.map((c) => (c.id === activeChat ? { ...c, unread: 0 } : c)));
  }, [activeChat, messages, user.id]);

  useEffect(() => {
    return () => setViewingChatId(null);
  }, []);

  useEffect(() => {
    const syncUnread = () => {
      setChats((prev) =>
        prev.map((c) => ({
          ...c,
          unread: activeChat === c.id ? 0 : isChatUnread(user.id, c.id) ? 1 : 0,
        })),
      );
    };
    window.addEventListener(CHAT_UNREAD_CHANGED_EVENT, syncUnread);
    return () => window.removeEventListener(CHAT_UNREAD_CHANGED_EVENT, syncUnread);
  }, [activeChat, user.id]);

  const sendMessage = async (explicitContent?: string) => {
    const chat = activeChatObj;
    if (chat?.isCancelled || chat?.isPast) return; // Prevent sending on cancelled/past chats

    const content = explicitContent ?? encodeChatPayload({ v: 1, type: 'text', text: input.trim() });
    const plainInput = input.trim();
    if (!content || !activeChat || !token || sending || chatUnavailable) {
      return;
    }
    if (!explicitContent && !plainInput) return;

    const eventId = activeChat;
    const localId = `${LOCAL_MESSAGE_PREFIX}${
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    }`;
    const optimisticRow: Record<string, unknown> = {
      id: localId,
      event_id: eventId,
      sender_id: resolveMeId(),
      content,
      created_at: new Date().toISOString(),
      message_type: 'user',
    };
    const optimistic = mapMessageRowRef.current(optimisticRow);
    if (optimistic) {
      setMessages((prev) => [...prev, { ...optimistic, liveUntil: chatLiveHoldUntil() }]);
    }
    if (!explicitContent) setInput('');
    setShowEmoji(false);
    setChatApiMissing(false);
    pinToBottomRef.current = true;
    publishLiveChatMessage(eventId, optimisticRow);

    setSending(true);
    try {
      const primary = getApiUrl(chatMessagesPath(eventId));
      const res = await fetch(primary, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        setMessages((prev) => prev.filter((m) => m.id !== localId));
        if (!explicitContent) setInput(plainInput);
        setToast({ show: true, message: errText ? `Could not send: ${errText.slice(0, 120)}` : 'Unable to send message right now.', type: 'error' });
        return;
      }
      try {
        const body = await res.json().catch(() => null);
        const serverRow = messageFieldsFromPostBody(body, optimisticRow);
        const confirmed = mapMessageRowRef.current(serverRow);
        if (confirmed && optimistic && sameLiveMessage(confirmed, optimistic)) {
          setMessages((prev) =>
            prev.map((m) => (m.id === localId ? { ...confirmed, id: localId, liveUntil: chatLiveHoldUntil() } : m)),
          );
          publishLiveChatMessage(eventId, serverRow);
        }
        invalidate(chatMessagesCacheKey(eventId, user.id));
      } catch {
        /* keep the optimistic row; the next poll will reconcile */
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== localId));
      if (!explicitContent) setInput(plainInput);
      setToast({ show: true, message: 'Unable to send message right now.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  if (activeChat && activeChatObj) {
    const chat = activeChatObj;
    const isReadOnly = Boolean(chat.isPast || chat.isCancelled);
    return (
      <div className="flex min-h-screen flex-col bg-background pb-20">
        <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />

        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg">
          <TopBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search chats..."
          />
          <header className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Back to chats"
              onClick={closeActiveChat}
              className="rounded-full glass-card p-2 hover:bg-secondary/80 transition-colors active:scale-90 shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>

            <div className="relative shrink-0">
              <UserAvatar src={chat.avatar} seed={chat.id} name={chat.name} size="sm" className="ring-2 ring-primary/30" />
              <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${isReadOnly || chatUnavailable ? 'bg-muted-foreground' : 'bg-green-500'}`} />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold text-foreground">{chat.name}</h1>
              <p className={`text-[10px] ${chatUnavailable ? 'text-destructive' : chat.isCancelled ? 'text-amber-500 font-medium' : chat.isPast ? 'text-muted-foreground' : 'text-green-500'}`}>
                {chatUnavailable ? 'Chat unavailable' : chat.isCancelled ? 'Cancelled event · read-only' : chat.isPast ? 'Past event · read-only' : chatApiMissing ? 'Offline preview' : 'Active'}
                {!chatUnavailable && messages.filter((m) => m.messageType === 'checkin').length > 0 && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-primary">
                    <MapPinned className="h-3 w-3" />
                    {new Set(messages.filter((m) => m.messageType === 'checkin' && m.senderId).map((m) => m.senderId)).size} here
                  </span>
                )}
              </p>
            </div>
            </div>
          </header>
        </div>

        {chat.isCancelled && !chatUnavailable && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>This event was cancelled. The chat is read-only.</p>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            ref={scrollerRef}
            onScroll={() => {
              const el = scrollerRef.current;
              if (el) pinToBottomRef.current = isNearBottom(el);
            }}
            className="flex-1 space-y-1 overflow-y-auto px-4 py-4 custom-scrollbar"
          >
            {messagesLoading && (
              <div className="space-y-3 pt-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                    {i % 2 === 0 && <div className="h-8 w-8 shrink-0 rounded-full shimmer" />}
                    <div className={`h-10 rounded-2xl shimmer ${i % 2 === 0 ? 'w-48' : 'w-36'}`} />
                  </div>
                ))}
              </div>
            )}
            {!messagesLoading && messages.length === 0 && !chatUnavailable && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Send className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground">History is empty for this chat</p>
              </div>
            )}
            {messages.filter((m) => m.messageType !== 'poll_vote').map((m, i, visible) => {
              const showDateSep = i === 0 || visible[i - 1].dateKey !== m.dateKey;
              return (
                <div key={m.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 py-3">
                      <div className="flex-1 border-t border-border/40" />
                      <span className="shrink-0 rounded-full bg-secondary/80 px-3 py-1 text-[10px] font-semibold text-muted-foreground">
                        {formatDateSeparator(m.dateKey)}
                      </span>
                      <div className="flex-1 border-t border-border/40" />
                    </div>
                  )}
                  {m.kind === 'system' ? (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center py-1">
                      <span className="rounded-full bg-secondary/60 px-3 py-1 text-[10px] text-muted-foreground">
                        {m.text}
                        <span className="ml-1.5 opacity-60">{m.time}</span>
                      </span>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex items-end gap-2 mb-1 ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                      {m.from === 'them' && (
                        m.senderId ? (
                          <button
                            type="button"
                            onClick={() => navigate(userProfilePath(m.senderId as string, resolveMeId()))}
                            aria-label={`Open ${m.senderName || 'this user'}'s profile`}
                            className="shrink-0 mb-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <UserAvatar src={m.senderAvatar} seed={m.senderId} name={m.senderName || '?'} size="sm" />
                          </button>
                        ) : (
                          <UserAvatar src={m.senderAvatar} seed={m.id} name={m.senderName || '?'} size="sm" className="shrink-0 mb-1" />
                        )
                      )}
                      <div className={`max-w-[72%] flex flex-col gap-1 ${m.from === 'me' ? 'items-end' : 'items-start'}`}>
                        {m.from === 'them' && (
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[11px] font-semibold text-foreground">
                              {m.senderName || 'Unknown'}
                            </span>
                          </div>
                        )}
                        <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                          m.from === 'me'
                            ? 'gradient-primary text-primary-foreground rounded-br-sm'
                            : 'glass-card text-foreground rounded-bl-sm'
                        }`}>
                          {m.messageType === 'poll' && m.pollId && (m.options?.length || 0) > 1 ? (
                            <EventPollCard
                              question={m.question || m.text}
                              options={m.options || []}
                              votesByUser={Object.fromEntries(
                                messages
                                  .filter((vote) => vote.messageType === 'poll_vote' && vote.pollId === m.pollId && vote.senderId && vote.optionIndex != null)
                                  .map((vote) => [vote.senderId as string, vote.optionIndex as number]),
                              )}
                              myId={resolveMeId()}
                              disabled={chatUnavailable || isReadOnly || sending}
                              onVote={(optionIndex) => {
                                void sendMessage(encodeChatPayload({
                                  v: 1,
                                  type: 'poll_vote',
                                  pollId: m.pollId,
                                  optionIndex,
                                  text: `vote:${optionIndex}`,
                                }));
                              }}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
                          )}
                          <p className={`mt-1 text-[10px] ${m.from === 'me' ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground'}`}>{m.time}</p>
                        </div>
                      </div>
                      {m.from === 'me' && (
                        <UserAvatar src={user.avatar} seed={user.id} name={user.name} size="sm" className="shrink-0 mb-1" />
                      )}
                    </motion.div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {showPoll && !isReadOnly && !chatUnavailable && (
          <div className="border-t border-border bg-background px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">New poll</p>
            <input
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Ask a question…"
              aria-label="Poll question"
              className="w-full rounded-xl border border-border/50 bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            {pollOptions.map((opt, i) => (
              <input
                key={i}
                value={opt}
                onChange={(e) => setPollOptions((prev) => prev.map((item, idx) => (idx === i ? e.target.value : item)))}
                placeholder={`Option ${i + 1}`}
                aria-label={`Poll option ${i + 1}`}
                className="w-full rounded-xl border border-border/50 bg-secondary px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            ))}
            {pollOptions.length < 4 && (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev, ''])}
                className="text-[11px] font-semibold text-primary"
              >
                Add option
              </button>
            )}
            <button
              type="button"
              disabled={sending || !pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2}
              onClick={() => {
                const options = pollOptions.map((o) => o.trim()).filter(Boolean);
                void sendMessage(encodeChatPayload({
                  v: 1,
                  type: 'poll',
                  pollId: crypto.randomUUID(),
                  question: pollQuestion.trim(),
                  options,
                  text: pollQuestion.trim(),
                }));
                setPollQuestion('');
                setPollOptions(['', '']);
                setShowPoll(false);
              }}
              className="w-full rounded-xl gradient-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
            >
              Post poll
            </button>
          </div>
        )}

        <div className="sticky bottom-16 border-t border-border bg-background/95 backdrop-blur-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={chatUnavailable || isReadOnly}
              onClick={() => setShowEmoji(!showEmoji)}
              className={`shrink-0 rounded-full p-2 transition-all disabled:opacity-40 ${showEmoji ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'}`}
              aria-label="Emoji"
            >
              <Smile className="h-5 w-5" />
            </button>
            <button
              type="button"
              disabled={chatUnavailable || isReadOnly}
              onClick={() => setShowPoll((v) => !v)}
              className={`shrink-0 rounded-full p-2 transition-all disabled:opacity-40 ${showPoll ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'}`}
              aria-label="Create poll"
            >
              <ListChecks className="h-5 w-5" />
            </button>
            <input
              value={input}
              disabled={chatUnavailable || isReadOnly}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
              placeholder={
                chat.isCancelled 
                  ? 'Cancelled event chat is read-only' 
                  : chat.isPast 
                  ? 'Past event chat is read-only' 
                  : 'Type a message…'
              }
              className="flex-1 rounded-full border border-border/50 bg-secondary px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              disabled={chatUnavailable || sending || !input.trim() || isReadOnly}
              onClick={() => void sendMessage()}
              className="shrink-0 rounded-full gradient-primary p-2.5 shadow-glow disabled:opacity-40 active:scale-90 transition-transform"
              aria-label="Send message"
            >
              <Send className="h-4 w-4 text-primary-foreground" />
            </button>
          </div>
        </div>

        <BottomNav />
      </div>
    );
  }

  const activeChats = chats.filter((c) => !c.isPast && !c.isCancelled);
  const pastChats = chats.filter((c) => c.isPast && !c.isCancelled && !isExpiredOver48h(c.eventDate));
  const cancelledChats = chats.filter((c) => c.isCancelled);

  const currentTabChats =
    chatTab === 'active'
      ? activeChats
      : chatTab === 'past'
      ? pastChats
      : cancelledChats;

  const searchQuery = search.trim().toLowerCase();
  const visibleChats = searchQuery
    ? currentTabChats.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery) ||
          c.lastMsg.toLowerCase().includes(searchQuery),
      )
    : currentTabChats;

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg">
        <TopBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search chats..."
        />
        <header className="border-b border-border px-4 py-3">
          <h1 className="text-xl font-bold text-gradient">Chats</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Your event conversations</p>
        </header>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* Chat Tabs with Circular Badge Counters */}
        <div className="flex rounded-xl glass-card p-1 gap-1" role="tablist">
          {[
            { id: 'active' as const, label: 'Active', count: activeChats.length, icon: Calendar },
            { id: 'past' as const, label: 'Past', count: pastChats.length, icon: Clock },
            { id: 'cancelled' as const, label: 'Cancelled', count: cancelledChats.length, icon: Ban },
          ].map((tab) => {
            const isActive = chatTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setChatTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? tab.id === 'cancelled'
                      ? 'bg-destructive text-destructive-foreground shadow-sm'
                      : 'gradient-primary text-primary-foreground shadow-glow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                  isActive 
                    ? 'bg-background/25 text-inherit' 
                    : 'bg-secondary text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {chatListLoading && visibleChats.length === 0 && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl glass-card px-4 py-3.5">
                <div className="h-12 w-12 shrink-0 rounded-full shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/5 rounded-full shimmer" />
                  <div className="h-2.5 w-3/5 rounded-full shimmer" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!chatListLoading && visibleChats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Send className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {searchQuery ? 'No matching conversations' : `No ${chatTab} conversations`}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {searchQuery
                ? 'Try a different search.'
                : chatTab === 'active'
                  ? "You don't have any active event chats right now."
                  : `No ${chatTab} event chats found.`}
            </p>
          </div>
        )}

        {visibleChats.length > 0 && (
          <div className="space-y-2.5">
            {visibleChats.map((chat) => (
              <motion.button
                key={chat.id}
                type="button"
                onClick={() => {
                  setMessages([]); // Clears immediately on click
                  setActiveChat(chat.id);
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex w-full items-center gap-3 rounded-2xl glass-card px-4 py-3.5 text-left transition-all hover:border-primary/30 active:scale-[0.98] ${chat.isPast || chat.isCancelled ? 'opacity-65' : ''}`}
              >
                <div className="relative shrink-0">
                  <UserAvatar src={chat.avatar} seed={chat.id} name={chat.name} size="lg" className="ring-2 ring-border" />
                  <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background ${chat.isCancelled ? 'bg-amber-500' : chat.isPast ? 'bg-muted-foreground' : 'bg-green-500'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{chat.name}</p>
                    {(chat.unread > 0 || isChatUnread(user.id, chat.id)) && (
                      <span
                        data-testid="new-messages-tag"
                        className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold leading-none text-accent-foreground animate-pulse"
                      >
                        New messages
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground mt-0.5">
                    {chat.isCancelled ? 'Cancelled · Read-only' : chat.isPast ? `Ended · ${chat.eventDate}` : chat.lastMsg}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}