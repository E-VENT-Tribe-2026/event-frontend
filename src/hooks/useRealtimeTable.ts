import { useEffect, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export type RealtimePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

interface RealtimeOptions {
  table: string;
  filter?: string;
  event?: RealtimeEvent;
  enabled?: boolean;
  schema?: string;
  onData: (payload: RealtimePayload) => void;
}

/**
 * Subscribe to Postgres changes on one table. Safe to call from any screen:
 * no-ops when Supabase is unconfigured or `enabled` is false.
 * `onData` is read from a ref so an inline callback does not resubscribe every render.
 */
export function useRealtimeTable({
  table,
  filter,
  event = '*',
  enabled = true,
  schema = 'public',
  onData,
}: RealtimeOptions) {
  const onDataRef = useRef(onData);
  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    if (!supabase || !enabled || !table) return;

    const channelName = `realtime-${schema}-${table}-${filter || 'all'}-${event}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event,
          schema,
          table,
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          onDataRef.current(payload as RealtimePayload);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, filter, event, enabled, schema]);
}
