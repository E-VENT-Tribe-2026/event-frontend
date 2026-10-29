/** Window event: a chat message row changed. `detail.eventId` is set when known. */
export const CHAT_MESSAGES_CHANGED_EVENT = 'eventapp:chat-messages-changed';

/** Window event: events or attendees changed. Homepage / friends-going listen for this. */
export const EVENTS_CHANGED_EVENT = 'eventapp:events-changed';

export function notifyChatMessagesChanged(
  eventId?: string | null,
  row?: Record<string, unknown> | null,
) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(CHAT_MESSAGES_CHANGED_EVENT, {
      detail: { eventId: eventId ?? null, row: row ?? null },
    }),
  );
}

export function notifyEventsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENTS_CHANGED_EVENT));
}

function asEventId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function eventIdFromRealtimeRow(
  payload: { new?: Record<string, unknown>; old?: Record<string, unknown> },
): string | null {
  const row =
    payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old ?? {};
  const nested =
    row.event && typeof row.event === 'object' ? (row.event as Record<string, unknown>) : null;
  return asEventId(
    row.event_id ??
      row.chat_id ??
      row.eventId ??
      row.chatId ??
      nested?.id ??
      nested?.event_id ??
      (payload as { event_id?: unknown }).event_id,
  );
}
