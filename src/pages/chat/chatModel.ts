import { chatMessagesPath } from '@/lib/chatPayload';

export type ChatEvent = {
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

export type ChatMessage = {
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

/** Fallback only — live broadcast is the primary path. */
export const CHAT_OPEN_POLL_MS = 8_000;
export const CHAT_LIST_POLL_MS = 15_000;
export const CHAT_LIVE_POLL_MS = CHAT_OPEN_POLL_MS;
export const CHAT_FETCH_TIMEOUT_MS = 12_000;
export const CHAT_PEEK_LIMIT = 8;

export const LOCAL_MESSAGE_PREFIX = 'local:';

export function abortAfter(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => window.clearTimeout(timeoutId),
  };
}

export function isAbortError(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError');
}

export function isLocalChatMessage(id: string) {
  return id.startsWith(LOCAL_MESSAGE_PREFIX);
}

export function sameLiveMessage(a: ChatMessage, b: ChatMessage): boolean {
  return a.from === b.from && a.text === b.text && a.messageType === b.messageType;
}

/** Keep optimistic / just-broadcast rows while the GET is still a beat behind. */
export function mergeLiveMessages(server: ChatMessage[], prev: ChatMessage[]): ChatMessage[] {
  const now = Date.now();
  const extras = prev.filter((local) => {
    if (server.some((row) => row.id === local.id || sameLiveMessage(row, local))) return false;
    if (isLocalChatMessage(local.id)) return true;
    return Boolean(local.liveUntil && local.liveUntil > now);
  });
  return extras.length ? [...server, ...extras] : server;
}

export function messageFieldsFromPostBody(
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

export function messageRowId(row: Record<string, unknown>): string {
  if (row.id != null && String(row.id).trim()) return String(row.id);
  const sender = row.sender_id || row.user_id || row.created_by || '';
  const at = row.created_at || row.sent_at || row.timestamp || '';
  const content = row.content || row.message || row.text || '';
  return `${sender}:${at}:${String(content).slice(0, 48)}`;
}

export function sameVisibleMessages(prev: ChatMessage[], next: ChatMessage[]): boolean {
  if (prev.length !== next.length) return false;
  return prev.every((m, i) => m.id === next[i].id && m.text === next[i].text && m.from === next[i].from);
}

export function isNearBottom(el: HTMLElement, threshold = 96): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

export function latestMessageMeta(
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

export function isExpiredOver48h(eventDate: string): boolean {
  if (!eventDate) return false;
  const normalized = /[Zz]|[+-]\d{2}:\d{2}$/.test(eventDate) ? eventDate : `${eventDate}T00:00:00Z`;
  const ts = new Date(normalized).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts > 48 * 60 * 60 * 1000;
}

export function formatDateSeparator(dateKey: string): string {
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

export function chatMessagesCacheKey(eventId: string, userId: string) {
  return `${chatMessagesPath(eventId)}:${userId}`;
}

/** Thrown inside a cached fetcher so a failed response is never stored in the cache. */
export class ChatHttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`Chat request failed with status ${status}`);
    this.status = status;
  }
}

export function normalizeMessageList(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== 'object') return [];
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.data)) return b.data as Record<string, unknown>[];
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  return [];
}
