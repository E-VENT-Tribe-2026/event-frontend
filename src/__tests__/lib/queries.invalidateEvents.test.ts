import { describe, it, expect, vi, afterEach } from 'vitest';
import { queryClient } from '@/lib/queryClient';
import { invalidateEvents } from '@/lib/queries';
import { getCached, setCacheEntry, TTL } from '@/lib/queryCache';
import { EVENTS_CHANGED_EVENT } from '@/lib/realtimeEvents';

describe('invalidateEvents', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refreshes homepage event queries, drops participant cache, and notifies listeners', () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    setCacheEntry('/api/participants/e1/participants:tok', [{ user_id: 'f1' }], TTL.SHORT);
    const onChange = vi.fn();
    window.addEventListener(EVENTS_CHANGED_EVENT, onChange);

    invalidateEvents();

    const keys = spy.mock.calls.map((call) => {
      const arg = call[0] as { queryKey?: unknown } | undefined;
      return arg?.queryKey;
    });
    expect(keys).toEqual(
      expect.arrayContaining([
        ['events'],
        ['event'],
        ['recommendations'],
        ['myEvents'],
        ['joinedEvents'],
        ['participants'],
        ['maxPrice'],
      ]),
    );
    expect(getCached('/api/participants/e1/participants:tok')).toBeNull();
    expect(onChange).toHaveBeenCalled();
    window.removeEventListener(EVENTS_CHANGED_EVENT, onChange);
  });
});
