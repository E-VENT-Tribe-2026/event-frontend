/** Window event: the persisted unread-chat set changed. */
export const CHAT_UNREAD_CHANGED_EVENT = 'eventapp:chat-unread-changed';

const STORAGE_KEY = 'eventapp:chat-unread';

type UserBucket = {
  unread: string[];
  lastReadAt: Record<string, string>;
  lastSeenId: Record<string, string>;
};

type Store = Record<string, UserBucket>;

let viewingChatId: string | null = null;

function userKey(userId: string | null | undefined): string {
  return String(userId || '').trim() || 'anon';
}

function asBucket(value: unknown): UserBucket {
  if (Array.isArray(value)) {
    return {
      unread: value.filter((id): id is string => typeof id === 'string' && Boolean(id)),
      lastReadAt: {},
      lastSeenId: {},
    };
  }
  if (value && typeof value === 'object') {
    const raw = value as Partial<UserBucket> & { ids?: string[] };
    const unread = Array.isArray(raw.unread) ? raw.unread : Array.isArray(raw.ids) ? raw.ids : [];
    return {
      unread: unread.filter((id): id is string => typeof id === 'string' && Boolean(id)),
      lastReadAt: raw.lastReadAt && typeof raw.lastReadAt === 'object' ? { ...raw.lastReadAt } : {},
      lastSeenId: raw.lastSeenId && typeof raw.lastSeenId === 'object' ? { ...raw.lastSeenId } : {},
    };
  }
  return { unread: [], lastReadAt: {}, lastSeenId: {} };
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    const store: Store = {};
    for (const [key, value] of Object.entries(parsed)) {
      store[key] = asBucket(value);
    }
    return store;
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHAT_UNREAD_CHANGED_EVENT));
  }
}

function getBucket(userId: string | null | undefined): UserBucket {
  return asBucket(readStore()[userKey(userId)]);
}

function saveBucket(userId: string | null | undefined, bucket: UserBucket) {
  const store = readStore();
  store[userKey(userId)] = {
    unread: [...new Set(bucket.unread.filter(Boolean))],
    lastReadAt: bucket.lastReadAt,
    lastSeenId: bucket.lastSeenId,
  };
  writeStore(store);
}

function sameId(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase());
}

export function getUnreadChatIds(userId: string | null | undefined): string[] {
  return [...new Set(getBucket(userId).unread)];
}

export function countUnreadChats(userId: string | null | undefined): number {
  return getUnreadChatIds(userId).length;
}

export function isChatUnread(userId: string | null | undefined, eventId: string): boolean {
  return Boolean(eventId) && getUnreadChatIds(userId).includes(eventId);
}

export function markChatUnread(userId: string | null | undefined, eventId: string): void {
  if (!eventId) return;
  const bucket = getBucket(userId);
  if (bucket.unread.includes(eventId)) return;
  bucket.unread.push(eventId);
  saveBucket(userId, bucket);
}

export function markChatRead(
  userId: string | null | undefined,
  eventId: string,
  lastMessageId?: string | null,
): void {
  if (!eventId) return;
  const bucket = getBucket(userId);
  bucket.unread = bucket.unread.filter((id) => !sameId(id, eventId));
  // Local clock vs server created_at: later peeks must have a timestamp to
  // compare, otherwise only the first unseen chat ever lights up.
  bucket.lastReadAt[eventId] = new Date().toISOString();
  if (lastMessageId) bucket.lastSeenId[eventId] = String(lastMessageId);
  saveBucket(userId, bucket);
}

/** Record the latest message the user has actually seen, without changing unread. */
export function rememberSeen(
  userId: string | null | undefined,
  eventId: string,
  messageId: string | null | undefined,
): void {
  if (!eventId || !messageId) return;
  const bucket = getBucket(userId);
  if (bucket.lastSeenId[eventId] === messageId) return;
  bucket.lastSeenId[eventId] = messageId;
  saveBucket(userId, bucket);
}

export function setViewingChatId(eventId: string | null): void {
  viewingChatId = eventId;
}

export function getViewingChatId(): string | null {
  return viewingChatId;
}

/** Record an incoming message unless the user is already reading that chat (or sent it). */
export function noteIncomingChatMessage(
  userId: string | null | undefined,
  eventId: string | null | undefined,
  senderId?: string | null,
): void {
  if (!eventId) return;
  if (sameId(viewingChatId, eventId)) return;
  if (senderId && userId && sameId(senderId, userId)) return;
  markChatUnread(userId, eventId);
}

/**
 * Compare a fetched latest message with what this user has already seen.
 * First sighting only records a baseline so existing history is not marked new.
 */
export function noteNewerChatMessage(
  userId: string | null | undefined,
  eventId: string,
  createdAt: string,
  senderId?: string | null,
  messageId?: string | null,
): void {
  if (!eventId || !createdAt) return;
  if (sameId(viewingChatId, eventId)) return;
  if (senderId && userId && sameId(senderId, userId)) return;
  const bucket = getBucket(userId);
  const seenId = bucket.lastSeenId[eventId];
  const lastRead = bucket.lastReadAt[eventId];
  const nextId = messageId ? String(messageId) : '';
  const prevId = seenId ? String(seenId) : '';
  if (nextId && prevId) {
    if (nextId === prevId) return;
    markChatUnread(userId, eventId);
    return;
  }
  if (!prevId && !lastRead) {
    bucket.lastReadAt[eventId] = createdAt;
    if (nextId) bucket.lastSeenId[eventId] = nextId;
    saveBucket(userId, bucket);
    return;
  }
  const lastMs = Date.parse(lastRead || '');
  const nextMs = Date.parse(createdAt);
  if (Number.isFinite(lastMs) && Number.isFinite(nextMs) && nextMs > lastMs) {
    markChatUnread(userId, eventId);
  }
}
