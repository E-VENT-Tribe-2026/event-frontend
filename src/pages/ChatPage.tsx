import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentUser } from '@/lib/storage';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { mapApiEventToItem, parseEventsApiList, parseJoinedEventsApiList } from '@/lib/mapApiEvent';
import { fetchAuthUserFromToken, sameAuthUserId } from '@/lib/authProfile';
import { isEventUpcoming } from '@/lib/eventTime';
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
import { addCheckin, isCheckedIn } from '@/lib/checkin';
import {
  chatMessagesPath,
  encodeChatPayload,
  parseChatPayload,
} from '@/lib/chatPayload';
import ChatListView, { type ChatTab } from '@/pages/chat/ChatListView';
import ChatThreadView from '@/pages/chat/ChatThreadView';
import {
  CHAT_FETCH_TIMEOUT_MS,
  CHAT_LIST_POLL_MS,
  CHAT_OPEN_POLL_MS,
  CHAT_PEEK_LIMIT,
  ChatHttpError,
  type ChatEvent,
  type ChatMessage,
  LOCAL_MESSAGE_PREFIX,
  abortAfter,
  chatMessagesCacheKey,
  isAbortError,
  latestMessageMeta,
  mergeLiveMessages,
  messageFieldsFromPostBody,
  messageRowId,
  normalizeMessageList,
  sameLiveMessage,
  sameVisibleMessages,
} from '@/pages/chat/chatModel';

