import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Smile, Paperclip, Mic, AlertTriangle } from 'lucide-react';
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

type ChatEvent = {
  id: string;
  name: string;
  avatar: string;
  lastMsg: string;
  time: string;
  unread: number;
};

type ChatMessage = {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
  kind?: 'user' | 'system';
  messageType?: 'text' | 'file' | 'voice';
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
};

type EventAvailabilityStatus = 'active' | 'cancelled' | 'unknown';

const EMOJIS = ['😀', '😂', '❤️', '🔥', '🎉', '👏', '🙌', '💯', '✨', '🎶', '🤩', '😎', '🥳', '💜', '🎵', '⚡'];
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

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

/** Legacy paths kept for older deployments; primary API is `/api/chats/:id/messages`. */
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
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = getAuthToken();
      if (!t) {
        if (!cancelled) setAuthUserId(null);
        return;
      }
      const me = await fetchAuthUserFromToken(t);
      if (!cancelled) setAuthUserId(me?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  useEffect(() => {
    if (activeChat && !chats.some((entry) => entry.id === activeChat)) {
      setActiveChat(null);
    }
  }, [activeChat, chats]);

  useEffect(() => {
    const el = messagesEndRef.current;
    if (!el || messagesLoading) return;
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, messagesLoading, activeChat]);

  if (!user) return <Navigate to="/login" replace />;

  const resolveMeId = () => authUserId || user.id;

  const parsePayload = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as EncodedChatPayload;
      if (parsed && parsed.v === 1 && (parsed.type === 'text' || parsed.type === 'file' || parsed.type === 'voice')) {
        return parsed;
      }
    } catch {
      // plain text fallback
    }
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
        rawType === 'system' ||
        rawType === 'join' ||
        rawType === 'leave' ||
        rawType === 'participant_joined' ||
        rawType === 'participant_left';
      const meId = resolveMeId();
      const isMe =
        !isSystem &&
        Boolean(senderId) &&
        (sameAuthUserId(senderId, meId) || sameAuthUserId(senderId, user.id));
      return {
        id: String(row.id || crypto.randomUUID()),
        from: isMe ? 'me' : 'them',
        text,
        time: sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        kind: isSystem ? 'system' : 'user',
        messageType: parsed?.type || 'text',
        fileName: parsed?.fileName,
        mimeType: parsed?.mimeType,
        dataUrl: parsed?.dataUrl,
      };
    },
    [authUserId, user.id],
  );

  const activeChatObj = chats.find((entry) => entry.id === activeChat) || null;

  const loadChatList = useCallback(async () => {
    if (!token) {
      setChatListLoading(false);
      return;
    }
    setChatListLoading(true);
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
          });
        });

      const mapped = Array.from(byId.values());
      setChats(mapped);

      if (activeChat && !mapped.some((entry) => entry.id === activeChat)) {
        setActiveChat(null);
        setChatUnavailable(true);
        setMessages([]);
        setToast({
          show: true,
          message: 'Chat is no longer available for this event.',
          type: 'error',
        });
      }

      if (selectedEventFromUrl && !handledSelectedParam) {
        if (mapped.some((entry) => entry.id === selectedEventFromUrl)) {
          setActiveChat(selectedEventFromUrl);
        } else {
          setToast({
            show: true,
            message: 'You no longer have access to this event chat.',
            type: 'error',
          });
          navigate('/chat', { replace: true });
        }
        setHandledSelectedParam(true);
      }
    } catch {
      setChats([]);
    } finally {
      setChatListLoading(false);
    }
  }, [token, activeChat, selectedEventFromUrl, handledSelectedParam, navigate]);

  useEffect(() => {
    void loadChatList();
  }, [loadChatList]);

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      void loadChatList();
    }, 12000);
    const onFocus = () => {
      void loadChatList();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [token, loadChatList]);

  const checkEventAvailability = useCallback(async (eventId: string): Promise<EventAvailabilityStatus> => {
    try {
      const res = await fetch(getApiUrl(`/api/events/${eventId}`));
      if (!res.ok) return 'unknown';
      const evt = await res.json();
      return String(evt?.status || '').toLowerCase() === 'cancelled' ? 'cancelled' : 'active';
    } catch {
      return 'unknown';
    }
  }, []);

  const normalizeMessageList = (body: unknown): Record<string, unknown>[] => {
    if (!body || typeof body !== 'object') return [];
    const b = body as Record<string, unknown>;
    if (Array.isArray(b.data)) return b.data as Record<string, unknown>[];
    if (Array.isArray(body)) return body as Record<string, unknown>[];
    return [];
  };

  const loadMessages = useCallback(
    async (eventId: string) => {
      if (!token) return;
      setMessagesLoading(true);
      try {
        const availability = await checkEventAvailability(eventId);
        if (availability === 'cancelled') {
          setChatUnavailable(true);
          setMessages([]);
          setToast({ show: true, message: 'This event was canceled. Chat is no longer available.', type: 'error' });
          return;
        }

        const primaryUrl = `${getApiUrl(chatMessagesPath(eventId))}?limit=100&page=1`;
        let res = await fetch(primaryUrl, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });

        let rows: Record<string, unknown>[] = [];
        let anyEndpointSupported = false;

        if (res.ok) {
          const body = await res.json().catch(() => ({}));
          rows = normalizeMessageList(body);
          anyEndpointSupported = true;
        } else if (res.status === 403) {
          setChatUnavailable(true);
          setMessages([]);
          setToast({
            show: true,
            message: 'You can no longer access this chat (event may be canceled or you may have left).',
            type: 'error',
          });
          return;
        } else {
          for (const path of LEGACY_MESSAGE_GET_PATHS(eventId)) {
            res = await fetch(getApiUrl(path), {
              headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            });
            if (!res.ok) {
              if (res.status !== 404 && res.status !== 405) anyEndpointSupported = true;
              continue;
            }
            anyEndpointSupported = true;
            const body = await res.json().catch(() => ({}));
            rows = normalizeMessageList(body);
            break;
          }
        }

        setMessages(rows.map(mapMessageRow).filter(Boolean) as ChatMessage[]);
        setChatUnavailable(false);
        setChatApiMissing(!anyEndpointSupported);
      } catch {
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    },
    [token, checkEventAvailability, mapMessageRow],
  );

  useEffect(() => {
    if (!activeChat) return;
    void loadMessages(activeChat);
  }, [activeChat, loadMessages]);

  useEffect(() => {
    if (!activeChat || chatUnavailable) return;
    const timer = window.setInterval(async () => {
      const availability = await checkEventAvailability(activeChat);
      if (availability === 'cancelled') {
        setChatUnavailable(true);
        setMessages([]);
        setToast({ show: true, message: 'This event was canceled while you were in chat.', type: 'error' });
        window.setTimeout(() => navigate('/home', { replace: true }), 2000);
        return;
      }
      void loadMessages(activeChat);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [activeChat, chatUnavailable, navigate, checkEventAvailability, loadMessages]);

  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // noop
      }
    };
  }, []);

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
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      let sendOk = res.ok;
      let onlyMissingEndpoints = res.status === 404 || res.status === 405;

      if (!sendOk && onlyMissingEndpoints) {
        for (const path of LEGACY_MESSAGE_POST_PATHS(activeChat)) {
          res = await fetch(getApiUrl(path), {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: content, content, text: content }),
          });
          if (res.ok) {
            sendOk = true;
            break;
          }
          if (res.status !== 404 && res.status !== 405) {
            onlyMissingEndpoints = false;
          }
        }
      }

      if (res.status === 403) {
        setChatUnavailable(true);
        setMessages([]);
        setToast({
          show: true,
          message: 'This event was canceled or you no longer have access to this chat.',
          type: 'error',
        });
        return;
      }

      if (!sendOk) {
        if (onlyMissingEndpoints) {
          const parsedContent = parsePayload(content);
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              from: 'me',
              text: parsedContent?.text || (parsedContent?.type === 'voice' ? 'Voice message' : parsedContent?.fileName || plainInput),
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              messageType: parsedContent?.type || 'text',
              fileName: parsedContent?.fileName,
              mimeType: parsedContent?.mimeType,
              dataUrl: parsedContent?.dataUrl,
            },
          ]);
          setInput('');
          setShowEmoji(false);
          setChatApiMissing(true);
          setToast({
            show: true,
            message: 'Chat API not available yet. Message shown locally only.',
            type: 'error',
          });
          return;
        }
        const errText = await res.text().catch(() => '');
        setToast({
          show: true,
          message: errText ? `Could not send: ${errText.slice(0, 120)}` : 'Unable to send message right now.',
          type: 'error',
        });
        return;
      }

      setInput('');
      setShowEmoji(false);
      setChatApiMissing(false);
      await loadMessages(activeChat);
    } catch {
      setToast({ show: true, message: 'Unable to send message right now.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });

  const handlePickAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeChat) return;
    event.target.value = '';
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setToast({ show: true, message: 'File too large. Max 5 MB.', type: 'error' });
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const payload = encodePayload({
        v: 1,
        type: 'file',
        text: `Shared file: ${file.name}`,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl,
      });
      await sendMessage(payload);
      setToast({ show: true, message: 'File sent', type: 'success' });
    } catch {
      setToast({ show: true, message: 'Could not send file', type: 'error' });
    }
  };

  const stopRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.stop();
  };

  const startRecording = async () => {
    if (isRecording) {
      await stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        if (blob.size > MAX_ATTACHMENT_BYTES) {
          setToast({ show: true, message: 'Voice note too large (max 5 MB).', type: 'error' });
          return;
        }
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
        try {
          const dataUrl = await fileToDataUrl(file);
          const payload = encodePayload({
            v: 1,
            type: 'voice',
            text: 'Voice message',
            fileName: file.name,
            mimeType: file.type || 'audio/webm',
            dataUrl,
          });
          await sendMessage(payload);
          setToast({ show: true, message: 'Voice message sent', type: 'success' });
        } catch {
          setToast({ show: true, message: 'Could not send voice message', type: 'error' });
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setToast({ show: true, message: 'Microphone permission denied or unavailable.', type: 'error' });
    }
  };

  if (activeChat) {
    const chat = activeChatObj;
    if (!chat) return null;
    return (
      <div className="flex min-h-screen flex-col bg-background pb-20">
        <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border glass-nav px-4 py-3">
          <button type="button" aria-label="Back to chats" onClick={() => setActiveChat(null)}>
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <UserAvatar src={chat.avatar} seed={chat.id} name={chat.name} size="sm" className="ring-2 ring-primary/30" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-foreground">{chat.name}</h1>
            {chatUnavailable && <p className="text-[10px] text-destructive">Chat unavailable</p>}
            {chatApiMissing && !chatUnavailable && <p className="text-[10px] text-muted-foreground">Offline preview</p>}
          </div>
        </header>

        {chatUnavailable && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This event was canceled or you can no longer use this chat. You can go back to your chats or browse events
              from home.
            </p>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 custom-scrollbar">
            {messagesLoading && (
              <p className="py-6 text-center text-xs text-muted-foreground">Loading messages…</p>
            )}
            {!messagesLoading && messages.length === 0 && !chatUnavailable && (
              <p className="py-6 text-center text-xs text-muted-foreground">No messages yet. Say hello below.</p>
            )}
            {!messagesLoading && messages.length === 0 && chatUnavailable && (
              <p className="py-6 text-center text-xs text-muted-foreground">No messages to show.</p>
            )}
            {messages.map((m) =>
              m.kind === 'system' ? (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center"
                >
                  <div className="max-w-[92%] rounded-full bg-secondary/80 px-3 py-1.5 text-center text-[11px] text-muted-foreground">
                    <span>{m.text}</span>
                    <span className="ml-2 opacity-70">{m.time}</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.from === 'me' ? 'gradient-primary text-primary-foreground' : 'glass-card text-foreground'
                    }`}
                  >
                    {m.messageType === 'voice' && m.dataUrl ? (
                      <audio controls className="max-w-full">
                        <source src={m.dataUrl} type={m.mimeType || 'audio/webm'} />
                      </audio>
                    ) : m.messageType === 'file' && m.dataUrl ? (
                      <a
                        href={m.dataUrl}
                        download={m.fileName || 'attachment'}
                        className="underline underline-offset-2"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {m.fileName || 'Download attachment'}
                      </a>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    )}
                    <p
                      className={`mt-1 text-[10px] ${m.from === 'me' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}
                    >
                      {m.time}
                    </p>
                  </div>
                </motion.div>
              ),
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <AnimatePresence>
          {showEmoji && !chatUnavailable && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border bg-card px-4 py-3"
            >
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setInput((prev) => prev + emoji)}
                    className="text-xl transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="sticky bottom-16 flex items-center gap-2 border-t border-border glass-nav px-4 py-3">
          <button
            type="button"
            disabled={chatUnavailable}
            onClick={() => setShowEmoji(!showEmoji)}
            className={`text-muted-foreground hover:text-foreground disabled:opacity-40 ${showEmoji ? 'text-primary' : ''}`}
          >
            <Smile className="h-5 w-5" />
          </button>
          <input
            ref={attachmentInputRef}
            type="file"
            className="hidden"
            onChange={handlePickAttachment}
            accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar"
          />
          <button
            type="button"
            disabled={chatUnavailable || sending}
            onClick={() => attachmentInputRef.current?.click()}
            className="text-muted-foreground hover:text-foreground disabled:opacity-40"
            aria-label="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            value={input}
            disabled={chatUnavailable}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            placeholder={chatUnavailable ? 'Chat unavailable for this event' : 'Type a message…'}
            className="flex-1 rounded-full bg-secondary px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={chatUnavailable || sending}
            className={`text-muted-foreground hover:text-foreground disabled:opacity-40 ${isRecording ? 'text-destructive' : ''}`}
            onClick={() => void startRecording()}
            aria-label={isRecording ? 'Stop recording' : 'Record voice message'}
          >
            <Mic className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={chatUnavailable || sending || !input.trim()}
            onClick={() => void sendMessage()}
            className="rounded-full gradient-primary p-2.5 shadow-glow disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>

        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast((prev) => ({ ...prev, show: false }))} />
      <header className="sticky top-0 z-40 border-b border-border glass-nav px-4 py-3">
        <h1 className="text-lg font-bold text-gradient">Chats</h1>
        <p className="text-xs text-muted-foreground">Event conversations you joined or host</p>
      </header>

      <div className="mx-auto max-w-lg divide-y divide-border/50">
        {chatListLoading && <p className="px-4 py-6 text-xs text-muted-foreground">Loading your event chats…</p>}
        {!chatListLoading && chats.length === 0 && (
          <p className="px-4 py-6 text-xs text-muted-foreground">No event conversations yet. Join an event, then open chat from the event page.</p>
        )}
        {chats.map((chat) => (
          <button
            key={chat.id}
            type="button"
            onClick={() => setActiveChat(chat.id)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-secondary/30"
          >
            <div className="relative shrink-0">
              <UserAvatar src={chat.avatar} seed={chat.id} name={chat.name} size="lg" className="ring-2 ring-border" />
              <div className="absolute bottom-0 right-0 z-10 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{chat.name}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{chat.lastMsg}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[10px] text-muted-foreground">{chat.time}</span>
              {chat.unread > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[10px] font-bold text-primary-foreground">
                  {chat.unread}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
