import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Smile, AlertTriangle } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentUser } from '@/lib/storage';
import BottomNav from '@/components/BottomNav';
import { UserAvatar } from '@/components/UserAvatar';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import AppToast from '@/components/AppToast';
import { mapApiEventToItem } from '@/lib/mapApiEvent';
import { fetchAuthUserFromToken, sameAuthUserId } from '@/lib/authProfile';
import { isEventUpcoming } from '@/lib/eventTime';

type ChatEvent = {
  id: string;
  name: string;
  avatar: string;
  lastMsg: string;
  time: string;
  unread: number;
  isPast: boolean;
  eventDate: string;
  organizerId: string;
};

type ChatMessage = {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
  dateKey: string; // YYYY-MM-DD for grouping
  kind?: 'user' | 'system';
  messageType?: 'text' | 'file' | 'voice' | 'notification';
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
  senderName?: string;
  senderAvatar?: string;
  senderId?: string;
};

/** Returns true if the event ended more than 48 hours ago */
function isExpiredOver48h(eventDate: string): boolean {
  if (!eventDate) return false;
  const normalized = /[Zz]$|[+-]\d{2}:\d{2}$/.test(eventDate) ? eventDate : `${eventDate}T00:00:00Z`;
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

type EventAvailabilityStatus = 'active' | 'cancelled' | 'unknown';

const EMOJIS = ['😀', '😂', '❤️', '🔥', '🎉', '👏', '🙌', '💯', '✨', '🎶', '🤩', '😎', '🥳', '💜', '🎵', '⚡'];

type EncodedChatPayload = {
  v: 1;
  type: 'text' | 'file' | 'voice';
  text?: string;
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
};

function chatMessagesPath(eventId: string) {
  return `/api/chats/${eventId}/messages`;
}

const LEGACY_MESSAGE_GET_PATHS = (eventId: string) => [
  `/api/events/${eventId}/chat/messages`,
  `/api/events/${eventId}/messages`,
  `/api/chat/events/${eventId}/messages`,
];

const LEGACY_MESSAGE_POST_PATHS = (eventId: string) => [
  `/api/events/${eventId}/chat/messages`,
  `/api/events/${eventId}/messages`,
  `/api/chat/events/${eventId}/messages`,
];

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    if (activeChat && !chats.some((entry) => entry.id === activeChat)) setActiveChat(null);
  }, [activeChat, chats]);

  useEffect(() => {
    const el = messagesEndRef.current;
    if (!el || messagesLoading) return;
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, messagesLoading, activeChat]);

  if (!user) return <Navigate to="/login" replace />;

  const resolveMeId = () => authUserId || user.id;

  const parsePayload = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as EncodedChatPayload;
      if (parsed && parsed.v === 1 && (parsed.type === 'text' || parsed.type === 'file' || parsed.type === 'voice')) return parsed;
    } catch { /* plain text */ }
    return null;
  };

  const encodePayload = (payload: EncodedChatPayload) => JSON.stringify(payload);

  const mapMessageRow = useCallback(
    (row: Record<string, unknown>): ChatMessage | null => {
      const rawContent = String(row.content || row.message || row.text || '').trim();
      const parsed = rawContent ? parsePayload(rawContent) : null;
      const text = parsed
        ? String(parsed.text || (parsed.type === 'voice' ? 'Voice message' : parsed.fileName || 'Attachment'))
        : rawContent;
      if (!text) return null;
      const senderId = String(row.sender_id || row.user_id || row.created_by || '');
      const sentAtRaw = row.created_at || row.sent_at || row.timestamp;
      const sentAt = sentAtRaw ? new Date(String(sentAtRaw)) : new Date();
      const rawType = String(row.type || row.message_type || row.kind || '').toLowerCase();
      const isSystem =
        Boolean(row.is_system) ||
        rawType === 'system' || rawType === 'notification' ||
        rawType === 'join' || rawType === 'leave' ||
        rawType === 'participant_joined' || rawType === 'participant_left' ||
        // Detect by content pattern when no type field is set
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
        id: String(row.id || crypto.randomUUID()),
        from: isMe ? 'me' : 'them',
        text,
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
      };
    },
    [authUserId, user.id],
  );

  const mapMessageRowRef = useRef(mapMessageRow);
  useEffect(() => { mapMessageRowRef.current = mapMessageRow; }, [mapMessageRow]);

  const activeChatObj = chats.find((entry) => entry.id === activeChat) || null;

  const loadChatList = useCallback(async (silent = false) => {
    if (!token) { if (!silent) setChatListLoading(false); return; }
    if (!silent) setChatListLoading(true);
    try {
      const [joinedRes, organizedRes] = await Promise.all([
        fetch(getApiUrl('/api/participants/my/events'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getApiUrl('/api/events/my-events'), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const joinedBody = joinedRes.ok ? await joinedRes.json().catch(() => []) : [];
      const organizedBody = organizedRes.ok ? await organizedRes.json().catch(() => ({})) : {};
      const joinedRows = Array.isArray(joinedBody) ? joinedBody : Array.isArray(joinedBody?.data) ? joinedBody.data : [];
      const organizedRows = Array.isArray(organizedBody?.data) ? organizedBody.data : [];
      const joinedEvents = joinedRows.map((row: Record<string, unknown>) => row?.events as Record<string, unknown>).filter(Boolean);
      const allEvents = [...joinedEvents, ...organizedRows];

      const byId = new Map<string, ChatEvent>();
      allEvents
        .filter((evt) => Boolean(evt) && String((evt as Record<string, unknown>).status || '').toLowerCase() !== 'cancelled')
        .map((evt) => mapApiEventToItem(evt as Record<string, unknown>))
        .forEach((evt) => {
          byId.set(evt.id, {
            id: evt.id,
            name: evt.title,
            avatar: evt.image,
            lastMsg: 'Open conversation',
            time: evt.time || '',
            unread: 0,
            isPast: !isEventUpcoming(evt),
            eventDate: evt.date || '',
            organizerId: evt.organizerId || '',
          });
        });

      const mapped = Array.from(byId.values());

      // Fetch last message for each chat in parallel (silent, best-effort)
      const withLastMsg = await Promise.all(
        mapped.map(async (chat) => {
          try {
            const res = await fetch(
              `${getApiUrl(chatMessagesPath(chat.id))}?limit=50&page=1`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!res.ok) return chat;
            const body = await res.json().catch(() => ({}));
            const rows: Record<string, unknown>[] = Array.isArray(body.data)
              ? body.data : Array.isArray(body) ? body : [];
            const last = rows[rows.length - 1];
            if (!last) return chat;
            const rawContent = String(last.content || last.message || last.text || '').trim();
            let displayText = rawContent;
            try {
              const p = JSON.parse(rawContent) as { v?: number; type?: string; text?: string; fileName?: string };
              if (p?.v === 1) displayText = p.text || (p.type === 'voice' ? '🎤 Voice message' : p.fileName || 'Attachment');
            } catch { /* plain text */ }
            const sentAt = last.created_at || last.sent_at || last.timestamp;
            const timeStr = sentAt
              ? new Date(String(sentAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : chat.time;
            return { ...chat, lastMsg: displayText || chat.lastMsg, time: timeStr };
          } catch { return chat; }
        }),
      );

      setChats(withLastMsg);

      if (activeChat && !withLastMsg.some((entry) => entry.id === activeChat)) {
        setActiveChat(null);
        setChatUnavailable(true);
        setMessages([]);
        setToast({ show: true, message: 'Chat is no longer available for this event.', type: 'error' });
      }

      if (selectedEventFromUrl && !handledSelectedParam) {
        if (withLastMsg.some((entry) => entry.id === selectedEventFromUrl)) {
          setActiveChat(selectedEventFromUrl);
        } else {
          setToast({ show: true, message: 'You no longer have access to this event chat.', type: 'error' });
          navigate('/chat', { replace: true });
        }
        setHandledSelectedParam(true);
      }
    } catch {
      setChats([]);
    } finally {
      if (!silent) setChatListLoading(false);
    }
  }, [token, activeChat, selectedEventFromUrl, handledSelectedParam, navigate]);

  useEffect(() => { void loadChatList(); }, [loadChatList]);

  useEffect(() => {
    if (!token) return;
    const onFocus = () => { void loadChatList(true); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [token, loadChatList]);

  const checkEventAvailability = useCallback(async (eventId: string): Promise<EventAvailabilityStatus> => {
    try {
      const res = await fetch(getApiUrl(`/api/events/${eventId}`));
      if (!res.ok) return 'unknown';
      const evt = await res.json();
      return String(evt?.status || '').toLowerCase() === 'cancelled' ? 'cancelled' : 'active';
    } catch { return 'unknown'; }
  }, []);

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
      if (!silent) setMessagesLoading(true);
      try {
        const availability = await checkEventAvailability(eventId);
        if (availability === 'cancelled') {
          setChatUnavailable(true);
          setMessages([]);
          setToast({ show: true, message: 'This event was canceled. Chat is no longer available.', type: 'error' });
          return;
        }
        const primaryUrl = `${getApiUrl(chatMessagesPath(eventId))}?limit=100&page=1`;
        let res = await fetch(primaryUrl, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
        let rows: Record<string, unknown>[] = [];
        let anyEndpointSupported = false;
        if (res.ok) {
          const body = await res.json().catch(() => ({}));
          rows = normalizeMessageList(body);
          anyEndpointSupported = true;
        } else if (res.status === 403) {
          setChatUnavailable(true);
          setMessages([]);
          setToast({ show: true, message: 'You can no longer access this chat.', type: 'error' });
          return;
        } else {
          for (const path of LEGACY_MESSAGE_GET_PATHS(eventId)) {
            res = await fetch(getApiUrl(path), { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
            if (!res.ok) { if (res.status !== 404 && res.status !== 405) anyEndpointSupported = true; continue; }
            anyEndpointSupported = true;
            const body = await res.json().catch(() => ({}));
            rows = normalizeMessageList(body);
            break;
          }
        }
        setMessages(rows.map(mapMessageRowRef.current).filter(Boolean) as ChatMessage[]);
        setChatUnavailable(false);
        setChatApiMissing(!anyEndpointSupported);
      } catch {
        setMessages([]);
      } finally {
        if (!silent) setMessagesLoading(false);
      }
    },
    [token, checkEventAvailability],
  );

  useEffect(() => {
    if (!activeChat) return;
    void loadMessages(activeChat);
  }, [activeChat, loadMessages]);

  useEffect(() => {
    if (!activeChat || chatUnavailable) return;
    const timer = window.setInterval(() => {
      void loadMessages(activeChat, true);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [activeChat, chatUnavailable, loadMessages]);

  const sendMessage = async (explicitContent?: string) => {
    const content = explicitContent ?? encodePayload({ v: 1, type: 'text', text: input.trim() });
    const plainInput = input.trim();
    if (!content || !activeChat || !token || sending || chatUnavailable) return;
    if (!explicitContent && !plainInput) return;
    const availability = await checkEventAvailability(activeChat);
    if (availability === 'cancelled') {
      setChatUnavailable(true);
      setMessages([]);
      setToast({ show: true, message: 'Event chat is unavailable because the event is canceled.', type: 'error' });
      return;
    }
    setSending(true);
    try {
      const primary = getApiUrl(chatMessagesPath(activeChat));
      let res = await fetch(primary, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ content }),
      });
      let sendOk = res.ok;
      let onlyMissingEndpoints = res.status === 404 || res.status === 405;
      if (!sendOk && onlyMissingEndpoints) {
        for (const path of LEGACY_MESSAGE_POST_PATHS(activeChat)) {
          res = await fetch(getApiUrl(path), {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: content, content, text: content }),
          });
          if (res.ok) { sendOk = true; break; }
          if (res.status !== 404 && res.status !== 405) onlyMissingEndpoints = false;
        }
      }
      if (res.status === 403) {
        setChatUnavailable(true);
        setMessages([]);
        setToast({ show: true, message: 'This event was canceled or you no longer have access to this chat.', type: 'error' });
        return;
      }
      if (!sendOk) {
        if (onlyMissingEndpoints) {
          const parsedContent = parsePayload(content);
          setMessages((prev) => [...prev, {
            id: crypto.randomUUID(), from: 'me',
            text: parsedContent?.text || plainInput,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            dateKey: new Date().toISOString().slice(0, 10),
            messageType: parsedContent?.type || 'text',
          }]);
          setInput(''); setShowEmoji(false); setChatApiMissing(true);
          setToast({ show: true, message: 'Chat API not available yet. Message shown locally only.', type: 'error' });
          return;
        }
        const errText = await res.text().catch(() => '');
        setToast({ show: true, message: errText ? `Could not send: ${errText.slice(0, 120)}` : 'Unable to send message right now.', type: 'error' });
        return;
      }
      setInput(''); setShowEmoji(false); setChatApiMissing(false);
      await loadMessages(activeChat);
    } catch {
      setToast({ show: true, message: 'Unable to send message right now.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  if (activeChat) {
    const chat = activeChatObj;
    if (!chat) return null;
    return (
      <div className="flex min-h-screen flex-col bg-background pb-20">
        <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />

        {/* Chat header */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Back to chats"
              onClick={() => setActiveChat(null)}
              className="rounded-full glass-card p-2 hover:bg-secondary/80 transition-colors active:scale-90 shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>

            <div className="relative shrink-0">
              <UserAvatar src={chat.avatar} seed={chat.id} name={chat.name} size="sm" className="ring-2 ring-primary/30" />
              <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${chat.isPast || chatUnavailable ? 'bg-muted-foreground' : 'bg-green-500'}`} />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold text-foreground">{chat.name}</h1>
              <p className={`text-[10px] ${chatUnavailable ? 'text-destructive' : chat.isPast ? 'text-muted-foreground' : 'text-green-500'}`}>
                {chatUnavailable ? 'Chat unavailable' : chat.isPast ? 'Past event · read-only' : chatApiMissing ? 'Offline preview' : 'Active'}
              </p>
            </div>
          </div>
        </header>

        {/* Unavailable banner */}
        {chatUnavailable && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>This event was canceled or you can no longer use this chat.</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4 custom-scrollbar">
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
                <p className="text-xs text-muted-foreground">Be the first to say hello 👋</p>
              </div>
            )}
            {messages.map((m, i) => {
              const showDateSep = i === 0 || messages[i - 1].dateKey !== m.dateKey;
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
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-center py-1"
                    >
                      <span className="rounded-full bg-secondary/60 px-3 py-1 text-[10px] text-muted-foreground">
                        {m.text}
                        <span className="ml-1.5 opacity-60">{m.time}</span>
                      </span>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-end gap-2 mb-1 ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}
                    >
                      {m.from === 'them' && (
                        <UserAvatar src={m.senderAvatar} seed={m.senderId || m.id} name={m.senderName || '?'} size="sm" className="shrink-0 mb-1" />
                      )}
                      <div className={`max-w-[72%] flex flex-col gap-1 ${m.from === 'me' ? 'items-end' : 'items-start'}`}>
                        {m.from === 'them' && (
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[11px] font-semibold text-foreground">{m.senderName || 'Unknown'}</span>
                            {m.senderId && (
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                m.senderId === chat.organizerId
                                  ? 'gradient-primary text-primary-foreground'
                                  : 'bg-secondary text-muted-foreground'
                              }`}>
                                {m.senderId === chat.organizerId ? 'Host' : 'Guest'}
                              </span>
                            )}
                          </div>
                        )}
                        <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                          m.from === 'me'
                            ? 'gradient-primary text-primary-foreground rounded-br-sm'
                            : 'glass-card text-foreground rounded-bl-sm'
                        }`}>
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
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

        {/* Input bar */}
        <div className="sticky bottom-16 border-t border-border bg-background/95 backdrop-blur-lg px-4 py-3">
          <AnimatePresence>
            {showEmoji && !chatUnavailable && !chat.isPast && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-3 overflow-hidden"
              >
                <div className="flex flex-wrap gap-2 rounded-2xl glass-card px-3 py-2.5">
                  {EMOJIS.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => setInput((prev) => prev + emoji)} className="text-xl transition-transform hover:scale-125 active:scale-95">
                      {emoji}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={chatUnavailable || chat.isPast}
              onClick={() => setShowEmoji(!showEmoji)}
              className={`shrink-0 rounded-full p-2 transition-all disabled:opacity-40 ${showEmoji ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'}`}
              aria-label="Emoji"
            >
              <Smile className="h-5 w-5" />
            </button>
            <input
              value={input}
              disabled={chatUnavailable || chat.isPast}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
              placeholder={
                chat.isPast ? 'Chat is read-only for past events'
                  : chatUnavailable ? 'Chat unavailable for this event'
                  : 'Type a message…'
              }
              className="flex-1 rounded-full border border-border/50 bg-secondary px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              disabled={chatUnavailable || sending || !input.trim() || chat.isPast}
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />

      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gradient">Chats</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Your event conversations</p>
          </div>
          {chats.length > 0 && (
            <span className="rounded-full gradient-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground shadow-glow">
              {chats.filter(c => !c.isPast).length} active
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-3 space-y-2">
        {chatListLoading && (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl glass-card px-4 py-3.5">
                <div className="h-12 w-12 shrink-0 rounded-full shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/5 rounded-full shimmer" />
                  <div className="h-2.5 w-3/5 rounded-full shimmer" />
                </div>
              </div>
            ))}
          </>
        )}

        {!chatListLoading && chats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Send className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Join an event and open its chat from the event details page to start talking.
            </p>
          </div>
        )}

        {!chatListLoading && chats.length > 0 && (() => {
          const activeChats = chats.filter((c) => !c.isPast);
          const pastChats = chats.filter((c) => c.isPast && !isExpiredOver48h(c.eventDate));

          const renderChatItem = (chat: ChatEvent) => (
            <motion.button
              key={chat.id}
              type="button"
              onClick={() => setActiveChat(chat.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex w-full items-center gap-3 rounded-2xl glass-card px-4 py-3.5 text-left transition-all hover:border-primary/30 active:scale-[0.98] ${chat.isPast ? 'opacity-60' : ''}`}
            >
              <div className="relative shrink-0">
                <UserAvatar src={chat.avatar} seed={chat.id} name={chat.name} size="lg" className="ring-2 ring-border" />
                <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background ${chat.isPast ? 'bg-muted-foreground' : 'bg-green-500'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{chat.name}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground mt-0.5">
                  {chat.isPast ? `Ended · ${chat.eventDate}` : chat.lastMsg}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="text-[10px] text-muted-foreground">{chat.time}</span>
                {chat.unread > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full gradient-primary text-[10px] font-bold text-primary-foreground shadow-glow">
                    {chat.unread}
                  </span>
                )}
              </div>
            </motion.button>
          );

          return (
            <>
              {activeChats.length > 0 && (
                <div className="space-y-2">
                  <p className="px-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active</p>
                  {activeChats.map(renderChatItem)}
                </div>
              )}
              {pastChats.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="px-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Past</p>
                  {pastChats.map(renderChatItem)}
                </div>
              )}
            </>
          );
        })()}
      </div>

      <BottomNav />
    </div>
  );
}
