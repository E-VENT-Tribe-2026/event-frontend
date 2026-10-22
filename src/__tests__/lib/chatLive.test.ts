import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CHAT_MESSAGES_CHANGED_EVENT } from '@/lib/realtimeEvents';

const { subscribe, on, send, removeChannel, channelFn } = vi.hoisted(() => {
  const subscribe = vi.fn();
  const on = vi.fn();
  const send = vi.fn();
  const removeChannel = vi.fn();
  const channel = { on, subscribe, send };
  on.mockReturnValue(channel);
  subscribe.mockImplementation((cb?: (status: string) => void) => {
    cb?.('SUBSCRIBED');
    return channel;
  });
  const channelFn = vi.fn(() => channel);
  return { subscribe, on, send, removeChannel, channelFn };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: channelFn,
    removeChannel,
  },
}));

describe('chatLive', () => {
  beforeEach(() => {
    subscribe.mockClear();
    on.mockClear();
    send.mockClear();
    removeChannel.mockClear();
    channelFn.mockClear();
    const channel = { on, subscribe, send };
    on.mockReturnValue(channel);
    subscribe.mockImplementation((cb?: (status: string) => void) => {
      cb?.('SUBSCRIBED');
      return channel;
    });
    channelFn.mockReturnValue(channel);
  });

  it('broadcasts a sent row and fans incoming broadcasts into the chat event', async () => {
    const { publishLiveChatMessage, syncChatLiveChannels, dropAllChatLiveChannels } =
      await import('@/lib/chatLive');
    const heard = vi.fn();
    window.addEventListener(CHAT_MESSAGES_CHANGED_EVENT, heard);

    syncChatLiveChannels(['evt-1']);
    expect(channelFn).toHaveBeenCalledWith('event-chat:evt-1', expect.any(Object));

    publishLiveChatMessage('evt-1', { id: 9, content: 'On my way', event_id: 'evt-1' });
    expect(send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'message',
      payload: { eventId: 'evt-1', row: { id: 9, content: 'On my way', event_id: 'evt-1' } },
    });

    const handler = on.mock.calls[0]?.[2] as (msg: { payload: unknown }) => void;
    handler({ payload: { eventId: 'evt-1', row: { id: 10, content: 'Here' } } });
    expect(heard).toHaveBeenCalled();

    dropAllChatLiveChannels();
    expect(removeChannel).toHaveBeenCalled();
    window.removeEventListener(CHAT_MESSAGES_CHANGED_EVENT, heard);
  });
});
