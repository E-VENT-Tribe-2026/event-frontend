import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getNotifications, saveNotifications, type Notification } from '@/lib/storage';
import { getAuthToken, setAuthToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchNotifications, markNotificationRead, relativeTime, deleteNotification, type ApiNotification } from '@/lib/notificationsApi';
import { ArrowLeft, CalendarClock, BellOff, RefreshCw, Info, Trash2, UserPlus, UserMinus, PlusCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';

type NotificationKind =
  | 'user_joined'
  | 'user_left'
  | 'event_created'
  | 'event_updated'
  | 'event_deleted'
  | 'event_cancelled'
  | 'reminder'
  | 'other';

type UINotification = {
  id: string;
  kind: NotificationKind;
  message: string;
  relatedEventId: string | null;
  eventTitle: string;
  createdAt: string | null;
  read: boolean;
};

const iconMap: Record<NotificationKind, React.ElementType> = {
  user_joined:     UserPlus,
  user_left:       UserMinus,
  event_created:   PlusCircle,
  event_updated:   Info,
  event_deleted:   Trash2,
  event_cancelled: BellOff,
  reminder:        CalendarClock,
  other:           Info,
};

const colorMap: Record<NotificationKind, string> = {
  user_joined:     'text-green-500 bg-green-500/15',
  user_left:       'text-destructive bg-destructive/15',
  event_created:   'text-green-500 bg-green-500/15',
  event_updated:   'text-primary bg-primary/20',
  event_deleted:   'text-destructive bg-destructive/15',
  event_cancelled: 'text-destructive bg-destructive/15',
  reminder:        'text-accent bg-accent/20',
  other:           'text-primary bg-primary/20',
};

function normalizeKind(type: string): NotificationKind {
  const t = type.toLowerCase().trim();
  if (t === 'user_joined' || t.includes('joined')) return 'user_joined';
  if (t === 'user_left' || t.includes('left')) return 'user_left';
  if (t === 'event_created' || t.includes('creat')) return 'event_created';
  if (t === 'event_updated' || t.includes('updat')) return 'event_updated';
  if (t === 'event_deleted' || t.includes('delet')) return 'event_deleted';
  if (t === 'event_cancelled' || t.includes('cancel')) return 'event_cancelled';
  if (t === 'reminder') return 'reminder';
  return 'other';
}

function fromApi(n: ApiNotification): UINotification {
  return {
    id: n.id,
    kind: normalizeKind(n.type),
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
    kind: normalizeKind(n.type),
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
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as 'success' | 'error' });
  const [visibleCount, setVisibleCount] = useState(5);
  const PAGE_SIZE = 5;

  const resolveToken = async (): Promise<string | null> => {
    const existing = getAuthToken();
    if (existing) return existing;
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token ?? null;
    if (token) { setAuthToken(token); return token; }
    return null;
  };

  const loadNotifications = async () => {
    if (!user) { setItems([]); setLoading(false); return; }
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
      setUsingFallback(false);
      setVisibleCount(5);
    } catch {
      setItems(getNotifications().map(fromLocal));
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadNotifications(); }, [user?.id]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

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

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingIds((prev) => new Set(prev).add(id));
    const token = await resolveToken();
    try {
      if (token) await deleteNotification(token, id);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch {
      setToast({ show: true, message: 'Could not delete notification.', type: 'error' });
    } finally {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
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
        <span className="ml-auto rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
          {unreadCount} unread · {items.length} total
        </span>
      </header>

      <div className="mx-auto max-w-lg divide-y divide-border">
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
        {!loading && items.slice(0, visibleCount).map((n, i) => {
          const Icon = iconMap[n.kind];
          const isDeleting = deletingIds.has(n.id);
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex cursor-pointer items-start gap-3 px-4 py-4 ${n.read ? 'opacity-60' : ''}`}
              onClick={() => void onOpenNotification(n)}
            >
              <div className={`shrink-0 rounded-full p-2.5 ${colorMap[n.kind]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{n.kind.replace(/_/g, ' ')}</p>
                <p className="text-sm font-medium text-foreground">{n.message}</p>
                {n.eventTitle && (
                  <p className="text-xs text-muted-foreground">Event: {n.eventTitle}</p>
                )}
                {n.relatedEventId && (
                  <p className="text-[10px] text-primary">Open event details</p>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <span className="text-xs text-muted-foreground">{relativeTime(n.createdAt)}</span>
                {markingId === n.id && <span className="text-[10px] text-muted-foreground">Saving…</span>}
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={(e) => void onDelete(n.id, e)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 transition-colors"
                  aria-label="Delete notification"
                >
                  {isDeleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </motion.div>
          );
        })}
        {!loading && items.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No notifications yet</div>
        )}
      </div>

      {!loading && items.length > 0 && (
        <div className="mx-auto max-w-lg px-4 py-4">
          {visibleCount < items.length ? (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full rounded-xl border border-border py-3 text-sm font-semibold text-primary hover:bg-secondary/50 transition-colors"
            >
              Show more · {items.length - visibleCount} remaining
            </button>
          ) : items.length > PAGE_SIZE ? (
            <p className="text-center text-xs text-muted-foreground">All {items.length} notifications shown</p>
          ) : null}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
