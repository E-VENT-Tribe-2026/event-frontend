/** Window event: a chat message row changed. `detail.eventId` is set when known. */
export const CHAT_MESSAGES_CHANGED_EVENT = 'eventapp:chat-messages-changed';

/** Window event: events or attendees changed. Homepage / friends-going listen for this. */
export const EVENTS_CHANGED_EVENT = 'eventapp:events-changed';

export function notifyChatMessagesChanged(eventId?: string | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(CHAT_MESSAGES_CHANGED_EVENT, { detail: { eventId: eventId ?? null } }),
  );
}

export function notifyEventsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENTS_CHANGED_EVENT));
}

export function eventIdFromRealtimeRow(
  payload: { new?: Record<string, unknown>; old?: Record<string, unknown> },
): string | null {
  const row =
    payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old ?? {};
  const value = row.event_id ?? row.chat_id;
  return typeof value === 'string' && value ? value : null;
}
