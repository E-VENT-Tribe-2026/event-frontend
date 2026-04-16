import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';

export type ApiNotification = {
  id: string;
  type: string;
  message: string;
  related_event_id?: string | null;
  event_title?: string | null;
  created_at?: string | null;
  read?: boolean;
};

function normalizeType(type: string): string {
  const t = type.toLowerCase().trim();
  if (t === 'cancellation' || t === 'cancelled') return 'cancellation';
  if (t === 'reminder') return 'reminder';
  if (t === 'update') return 'update';
  return 'update';
}

export function relativeTime(isoDate?: string | null): string {
  if (!isoDate) return '';
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return '';
  const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export async function fetchNotifications(token: string): Promise<ApiNotification[]> {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' } as const;
  // Support both backend shapes:
  // 1) GET /api/notifications
  // 2) GET /api/notifications/all?page=1&limit=50
  let res = await fetch(getApiUrl(API_ENDPOINTS.NOTIFICATIONS), { headers });
  if (!res.ok && res.status === 404) {
    res = await fetch(getApiUrl(`${API_ENDPOINTS.NOTIFICATIONS}/all?page=1&limit=50`), { headers });
  }
  if (!res.ok) throw new Error('Failed to load notifications');
  const body = (await res.json().catch(() => [])) as any;
  const rawRows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
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
  }));
}

export async function markNotificationRead(token: string, id: string): Promise<void> {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' } as const;
  // Support both backend shapes:
  // 1) PATCH /api/notifications/{id}/read
  // 2) PATCH /api/notifications/mark-read/{id}
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
}
