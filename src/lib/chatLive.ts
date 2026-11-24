import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { notifyChatMessagesChanged } from '@/lib/realtimeEvents';

const CHANNEL_PREFIX = 'event-chat:';
const BROADCAST_EVENT = 'message';
const LIVE_HOLD_MS = 15_000;

type LivePayload = {
  eventId: string;
  row: Record<string, unknown>;
};

type ChatChannel = {
  on: (...args: unknown[]) => ChatChannel;
  subscribe: (cb?: (status: string) => void) => ChatChannel;
  send: (payload: unknown) => unknown;
};

const channels = new Map<string, ChatChannel>();
const subscribed = new Set<string>();
const pendingSends = new Map<string, LivePayload[]>();

export function chatLiveHoldUntil(now = Date.now()): number {
  return now + LIVE_HOLD_MS;
}

function broadcastPayload(item: LivePayload) {
  return {
    type: 'broadcast' as const,
    event: BROADCAST_EVENT,
    payload: item,
  };
}

function flushPending(eventId: string, channel: ChatChannel) {
  const queued = pendingSends.get(eventId) ?? [];
  pendingSends.delete(eventId);
  for (const item of queued) {
    void channel.send(broadcastPayload(item));
  }
}

function ensureChannel(eventId: string): ChatChannel | null {
  if (!supabase || !eventId) return null;
  const existing = channels.get(eventId);
  if (existing) return existing;

  const channel = supabase.channel(`${CHANNEL_PREFIX}${eventId}`, {
    config: { broadcast: { self: false } },
  }) as ChatChannel;
  channel
    .on('broadcast', { event: BROADCAST_EVENT }, (message: { payload?: LivePayload }) => {
      const data = message?.payload;
      if (!data?.eventId || !data.row || typeof data.row !== 'object') return;
      notifyChatMessagesChanged(data.eventId, data.row);
    })
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      subscribed.add(eventId);
      flushPending(eventId, channel);
    });
  channels.set(eventId, channel);
  return channel;
}

function dropChannel(eventId: string) {
  const channel = channels.get(eventId);
  if (channel && supabase) void supabase.removeChannel(channel);
  channels.delete(eventId);
  subscribed.delete(eventId);
  pendingSends.delete(eventId);
}

/** Keep a broadcast room open for each listed event chat. */
export function syncChatLiveChannels(eventIds: string[]) {
  const wanted = new Set(eventIds.map((id) => String(id || '').trim()).filter(Boolean));
  for (const id of wanted) ensureChannel(id);
  for (const id of [...channels.keys()]) {
    if (!wanted.has(id)) dropChannel(id);
  }
}

export function dropAllChatLiveChannels() {
  for (const id of [...channels.keys()]) dropChannel(id);
}

/** Push a row to everyone else in the event chat. No-ops without Supabase. */
export function publishLiveChatMessage(eventId: string, row: Record<string, unknown>) {
  if (!eventId || !row) return;
  const channel = ensureChannel(eventId);
  if (!channel) return;
  const item = { eventId, row };
  if (subscribed.has(eventId)) {
    void channel.send(broadcastPayload(item));
    return;
  }
  const queued = pendingSends.get(eventId) ?? [];
  queued.push(item);
  pendingSends.set(eventId, queued);
}

export function useChatLiveChannels(eventIds: string[]) {
  const key = eventIds
    .map((id) => String(id || '').trim())
    .filter(Boolean)
    .sort()
    .join(',');

  useEffect(() => {
    syncChatLiveChannels(key ? key.split(',') : []);
  }, [key]);

  useEffect(() => () => dropAllChatLiveChannels(), []);
}
