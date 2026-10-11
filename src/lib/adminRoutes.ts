/** The panel's own event details page. Used by the Events tab and by events listed in a user's details. */
export function adminEventPath(eventId: string): string {
  return `/admin/events/${encodeURIComponent(eventId)}`;
}
