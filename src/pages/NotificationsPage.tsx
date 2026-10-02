import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getNotifications, saveNotifications, type Notification } from '@/lib/storage';
import { getAuthToken, setAuthToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { deleteNotification, deleteNotifications, markAllNotificationsRead, markNotificationRead, relativeTime, type ApiNotification, type RelatedUser } from '@/lib/notificationsApi';
import { ArrowLeft, CalendarClock, BellOff, RefreshCw, Info, Trash2, UserPlus, UserMinus, PlusCircle, CheckCheck, ExternalLink, Contact, UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';
import { useNotifications, invalidateNotifications } from '@/lib/queries';

type NotificationKind =
  | 'user_joined'
  | 'user_left'
  | 'event_created'
  | 'event_updated'
  | 'event_deleted'
  | 'event_cancelled'
  | 'reminder'
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'other';

type UINotification = {
  id: string;
  kind: NotificationKind;
  message: string;
  relatedEventId: string | null;
  eventTitle: string;
  createdAt: string | null;
  read: boolean;
  /** The user this notification is about — friend requests only (ticket #243). */
  relatedUserId: string | null;
  relatedUser: RelatedUser | null;
};

const iconMap: Record<NotificationKind, React.ElementType> = {
  user_joined:               UserPlus,
  user_left:                 UserMinus,
  event_created:             PlusCircle,
  event_updated:             Info,
  event_deleted:             Trash2,
  event_cancelled:           BellOff,
  reminder:                  CalendarClock,
  friend_request_received:   Contact,
  friend_request_accepted:   UserCheck,
  other:                     Info,
};

const colorMap: Record<NotificationKind, string> = {
  user_joined:               'text-green-500 bg-green-500/15',
  user_left:                 'text-destructive bg-destructive/15',
  event_created:             'text-green-500 bg-green-500/15',
  event_updated:             'text-primary bg-primary/20',
  event_deleted:             'text-destructive bg-destructive/15',
  event_cancelled:           'text-destructive bg-destructive/15',
  reminder:                  'text-accent bg-accent/20',
  friend_request_received:   'text-accent bg-accent/20',
  friend_request_accepted:   'text-green-500 bg-green-500/15',
  other:                     'text-primary bg-primary/20',
};

function normalizeKind(type: string): NotificationKind {
  const t = type.toLowerCase().trim();
  if (t === 'friend_request_received') return 'friend_request_received';
  if (t === 'friend_request_accepted') return 'friend_request_accepted';
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
    relatedUserId: n.related_user_id ?? null,
    relatedUser: n.related_user ?? null,
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
    relatedUserId: null,
    relatedUser: null,
  };
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser);

  useEffect(() => {
    const sync = () => setUser(getCurrentUser());
    window.addEventListener('eventapp:user-updated', sync);
    return () => window.removeEventListener('eventapp:user-updated', sync);
  }, []);

  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as 'success' | 'error' });
  const [subFilter, setSubFilter] = useState<'all' | 'activity' | 'updates' | 'reminders'>('all');
  const [visibleCount, setVisibleCount] = useState(10);
  const PAGE_SIZE = 10;

  const resolveToken = async (): Promise<string | null> => {
    const existing = getAuthToken();
    if (existing) return existing;
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token ?? null;
    if (token) { setAuthToken(token); return token; }
    return null;
  };

  const { data: rawNotifications, isLoading: queryLoading } = useNotifications();
  const [usingFallback, setUsingFallback] = useState(false);
  const loading = queryLoading;

  const [items, setItems] = useState<UINotification[]>([]);
  useEffect(() => {
    if (rawNotifications && Array.isArray(rawNotifications)) {
      const mapped = rawNotifications
        .map(fromApi)
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
      setItems(mapped);
      setUsingFallback(false);
    } else if (!queryLoading) {
      setItems(getNotifications().map(fromLocal));
      setUsingFallback(true);
    }
  }, [rawNotifications, queryLoading]);

  // Filter items based on selected tab category
  const filteredItems = useMemo(() => {
    if (subFilter === 'activity') {
      return items.filter(n => n.kind === 'user_joined' || n.kind === 'user_left' || n.kind === 'event_created');
    }
    if (subFilter === 'updates') {
      return items.filter(n => n.kind === 'event_updated' || n.kind === 'event_cancelled' || n.kind === 'event_deleted');
    }
    if (subFilter === 'reminders') {
      return items.filter(n => n.kind === 'reminder');
    }
    return items;
  }, [items, subFilter]);

  // Group filtered items by time buckets: Today, Yesterday, Earlier
  const groupedItems = useMemo(() => {
    const today: UINotification[] = [];
    const yesterday: UINotification[] = [];
    const earlier: UINotification[] = [];

    const now = new Date();
    const isToday = (d: Date) => d.toDateString() === now.toDateString();
    const isYesterday = (d: Date) => {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return d.toDateString() === y.toDateString();
    };

    filteredItems.forEach((n) => {
      if (!n.createdAt) {
        earlier.push(n);
        return;
      }
      const d = new Date(n.createdAt);
      if (isToday(d)) today.push(n);
      else if (isYesterday(d)) yesterday.push(n);
      else earlier.push(n);
    });

    return { today, yesterday, earlier };
  }, [filteredItems]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);
  const selectedCount = selectedIds.size;
  const allSelected = filteredItems.length > 0 && selectedCount === filteredItems.length;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filteredItems.map((n) => n.id)));
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
    else if (n.relatedUserId) navigate(`/profile/${n.relatedUserId}`);
  };

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingIds((prev) => new Set(prev).add(id));
    const token = await resolveToken();
    try {
      if (token) await deleteNotification(token, id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      invalidateNotifications();
    } catch {
      setToast({ show: true, message: 'Could not delete notification.', type: 'error' });
    } finally {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const onMarkRead = async (n: UINotification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    const token = await resolveToken();
    if (token) {
      try {
        setMarkingId(n.id);
        await markNotificationRead(token, n.id);
      } catch {
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: false } : x)));
        setToast({ show: true, message: 'Could not mark as read.', type: 'error' });
      } finally {
        setMarkingId(null);
      }
    } else {
      saveNotifications(getNotifications().map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
  };

  // Render individual notification card helper
  const renderCard = (n: UINotification, i: number) => {
    const Icon = iconMap[n.kind];
    const isDeleting = deletingIds.has(n.id);
    return (
      <motion.div
        key={n.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.02 }}
        className={`flex items-center gap-3 rounded-2xl glass-card px-4 py-3.5 transition-all hover:border-border/60 ${n.read ? 'opacity-55' : 'border-l-4 border-l-primary shadow-sm bg-primary/[0.02]'}`}
        onClick={() => void onOpenNotification(n)}
      >
        <input
          type="checkbox"
          checked={selectedIds.has(n.id)}
          onChange={() => toggleSelected(n.id)}
          onClick={(event) => event.stopPropagation()}
          className="h-4 w-4 shrink-0 accent-primary cursor-pointer"
          aria-label={`Select notification`}
        />
        <div className={`shrink-0 rounded-xl p-2.5 ${colorMap[n.kind]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 cursor-pointer">
          <div className="flex items-center gap-2">
            {!n.read && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{n.kind.replace(/_/g, ' ')}</span>
            <span className="text-[10px] text-muted-foreground">· {relativeTime(n.createdAt)}</span>
          </div>
          <p className="text-sm font-medium text-foreground truncate mt-0.5">{n.message}</p>
          {n.eventTitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">Event: {n.eventTitle}</p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {n.relatedEventId && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/event/${n.relatedEventId}`); }}
              className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              View <ExternalLink className="h-3 w-3" />
            </button>
          )}
          {!n.read && (
            <button
              type="button"
              disabled={markingId === n.id}
              onClick={(e) => void onMarkRead(n, e)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              aria-label="Mark as read"
            >
              {markingId === n.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            type="button"
            disabled={isDeleting}
            onClick={(e) => void onDelete(n.id, e)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            aria-label="Delete notification"
          >
            {isDeleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-full glass-card p-2 hover:bg-secondary/80 transition-colors active:scale-90"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Notifications</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onMarkAllRead()}
            disabled={loading || unreadCount === 0 || markingAll}
            className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
          >
            {markingAll ? 'Marking...' : 'Mark Read'}
          </button>
          {unreadCount > 0 && (
            <span className="rounded-full gradient-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-glow">
              {unreadCount}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-3 space-y-3">
        {/* Sub-filter Tabs */}
        <div className="flex rounded-xl bg-secondary/60 p-1 gap-1">
          <button
            type="button"
            onClick={() => { setSubFilter('all'); setVisibleCount(10); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${subFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => { setSubFilter('activity'); setVisibleCount(10); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${subFilter === 'activity' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Activity
          </button>
          <button
            type="button"
            onClick={() => { setSubFilter('updates'); setVisibleCount(10); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${subFilter === 'updates' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Updates
          </button>
          <button
            type="button"
            onClick={() => { setSubFilter('reminders'); setVisibleCount(10); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${subFilter === 'reminders' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Reminders
          </button>
        </div>

        {!loading && filteredItems.length > 0 && (
          <div className="flex items-center justify-between rounded-xl glass-card px-3.5 py-2 text-xs">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="font-medium text-foreground hover:text-primary transition-colors"
            >
              {allSelected ? 'Deselect All' : 'Select All'} ({selectedCount})
            </button>
            <button
              type="button"
              onClick={() => void onDeleteSelected()}
              disabled={selectedCount === 0 || deletingSelected}
              className="inline-flex items-center gap-1 font-semibold text-destructive transition-colors hover:opacity-80 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deletingSelected ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}

        {usingFallback && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 text-center text-xs text-amber-500">
            Offline mode: showing local notifications only.
          </div>
        )}

        {loading && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <RefreshCw className="mx-auto mb-2 h-4 w-4 animate-spin" />
            Loading notifications...
          </div>
        )}

        {/* Grouped Time Buckets */}
        {!loading && filteredItems.length > 0 && (
          <div className="space-y-4">
            {groupedItems.today.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">Today</p>
                {groupedItems.today.slice(0, visibleCount).map((n, i) => renderCard(n, i))}
              </div>
            )}

            {groupedItems.yesterday.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 pt-2">Yesterday</p>
                {groupedItems.yesterday.slice(0, Math.max(0, visibleCount - groupedItems.today.length)).map((n, i) => renderCard(n, i))}
              </div>
            )}

            {groupedItems.earlier.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 pt-2">Earlier</p>
                {groupedItems.earlier.slice(0, Math.max(0, visibleCount - groupedItems.today.length - groupedItems.yesterday.length)).map((n, i) => renderCard(n, i))}
              </div>
            )}
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="py-20 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/60">
              <BellOff className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {subFilter === 'reminders' ? 'No reminders right now' : subFilter === 'activity' ? 'No recent activity' : subFilter === 'updates' ? 'No recent updates' : 'No notifications found'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">You're all caught up in this category!</p>
          </div>
        )}
      </div>

      {!loading && filteredItems.length > 0 && (
        <div className="mx-auto max-w-lg px-4 py-4">
          {filteredItems.length > visibleCount ? (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full rounded-xl border border-border py-2.5 text-xs font-semibold text-primary hover:bg-secondary/50 transition-colors"
            >
              Show more · {filteredItems.length - visibleCount} remaining
            </button>
          ) : visibleCount > PAGE_SIZE ? (
            <button
              type="button"
              onClick={() => setVisibleCount(PAGE_SIZE)}
              className="w-full rounded-xl border border-border py-2.5 text-xs font-semibold text-primary hover:bg-secondary/50 transition-colors"
            >
              Show less
            </button>
          ) : null}
        </div>
      )}
      <BottomNav />
    </div>
  );
}