export {
  CHAT_FETCH_TIMEOUT_MS,
  CHAT_LIST_POLL_MS,
  CHAT_LIVE_POLL_MS,
  CHAT_OPEN_POLL_MS,
} from '@/pages/chat/chatModel';

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
  const [chatTab, setChatTab] = useState<ChatTab>('active');
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
  const messagesInFlightRef = useRef(false);
  const peekInFlightRef = useRef(false);
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

  const signedInUserId = user?.id ?? '';
  const resolveMeId = () => authUserId || signedInUserId;

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
        (sameAuthUserId(senderId, meId) || sameAuthUserId(senderId, signedInUserId));

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
    [authUserId, signedInUserId],
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
    if (!token || !signedInUserId) { if (!silent) setChatListLoading(false); return; }
    if (!silent && chatsRef.current.length === 0) setChatListLoading(true);
    const listFetch = abortAfter(CHAT_FETCH_TIMEOUT_MS);
    try {
      // Cached for 30 s (TTL.SHORT): a joined or created event shows up quickly,
      // and a failed request throws so it is never stored.
      const [joinedBody, organizedBody] = await Promise.all([
        cachedFetch(
          `/api/participants/my/events:chat:${signedInUserId}`,
          async () => {
            const res = await fetch(getApiUrl('/api/participants/my/events'), {
              headers: { Authorization: `Bearer ${token}` },
              signal: listFetch.signal,
            });
            if (!res.ok) throw new ChatHttpError(res.status);
            return res.json(); // an unreadable body rejects, so it is not stored
          },
          TTL.SHORT,
        ).catch(() => []),
        cachedFetch(
          `/api/events/my-events:chat:${signedInUserId}`,
          async () => {
            const res = await fetch(getApiUrl('/api/events/my-events'), {
              headers: { Authorization: `Bearer ${token}` },
              signal: listFetch.signal,
            });
            if (!res.ok) throw new ChatHttpError(res.status);
            return res.json(); // an unreadable body rejects, so it is not stored
          },
          TTL.SHORT,
        ).catch(() => ({})),
      ]);
      const joinedEvents = parseJoinedEventsApiList(joinedBody);
      const organizedRows = parseEventsApiList(organizedBody);
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
            unread: isChatUnread(signedInUserId, evt.id) ? 1 : 0,
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
        const fromUrl = mapped.find(
          (entry) => entry.id.toLowerCase() === selectedEventFromUrl.toLowerCase(),
        );
        if (fromUrl) {
          setActiveChat(fromUrl.id);
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
                unread: isChatUnread(signedInUserId, singleItem.id) ? 1 : 0,
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
      listFetch.cancel();
      if (!silent) setChatListLoading(false);
    }
  }, [token, signedInUserId, selectedEventFromUrl, handledSelectedParam, navigate]);

  loadChatListRef.current = loadChatList;
  useEffect(() => { void loadChatList(); }, [loadChatList]);

  const loadMessages = useCallback(
    async (eventId: string, silent = false) => {
      if (!token) return;
      // A 1s poll / live refresh must not start another GET while one is already
      // waiting â€” that used to increment the request id so the spinner never cleared.
      if (silent && messagesInFlightRef.current) return;
      const requestId = ++messagesRequestRef.current;
      const stillOpen = () => activeChatRef.current === eventId;
      const isCurrent = () => requestId === messagesRequestRef.current && stillOpen();
      const cacheKey = chatMessagesCacheKey(eventId, signedInUserId);
      const showRows = (rows: Record<string, unknown>[]) => {
        const next = rows.map(mapMessageRowRef.current).filter(Boolean) as ChatMessage[];
        if (next.length) rememberSeen(signedInUserId, eventId, next[next.length - 1].id);
        setMessages((prev) => {
          const merged = mergeLiveMessages(next, prev);
          return sameVisibleMessages(prev, merged) ? prev : merged;
        });
      };

      messagesInFlightRef.current = true;
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
      const request = abortAfter(CHAT_FETCH_TIMEOUT_MS);
      try {
        const primaryUrl = `${getApiUrl(chatMessagesPath(eventId))}?limit=100&page=1`;
        const res = await fetch(primaryUrl, {
          cache: 'no-store',
          signal: request.signal,
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
        if (!stillOpen()) return;
        if (body === null) {
          if (isCurrent()) {
            if (!saved) setMessages([]);
            setChatUnavailable(false);
            setChatApiMissing(true);
          }
          return;
        }
        const rows = normalizeMessageList(body);
        setCacheEntry(cacheKey, rows, TTL.SHORT);
        if (silent && !isCurrent()) return;
        showRows(rows);
        setChatUnavailable(false);
        setChatApiMissing(false);
      } catch (err) {
        if (isAbortError(err) && !isCurrent()) return;
        if (isCurrent() && !saved) setMessages([]); // network error
        if (isCurrent() && isAbortError(err)) setChatApiMissing(true);
      } finally {
        request.cancel();
        if (requestId === messagesRequestRef.current) messagesInFlightRef.current = false;
        // The open chat's own fetch must drop the spinner even if a later silent
        // refresh took over the request id. Switching chats still leaves B loading.
        if (stillOpen() && (!silent || requestId === messagesRequestRef.current)) {
          setMessagesLoading(false);
        }
      }
    },
    [token, signedInUserId],
  );
  loadMessagesRef.current = loadMessages;

  useEffect(() => {
    if (!activeChat) return;
    let cancelled = false;
    let interval = 0;
    const tick = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadMessages(activeChat, true);
    };
    void loadMessages(activeChat).finally(() => {
      if (cancelled || !getAuthToken()) return;
      interval = window.setInterval(tick, CHAT_OPEN_POLL_MS);
      window.addEventListener('focus', tick);
      document.addEventListener('visibilitychange', tick);
    });
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
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
          invalidate(chatMessagesCacheKey(openId, signedInUserId));
        } else {
          invalidate(chatMessagesCacheKey(openId, signedInUserId));
          void loadMessagesRef.current(openId, true);
        }
      }
      // List and other threads must still light up after the first chat was opened.
      // Do not require `activeChat` â€” going back to the list used to drop every later tag.
      if (eventId && !matchesOpen) {
        const sender = row?.sender_id ?? row?.user_id;
        noteIncomingChatMessage(signedInUserId, eventId, sender == null ? null : String(sender));
      }
      void loadChatListRef.current(true);
    };
    window.addEventListener(CHAT_MESSAGES_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CHAT_MESSAGES_CHANGED_EVENT, onChange);
  }, [signedInUserId]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const peek = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (peekInFlightRef.current) return;
      peekInFlightRef.current = true;
      const openId = activeChatRef.current;
      const others = chatsRef.current
        .filter((chat) => chat.id !== openId)
        .slice(0, CHAT_PEEK_LIMIT);
      try {
        await Promise.allSettled(
          others.map(async (chat) => {
            if (cancelled) return;
            const request = abortAfter(CHAT_FETCH_TIMEOUT_MS);
            try {
              const res = await fetch(`${getApiUrl(chatMessagesPath(chat.id))}?limit=1&page=1`, {
                cache: 'no-store',
                signal: request.signal,
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
              });
              if (!res.ok) return;
              const body = await res.json().catch(() => null);
              const latest = latestMessageMeta(normalizeMessageList(body));
              if (latest) {
                noteNewerChatMessage(signedInUserId, chat.id, latest.createdAt, latest.senderId, latest.messageId);
              }
            } catch {
              /* ignore a single chat peek */
            } finally {
              request.cancel();
            }
          }),
        );
      } finally {
        peekInFlightRef.current = false;
      }
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
  }, [token, signedInUserId]);

  const closeActiveChat = () => {
    const openId = activeChatRef.current;
    if (openId) {
      const lastId = messages.length ? messages[messages.length - 1].id : null;
      markChatRead(signedInUserId, openId, lastId);
    }
    setViewingChatId(null);
    setActiveChat(null);
  };

  useEffect(() => {
    setViewingChatId(activeChat);
    if (!activeChat) return;
    const lastId = messages.length ? messages[messages.length - 1].id : null;
    markChatRead(signedInUserId, activeChat, lastId);
    setChats((prev) => prev.map((c) => (c.id === activeChat ? { ...c, unread: 0 } : c)));
  }, [activeChat, messages, signedInUserId]);

  useEffect(() => {
    return () => setViewingChatId(null);
  }, []);

  useEffect(() => {
    const syncUnread = () => {
      setChats((prev) =>
        prev.map((c) => ({
          ...c,
          unread: activeChat === c.id ? 0 : isChatUnread(signedInUserId, c.id) ? 1 : 0,
        })),
      );
    };
    window.addEventListener(CHAT_UNREAD_CHANGED_EVENT, syncUnread);
    return () => window.removeEventListener(CHAT_UNREAD_CHANGED_EVENT, syncUnread);
  }, [activeChat, signedInUserId]);

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
        invalidate(chatMessagesCacheKey(eventId, signedInUserId));
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

  if (!user) return <Navigate to="/login" replace />;

  if (activeChat && activeChatObj) {
    return (
      <ChatThreadView
        chat={activeChatObj}
        messages={messages}
        messagesLoading={messagesLoading}
        chatUnavailable={chatUnavailable}
        chatApiMissing={chatApiMissing}
        sending={sending}
        input={input}
        onInputChange={setInput}
        showEmoji={showEmoji}
        onToggleEmoji={() => setShowEmoji((v) => !v)}
        showPoll={showPoll}
        onTogglePoll={() => setShowPoll((v) => !v)}
        pollQuestion={pollQuestion}
        onPollQuestionChange={setPollQuestion}
        pollOptions={pollOptions}
        onPollOptionsChange={setPollOptions}
        search={search}
        onSearchChange={setSearch}
        toast={toast}
        onCloseToast={() => setToast((prev) => ({ ...prev, show: false }))}
        onToast={(message, type) => setToast({ show: true, message, type })}
        onBack={closeActiveChat}
        onSend={(content) => void sendMessage(content)}
        onOpenProfile={(path) => navigate(path)}
        resolveMeId={resolveMeId}
        user={user}
        scrollerRef={scrollerRef}
        messagesEndRef={messagesEndRef}
        pinToBottomRef={pinToBottomRef}
      />
    );
  }

  return (
    <ChatListView
      chats={chats}
      chatTab={chatTab}
      onChatTabChange={setChatTab}
      search={search}
      onSearchChange={setSearch}
      loading={chatListLoading}
      userId={signedInUserId}
      onOpenChat={(chatId) => {
        setMessages([]);
        setActiveChat(chatId);
      }}
      toast={toast}
      onCloseToast={() => setToast((prev) => ({ ...prev, show: false }))}
    />
  );
}
