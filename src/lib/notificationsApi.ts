import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { cachedFetch, invalidate, TTL } from '@/lib/queryCache';

export type ApiNotification = {
  id: string;
  type: string;
  message: string;
  related_event_id?: string | null;
  event_title?: string | null;
  created_at?: string | null;
  read?: boolean;
  actor_name?: string | null;
};

function normalizeType(type: string): string {
  // Return the raw type as-is so the UI can map it to the correct icon/color.
  // Only normalize legacy aliases.
  const t = type.toLowerCase().trim();
  if (t === 'cancelled') return 'event_cancelled';
  if (t === 'cancellation') return 'event_cancelled';
  return t;
}

export function relativeTime(isoDate?: string | null): string {
  if (!isoDate) return '';
  // The API returns naive UTC datetimes without a timezone suffix (e.g. "2026-04-24T22:29:18.064253").
  // Browsers parse those as local time, which gives wrong results.
  // Append 'Z' to force UTC interpretation when no offset is present.
  const normalized = /[Zz]$|[+-]\d{2}:\d{2}$/.test(isoDate) ? isoDate : `${isoDate}Z`;
  const ts = new Date(normalized).getTime();
  if (Number.isNaN(ts)) return '';
  const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return sec === 1 ? 'just now' : `${sec} seconds ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? '1 minute ago' : `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? '1 hour ago' : `${hr} hours ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return d === 1 ? 'yesterday' : `${d} days ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return w === 1 ? '1 week ago' : `${w} weeks ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo === 1 ? '1 month ago' : `${mo} months ago`;
  const yr = Math.floor(d / 365);
  return yr === 1 ? '1 year ago' : `${yr} years ago`;
}

export async function fetchNotifications(token: string): Promise<ApiNotification[]> {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' } as const;
  const cacheKey = `/api/notifications/all:${token.slice(-16)}`; // key per token suffix
  return cachedFetch(
    cacheKey,
    async () => {
      const res = await fetch(getApiUrl(`${API_ENDPOINTS.NOTIFICATIONS}/all?limit=100&page=1`), { headers });
      if (!res.ok) throw new Error('Failed to load notifications');
      const body = (await res.json().catch(() => [])) as any;
      const rawRows = Array.isArray(body) ? body
        : Array.isArray(body?.data) ? body.data
        : Array.isArray(body?.notifications) ? body.notifications
        : [];
      return rawRows.map((row: any) => ({
        id: String(row.id ?? ''),
        type: normalizeType(String(row.type ?? 'update')),
        message: String(row.message ?? ''),
        related_event_id:
          typeof row.related_event_id === 'string'
            ? row.related_event_id
            : typeof row.event_id === 'string'
              ? row.event_id
              : null,
        event_title:
          typeof row.event_title === 'string'
            ? row.event_title
            : typeof row.related_event_title === 'string'
              ? row.related_event_title
              : null,
        created_at: typeof row.created_at === 'string' ? row.created_at : null,
        read: Boolean(row.read ?? row.is_read),
        actor_name:
          typeof row.actor_name === 'string' ? row.actor_name
          : typeof row.sender_name === 'string' ? row.sender_name
          : typeof row.triggered_by_name === 'string' ? row.triggered_by_name
          : typeof row.profiles?.full_name === 'string' ? row.profiles.full_name
          : null,
      })) as ApiNotification[];
    },
    TTL.SHORT, // 30s — notifications should feel fresh
  );
}

export async function markNotificationRead(token: string, id: string): Promise<void> {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' } as const;
  let res = await fetch(getApiUrl(`${API_ENDPOINTS.NOTIFICATIONS}/${id}/read`), {
    method: 'PATCH',
    headers,
  });
  if (!res.ok && res.status === 404) {
    res = await fetch(getApiUrl(`${API_ENDPOINTS.NOTIFICATIONS}/mark-read/${id}`), {
      method: 'PATCH',
      headers,
    });
  }
  if (!res.ok) throw new Error('Failed to mark notification read');
  // Invalidate so next fetch gets fresh unread count
  invalidate(`/api/notifications/all:${token.slice(-16)}`);
}

export async function deleteNotification(token: string, id: string): Promise<void> {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' } as const;
  let res = await fetch(getApiUrl(`${API_ENDPOINTS.NOTIFICATIONS}/${id}`), { method: 'DELETE', headers });
  if (!res.ok && res.status === 404) {
    res = await fetch(getApiUrl(`${API_ENDPOINTS.NOTIFICATIONS}/delete/${id}`), { method: 'DELETE', headers });
  }
  if (!res.ok) throw new Error('Failed to delete notification');
  // Invalidate so next fetch reflects deletion
  invalidate(`/api/notifications/all:${token.slice(-16)}`);
}
