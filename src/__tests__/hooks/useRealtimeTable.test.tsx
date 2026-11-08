import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

const { subscribe, on, removeChannel, channelFn } = vi.hoisted(() => {
  const subscribe = vi.fn();
  const on = vi.fn();
  const removeChannel = vi.fn();
  const channel = { on, subscribe };
  on.mockReturnValue(channel);
  subscribe.mockReturnValue(channel);
  const channelFn = vi.fn(() => channel);
  return { subscribe, on, removeChannel, channelFn };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: channelFn,
    removeChannel,
  },
}));

describe('useRealtimeTable', () => {
  beforeEach(() => {
    subscribe.mockClear();
    on.mockClear();
    removeChannel.mockClear();
    channelFn.mockClear();
    const channel = { on, subscribe };
    on.mockReturnValue(channel);
    subscribe.mockReturnValue(channel);
    channelFn.mockReturnValue(channel);
  });

  it('subscribes to postgres changes and tears the channel down', () => {
    const onData = vi.fn();
    const { unmount } = renderHook(() =>
      useRealtimeTable({
        table: 'friend_requests',
        filter: 'receiver_id=eq.user-1',
        event: 'INSERT',
        onData,
      }),
    );

    expect(channelFn).toHaveBeenCalled();
    expect(on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'friend_requests',
        filter: 'receiver_id=eq.user-1',
      },
      expect.any(Function),
    );
    expect(subscribe).toHaveBeenCalled();

    const handler = on.mock.calls[0][2] as (payload: unknown) => void;
    const payload = { eventType: 'INSERT', new: { id: 'r1' }, old: {} };
    handler(payload);
    expect(onData).toHaveBeenCalledWith(payload);

    unmount();
    expect(removeChannel).toHaveBeenCalled();
  });

  it('does not subscribe when disabled', () => {
    renderHook(() =>
      useRealtimeTable({
        table: 'notifications',
        enabled: false,
        onData: vi.fn(),
      }),
    );
    expect(channelFn).not.toHaveBeenCalled();
  });
});
