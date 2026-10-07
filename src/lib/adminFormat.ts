import type { AdminEventPerson } from '@/lib/adminApi';

/** "Nov 20, 2026, 09:00 AM". Falls back to the raw text if the date can't be read. */
export function formatAdminDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** An event is cancelled when the backend flags it either way. */
export function isEventCancelled(event: { status?: string; is_cancelled?: boolean }): boolean {
  return Boolean(event.is_cancelled) || event.status === 'cancelled';
}

/** The username to show under a name, or null when the person has none yet. */
export function personUsername(person: Pick<AdminEventPerson, 'username'>): string | null {
  const name = person.username?.trim();
  return name ? name : null;
}
