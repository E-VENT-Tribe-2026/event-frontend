import { describe, it, expect } from 'vitest';
import { eventIdFromRealtimeRow } from '@/lib/realtimeEvents';

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
});
