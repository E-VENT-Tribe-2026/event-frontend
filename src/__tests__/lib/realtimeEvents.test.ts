import { describe, it, expect, vi } from 'vitest';
import { eventIdFromRealtimeRow, EVENTS_CHANGED_EVENT, notifyEventsChanged } from '@/lib/realtimeEvents';

describe('eventIdFromRealtimeRow', () => {
  it('reads event_id from an insert payload', () => {
    expect(eventIdFromRealtimeRow({ new: { event_id: 'e1' }, old: {} })).toBe('e1');
  });

  it('falls back to the old row on delete', () => {
    expect(eventIdFromRealtimeRow({ new: {}, old: { event_id: 'e2' } })).toBe('e2');
  });

  it('returns null when neither row has an event id', () => {
    expect(eventIdFromRealtimeRow({ new: { id: 'm1' }, old: {} })).toBeNull();
  });

  it('stringifies a numeric event id', () => {
    expect(eventIdFromRealtimeRow({ new: { event_id: 42 }, old: {} })).toBe('42');
  });

  it('reads a nested event object when event_id is missing', () => {
    expect(eventIdFromRealtimeRow({ new: { event: { id: 'nested-9' } }, old: {} })).toBe('nested-9');
  });
});

describe('notifyEventsChanged', () => {
  it('dispatches a window event for homepage listeners', () => {
    const onChange = vi.fn();
    window.addEventListener(EVENTS_CHANGED_EVENT, onChange);
    notifyEventsChanged();
    expect(onChange).toHaveBeenCalled();
    window.removeEventListener(EVENTS_CHANGED_EVENT, onChange);
  });
});
