import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getNotifications, saveNotifications, type Notification } from '@/lib/storage';
import { getAuthToken, setAuthToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { deleteNotifications, fetchNotifications, markAllNotificationsRead, markNotificationRead, relativeTime, type ApiNotification } from '@/lib/notificationsApi';
import { ArrowLeft, CalendarClock, BellOff, RefreshCw, Info, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';

type UINotification = {
  id: string;
  type: 'update' | 'cancellation' | 'reminder';
  message: string;
  relatedEventId: string | null;
  eventTitle: string;
  createdAt: string | null;
  read: boolean;
};

const iconMap = {
  update: Info,
  cancellation: BellOff,
  reminder: CalendarClock,
};

const colorMap = {
  update: 'text-primary bg-primary/20',
  cancellation: 'text-destructive bg-destructive/15',
  reminder: 'text-accent bg-accent/20',
};

function normalizeLegacyType(type: string): 'update' | 'cancellation' | 'reminder' {
  const t = type.toLowerCase().trim();
  if (t.includes('cancel')) return 'cancellation';
  if (t.includes('reminder')) return 'reminder';
  return 'update';
}

function fromApi(n: ApiNotification): UINotification {
  return {
    id: n.id,
    type: normalizeLegacyType(n.type),
    message: n.message || 'Event update',
    relatedEventId: n.related_event_id ?? null,
    eventTitle: n.event_title ?? '',
    createdAt: n.created_at ?? null,
    read: Boolean(n.read),
  };
}

function fromLocal(n: Notification): UINotification {
  return {
    id: n.id,
    type: normalizeLegacyType(n.type),
    message: n.description || n.title,
    relatedEventId: null,
    eventTitle: '',
    createdAt: null,
    read: n.read,
  };
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [items, setItems] = useState<UINotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as 'success' | 'error' });

  const resolveToken = async (): Promise<string | null> => {
    const existing = getAuthToken();
    if (existing) return existing;
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token ?? null;
    if (token) {
      setAuthToken(token);
      return token;
    }
    return null;
  };

  const loadNotifications = async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const token = await resolveToken();
    if (!token) {
      setItems(getNotifications().map(fromLocal));
      setUsingFallback(true);
      setLoading(false);
      return;
    }
    try {
      const apiRows = await fetchNotifications(token);
      const mapped = apiRows.map(fromApi).sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      setItems(mapped);
      setSelectedIds(new Set());
      setUsingFallback(false);
    } catch {
      setItems(getNotifications().map(fromLocal));
      setSelectedIds(new Set());
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user?.id]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);
  const selectedCount = selectedIds.size;
  const allSelected = items.length > 0 && selectedCount === items.length;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((n) => n.id)));
  };

  const onDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || deletingSelected) return;

    const previousItems = items;
    setItems((prev) => prev.filter((n) => !selectedIds.has(n.id)));
    setSelectedIds(new Set());
    setDeletingSelected(true);

    const token = await resolveToken();
    try {
      if (token) {
        await deleteNotifications(token, ids);
      } else {
        saveNotifications(getNotifications().filter((n) => !ids.includes(n.id)));
      }
      setToast({ show: true, message: 'Selected notifications deleted.', type: 'success' });
    } catch {
      setItems(previousItems);
      setSelectedIds(new Set(ids));
      setToast({ show: true, message: 'Could not delete selected notifications.', type: 'error' });
    } finally {
      setDeletingSelected(false);
    }
  };

  const onMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    const previousItems = items;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setMarkingAll(true);
    const token = await resolveToken();
    try {
      if (token) {
        await markAllNotificationsRead(token);
      } else {
        saveNotifications(getNotifications().map((n) => ({ ...n, read: true })));
      }
      setToast({ show: true, message: 'All notifications marked as read.', type: 'success' });
    } catch {
      setItems(previousItems);
      setToast({ show: true, message: 'Could not mark all as read.', type: 'error' });
    } finally {
      setMarkingAll(false);
    }
  };

  const onOpenNotification = async (n: UINotification) => {
    let localReadUpdated = false;
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      localReadUpdated = true;
      const token = await resolveToken();
      if (token) {
        try {
          setMarkingId(n.id);
          await markNotificationRead(token, n.id);
        } catch {
          if (localReadUpdated) {
            setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: false } : x)));
          }
          setToast({ show: true, message: 'Could not mark as read.', type: 'error' });
        } finally {
          setMarkingId(null);
        }
      } else {
        const legacy = getNotifications().map((x) => (x.id === n.id ? { ...x, read: true } : x));
        saveNotifications(legacy);
      }
    }
    if (n.relatedEventId) navigate(`/event/${n.relatedEventId}`);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Notifications</h1>
        <button
          type="button"
          onClick={() => void onMarkAllRead()}
          disabled={loading || unreadCount === 0 || markingAll}
          className="ml-auto rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {markingAll ? 'Marking...' : 'Mark All as Read'}
        </button>
        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {unreadCount} unread
        </span>
      </header>

      <div className="mx-auto max-w-lg divide-y divide-border">
        {!loading && items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
            >
              {allSelected ? 'Clear Selection' : 'Select All'}
            </button>
            <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
            <button
              type="button"
              onClick={() => void onDeleteSelected()}
              disabled={selectedCount === 0 || deletingSelected}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deletingSelected ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>
        )}
        {usingFallback && (
          <div className="px-4 py-2 text-center text-xs text-amber-500">
            Offline mode: showing local notifications only.
          </div>
        )}
        {loading && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <RefreshCw className="mx-auto mb-2 h-4 w-4 animate-spin" />
            Loading notifications...
          </div>
        )}
        {!loading && items.map((n, i) => {
          const Icon = iconMap[n.type];
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex cursor-pointer items-start gap-3 px-4 py-4 ${n.read ? 'opacity-60' : ''}`}
              onClick={() => void onOpenNotification(n)}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(n.id)}
                onChange={() => toggleSelected(n.id)}
                onClick={(event) => event.stopPropagation()}
                className="mt-3 h-4 w-4 shrink-0 accent-primary"
                aria-label={`Select notification ${i + 1}`}
              />
              <div className={`shrink-0 rounded-full p-2.5 ${colorMap[n.type]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{n.type}</p>
                <p className="text-sm font-medium text-foreground">{n.message}</p>
                {n.eventTitle && (
                  <p className="text-xs text-muted-foreground">Event: {n.eventTitle}</p>
                )}
                {n.relatedEventId && (
                  <p className="text-[10px] text-primary">Open event details</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-xs text-muted-foreground">{relativeTime(n.createdAt)}</span>
                {markingId === n.id && <span className="text-[10px] text-muted-foreground">Saving…</span>}
              </div>
            </motion.div>
          );
        })}
        {!loading && items.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No notifications yet</div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
