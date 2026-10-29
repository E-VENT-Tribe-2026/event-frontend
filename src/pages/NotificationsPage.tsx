import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  NOTIFICATION_PREFS_EVENT,
  notificationAllowed,
  readNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/accountSettings';
import { getCurrentUser, getNotifications, saveNotifications, type Notification } from '@/lib/storage';
import { getAuthToken, setAuthToken } from '@/lib/auth';
import { hasSignedInSession } from '@/lib/signedIn';
import { supabase } from '@/lib/supabase';
import { deleteNotification, deleteNotifications, markAllNotificationsRead, markNotificationRead, relativeTime, type ApiNotification } from '@/lib/notificationsApi';
import { CalendarClock, BellOff, RefreshCw, Info, Trash2, UserPlus, UserMinus, PlusCircle, CheckCheck, ExternalLink, Contact, UserCheck, AlertTriangle, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import TopBar from '@/components/TopBar';
import AppToast from '@/components/AppToast';
import WarningDialog from '@/components/WarningDialog';
import { useNotifications, invalidateNotifications } from '@/lib/queries';
import { userProfilePath, fetchIncomingRequests, FRIEND_REQUESTS_PATH, FRIENDS_CHANGED_EVENT, type FriendRequestItem } from '@/lib/friendsApi';
import { acknowledgeWarning } from '@/lib/warningsApi';

// Same text as WarningsGate shows when an acknowledgement fails.
const ACK_ERROR = "We couldn't confirm that you read this warning. Check your connection and try again.";

const WARN = 'hsl(38 92% 52%)';
const WARN_TEXT = 'hsl(38 95% 66%)';

type NotificationKind =
  | 'user_joined'
  | 'user_left'
  | 'event_created'
  | 'event_updated'
  | 'event_deleted'
  | 'event_cancelled'
  | 'reminder'
  | 'friend_request'
  | 'friend_request_accepted'
  | 'event_invitation'
  | 'event_chat'
  | 'warning'
  | 'other';

type UINotification = {
  id: string;
  kind: NotificationKind;
  message: string;
  relatedEventId: string | null;
  relatedUserId: string | null;
  eventTitle: string;
  createdAt: string | null;
  read: boolean;
  /** Warning notifications only. */
  warningId?: string | null;
  warningAcknowledged?: boolean;
  warningWithdrawn?: boolean;
};

const iconMap: Record<NotificationKind, React.ElementType> = {
  user_joined:     UserPlus,
  user_left:       UserMinus,
  event_created:   PlusCircle,
  event_updated:   Info,
  event_deleted:   Trash2,
  event_cancelled: BellOff,
  reminder:        CalendarClock,
  friend_request:  Contact,
  friend_request_accepted: UserCheck,
  event_invitation: CalendarClock,
  event_chat:      MessageCircle,
  warning:         AlertTriangle,
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
  friend_request:  'text-primary bg-primary/20',
  friend_request_accepted: 'text-green-500 bg-green-500/15',
  event_invitation: 'text-primary bg-primary/20',
  event_chat:      'text-primary bg-primary/20',
  warning:         '',
  other:           'text-primary bg-primary/20',
};

function isFriendKind(kind: NotificationKind): boolean {
  return kind === 'friend_request' || kind === 'friend_request_accepted';
}

/** A warning that still waits for acknowledgement: it cannot be selected or deleted. */
function isWaitingWarning(n: UINotification): boolean {
  return n.kind === 'warning' && !n.warningAcknowledged && !n.warningWithdrawn;
}

function normalizeKind(type: string): NotificationKind {
  const t = type.toLowerCase().trim();
  if (t === 'warning') return 'warning';
  if (t === 'friend_request_accepted') return 'friend_request_accepted';
  if (t === 'event_invitation') return 'event_invitation';
  if (t === 'event_chat' || t === 'chat' || t === 'chat_message' || t === 'new_message' || t === 'message' || t.includes('chat')) {
    return 'event_chat';
  }
  if (t.startsWith('friend_request')) return 'friend_request';
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
  const kind = normalizeKind(n.type);
  const base: UINotification = {
    id: n.id,
    kind,
    message: n.message || 'Event update',
    relatedEventId: n.related_event_id ?? null,
    relatedUserId: n.related_user_id ?? null,
    eventTitle: n.event_title ?? '',
    createdAt: n.created_at ?? null,
    read: Boolean(n.read),
  };
  if (kind !== 'warning') return base;
  return {
    ...base,
    // The administrator's reason; never replaced by a generic text.
    message: n.message ?? '',
    warningId: n.warning_id ?? null,
    warningAcknowledged: Boolean(n.warning_acknowledged),
    warningWithdrawn: Boolean(n.warning_withdrawn),
  };
}

function fromLocal(n: Notification): UINotification {
  return {
    id: n.id,
    kind: normalizeKind(n.type),
    message: n.description || n.title,
    relatedEventId: null,
    relatedUserId: null,
    eventTitle: '',
    createdAt: null,
    read: n.read,
  };
}

function fromPending(req: FriendRequestItem): UINotification {
  const name = req.user.full_name || req.user.display_name || req.user.username || 'Someone';
  return {
    id: `pending-${req.request_id}`,
    kind: 'friend_request',
    message: `${name} sent you a friend request`,
    relatedEventId: null,
    relatedUserId: req.user.id,
    eventTitle: '',
    createdAt: req.created_at ?? null,
    read: false,
  };
}

function isPendingItem(id: string): boolean {
  return id.startsWith('pending-');
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser);
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => readNotificationPrefs(getCurrentUser()?.id));

  useEffect(() => {
    const sync = () => setUser(getCurrentUser());
    window.addEventListener('eventapp:user-updated', sync);
    return () => window.removeEventListener('eventapp:user-updated', sync);
  }, []);

  useEffect(() => {
    const syncPrefs = () => setPrefs(readNotificationPrefs(getCurrentUser()?.id));
    window.addEventListener(NOTIFICATION_PREFS_EVENT, syncPrefs);
    return () => window.removeEventListener(NOTIFICATION_PREFS_EVENT, syncPrefs);
  }, []);

  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as 'success' | 'error' });
  const [subFilter, setSubFilter] = useState<'all' | 'friends' | 'activity' | 'updates' | 'reminders'>('all');
  const [search, setSearch] = useState('');
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

  // Friend requests still waiting for an answer (the same ones the Friends > Requests tab lists).
  const [pendingRequests, setPendingRequests] = useState<FriendRequestItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchIncomingRequests(1, 20)
        .then((page) => { if (!cancelled) setPendingRequests(Array.isArray(page.data) ? page.data : []); })
        .catch(() => { /* the notification list still works without it */ });
    };
    load();
    window.addEventListener(FRIENDS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(FRIENDS_CHANGED_EVENT, load);
    };
  }, []);

  const { data: rawNotifications, isLoading: queryLoading } = useNotifications();
  const [usingFallback, setUsingFallback] = useState(false);
  const loading = queryLoading;

  const [items, setItems] = useState<UINotification[]>([]);
  useEffect(() => {
    if (rawNotifications && Array.isArray(rawNotifications)) {
      const mapped = rawNotifications
        .filter((n) => notificationAllowed(n.type, prefs))
        .map(fromApi)
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
      setItems(mapped);
      setUsingFallback(false);
    } else if (!queryLoading) {
      setItems(getNotifications().filter((n) => notificationAllowed(n.type, prefs)).map(fromLocal));
      setUsingFallback(true);
    }
  }, [rawNotifications, queryLoading, prefs]);

  const unmatchedPending = useMemo(
    () =>
      prefs.friend_requests
        ? pendingRequests.filter((req) => !items.some((n) => n.kind === 'friend_request' && n.relatedUserId === req.user.id))
        : [],
    [pendingRequests, items, prefs.friend_requests],
  );

  const feedItems = useMemo(() => {
    const pendingItems = unmatchedPending.map(fromPending);
    return [...items, ...pendingItems].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [items, unmatchedPending]);

  const query = search.trim().toLowerCase();
  const matchesSearch = (n: UINotification) => {
    if (!query) return true;
    return (
      n.message.toLowerCase().includes(query)
      || n.eventTitle.toLowerCase().includes(query)
      || n.kind.replace(/_/g, ' ').includes(query)
    );
  };

  const filteredItems = useMemo(() => {
    let next = feedItems;
    if (subFilter === 'friends') {
      next = feedItems.filter((n) => isFriendKind(n.kind));
    } else if (subFilter === 'activity') {
      next = feedItems.filter((n) => n.kind === 'user_joined' || n.kind === 'user_left' || n.kind === 'event_created' || n.kind === 'event_invitation' || n.kind === 'event_chat');
    } else if (subFilter === 'updates') {
      next = feedItems.filter((n) => n.kind === 'event_updated' || n.kind === 'event_cancelled' || n.kind === 'event_deleted');
    } else if (subFilter === 'reminders') {
      next = feedItems.filter((n) => n.kind === 'reminder');
    }
    return next.filter(matchesSearch);
  }, [feedItems, subFilter, query]);

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

  const unreadCount = useMemo(() => feedItems.filter((n) => !n.read).length, [feedItems]);
  const activityCount = feedItems.filter((n) => n.kind === 'user_joined' || n.kind === 'user_left' || n.kind === 'event_created' || n.kind === 'event_invitation' || n.kind === 'event_chat').length;
  const updatesCount = feedItems.filter((n) => n.kind === 'event_updated' || n.kind === 'event_cancelled' || n.kind === 'event_deleted').length;
  const remindersCount = feedItems.filter((n) => n.kind === 'reminder').length;
  const friendsCount = feedItems.filter((n) => isFriendKind(n.kind)).length;
  const selectedCount = selectedIds.size;
  // Waiting warnings have no checkbox, so "Select All" never picks them.
  const selectableItems = filteredItems.filter((n) => !isWaitingWarning(n));
  const allSelected = selectableItems.length > 0 && selectedCount === selectableItems.length;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(selectableItems.map((n) => n.id)));
  };

  // Warning cards open the warning dialog; opening alone never marks them read.
  const [openWarning, setOpenWarning] = useState<UINotification | null>(null);
  const [ackSubmitting, setAckSubmitting] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);

  const onOpenWarning = (n: UINotification) => {
    setAckError(null);
    setOpenWarning(n);
  };

  const onAcknowledgeWarning = async () => {
    const n = openWarning;
    if (!n || ackSubmitting) return;
    const token = getAuthToken();
    if (!token || !n.warningId) {
      setAckError(ACK_ERROR);
      return;
    }
    setAckSubmitting(true);
    setAckError(null);
    try {
      await acknowledgeWarning(token, n.warningId);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, warningAcknowledged: true, read: true } : x)));
      setOpenWarning(null);
      invalidateNotifications();
    } catch {
      setAckError(ACK_ERROR);
    } finally {
      setAckSubmitting(false);
    }
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
    if (!n.read && !isPendingItem(n.id)) {
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
    if (n.kind === 'event_chat' && n.relatedEventId) {
      navigate(`/chat?eventId=${encodeURIComponent(n.relatedEventId)}`);
    } else if (n.relatedEventId) navigate(`/event/${n.relatedEventId}`);
    else if ((n.kind === 'friend_request' || n.kind === 'friend_request_accepted') && n.relatedUserId) {
      // The other person's profile, where the request can be answered.
      navigate(userProfilePath(n.relatedUserId, getCurrentUser()?.id));
    } else if (n.kind === 'friend_request') {
      // No person attached to the notification: fall back to the Requests list.
      navigate(FRIEND_REQUESTS_PATH);
    }
  };

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPendingItem(id)) return;
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
    if (n.read || isPendingItem(n.id)) return;
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

  // Amber warning card (mockup .nt.n-warn), on top of the normal card layout.
  const renderWarningCard = (n: UINotification, i: number) => {
    const waiting = isWaitingWarning(n);
    const isDeleting = deletingIds.has(n.id);
    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpenWarning(n);
      }
    };
    return (
      <motion.div
        key={n.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.02 }}
        role="button"
        tabIndex={0}
        aria-label="Warning from an administrator: tap to read"
        data-testid="warning-card"
        className="flex items-center gap-3.5 rounded-2xl glass-card p-4 transition-all shadow-sm cursor-pointer hover:!border-[hsl(38_92%_52%_/_.9)] outline-none focus-visible:ring-2 focus-visible:ring-[hsl(38_92%_52%)]"
        style={{
          border: '1px solid hsl(38 92% 52% / .6)',
          background: 'linear-gradient(145deg, hsl(38 55% 20% / .7), hsl(213 50% 14%))',
          boxShadow: `inset 4px 0 0 ${WARN}, 0 0 0 3px hsl(38 92% 52% / .08)`,
        }}
        onClick={() => onOpenWarning(n)}
        onKeyDown={onKeyDown}
      >
        {!waiting && (
          <input
            type="checkbox"
            checked={selectedIds.has(n.id)}
            onChange={() => toggleSelected(n.id)}
            onClick={(event) => event.stopPropagation()}
            className="h-4 w-4 shrink-0 accent-primary cursor-pointer rounded"
            aria-label="Select notification"
          />
        )}
        <div className="shrink-0 rounded-xl p-2.5 shadow-xs" style={{ background: 'hsl(38 92% 52% / .2)' }}>
          <AlertTriangle className="h-4 w-4" style={{ color: WARN_TEXT }} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!n.read && (
              <span className="h-2 w-2 rounded-full animate-pulse shrink-0" style={{ background: WARN }} data-testid="unread-dot" />
            )}
            <span className="font-bold uppercase" style={{ fontSize: 10, letterSpacing: '.06em', color: WARN_TEXT }}>
              Warning
            </span>
          </div>
          <p className="font-semibold text-foreground mt-0.5" style={{ fontSize: 13.5 }}>
            Warning from an administrator
          </p>
          {/* Plain text only: React escapes the reason. */}
          <p className="line-clamp-2 break-words mt-0.5" style={{ fontSize: 13, color: 'hsl(213 20% 82%)' }}>
            {n.message}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-semibold" style={{ fontSize: 12, color: WARN_TEXT }}>Tap to read ›</span>
            <span className="text-[10px] text-muted-foreground">· {relativeTime(n.createdAt)}</span>
          </div>
        </div>
        {!waiting && (
          <div className="shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              disabled={isDeleting}
              onClick={(e) => void onDelete(n.id, e)}
              className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
              aria-label="Delete notification"
              title="Delete notification"
            >
              {isDeleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  const renderCard = (n: UINotification, i: number) => {
    if (n.kind === 'warning') return renderWarningCard(n, i);
    const Icon = iconMap[n.kind];
    const isDeleting = deletingIds.has(n.id);
    return (
      <motion.div
        key={n.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.02 }}
        className={`flex items-center gap-3.5 rounded-2xl glass-card p-4 transition-all hover:border-border/80 shadow-sm cursor-pointer ${
          n.read ? 'opacity-60 bg-secondary/20' : 'border-l-4 border-l-primary bg-primary/[0.04]'
        }`}
        onClick={() => void onOpenNotification(n)}
      >
        {!isPendingItem(n.id) && (
          <input
            type="checkbox"
            checked={selectedIds.has(n.id)}
            onChange={() => toggleSelected(n.id)}
            onClick={(event) => event.stopPropagation()}
            className="h-4 w-4 shrink-0 accent-primary cursor-pointer rounded"
            aria-label="Select notification"
          />
        )}
        <div className={`shrink-0 rounded-xl p-2.5 shadow-xs ${colorMap[n.kind]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!n.read && <span className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />}
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{n.kind.replace(/_/g, ' ')}</span>
            <span className="text-[10px] text-muted-foreground">· {relativeTime(n.createdAt)}</span>
          </div>
          <p className="text-xs font-semibold text-foreground truncate mt-0.5">{n.message}</p>
          {n.eventTitle && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">Event: {n.eventTitle}</p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {n.relatedEventId && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(
                  n.kind === 'event_chat'
                    ? `/chat?eventId=${encodeURIComponent(n.relatedEventId!)}`
                    : `/event/${n.relatedEventId}`,
                );
              }}
              className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              {n.kind === 'event_chat' ? 'Chat' : 'View'} <ExternalLink className="h-3 w-3" />
            </button>
          )}
          {!n.read && !isPendingItem(n.id) && (
            <button
              type="button"
              disabled={markingId === n.id}
              onClick={(e) => void onMarkRead(n, e)}
              className="rounded-xl p-2 text-muted-foreground hover:bg-primary/15 hover:text-primary transition-colors"
              aria-label="Mark as read"
              title="Mark as read"
            >
              {markingId === n.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            </button>
          )}
          {!isPendingItem(n.id) && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={(e) => void onDelete(n.id, e)}
              className="rounded-xl p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
              aria-label="Delete notification"
              title="Delete notification"
            >
              {isDeleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  if (!hasSignedInSession()) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppToast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />

      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md">
        <TopBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search notifications..."
        />
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
          <h1 className="text-base font-bold text-foreground">Notifications</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onMarkAllRead()}
              disabled={loading || unreadCount === 0 || markingAll}
              className="rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
            >
              {markingAll ? 'Marking...' : 'Mark All Read'}
            </button>
            {unreadCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full gradient-primary text-[10px] font-bold text-primary-foreground shadow-glow">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-4 space-y-4">
        {/* Sub-filter Tabs */}
        <div
          role="tablist"
          aria-label="Notification filters"
          className="flex w-full gap-1.5 rounded-2xl glass-card p-1.5"
        >
          {[
            { id: 'all' as const, label: 'All', count: feedItems.length },
            { id: 'friends' as const, label: 'Friends', count: friendsCount },
            { id: 'activity' as const, label: 'Activity', count: activityCount },
            { id: 'updates' as const, label: 'Updates', count: updatesCount },
            { id: 'reminders' as const, label: 'Reminders', count: remindersCount },
          ].map((tab) => {
            const isActive = subFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => { setSubFilter(tab.id); setVisibleCount(PAGE_SIZE); }}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-xs font-semibold transition-all sm:flex-row sm:gap-1.5 sm:px-3 ${
                  isActive
                    ? 'gradient-primary text-primary-foreground shadow-glow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <span className="text-center leading-tight">{tab.label}</span>
                <span
                  className={`inline-flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    isActive
                      ? 'bg-background/25 text-inherit'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selection Bar */}
        {!loading && filteredItems.length > 0 && (
          <div className="flex items-center justify-between rounded-2xl glass-card px-4 py-2.5 text-xs">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="font-semibold text-foreground hover:text-primary transition-colors"
            >
              {allSelected ? 'Deselect All' : 'Select All'} ({selectedCount})
            </button>
            <button
              type="button"
              onClick={() => void onDeleteSelected()}
              disabled={selectedCount === 0 || deletingSelected}
              className="inline-flex items-center gap-1.5 font-semibold text-destructive transition-colors hover:opacity-80 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deletingSelected ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>
        )}

        {usingFallback && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-center text-xs text-amber-500 font-medium">
            Offline mode: showing local notifications only.
          </div>
        )}

        {loading && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <RefreshCw className="mx-auto mb-2.5 h-5 w-5 animate-spin text-primary" />
            Loading notifications...
          </div>
        )}

        {!loading && filteredItems.length > 0 && (
          subFilter === 'all' ? (
            <div className="space-y-2.5">
              {filteredItems.slice(0, visibleCount).map((n, i) => renderCard(n, i))}
            </div>
          ) : (
            <div className="space-y-4">
              {groupedItems.today.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">Today</p>
                  {groupedItems.today.slice(0, visibleCount).map((n, i) => renderCard(n, i))}
                </div>
              )}

              {groupedItems.yesterday.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 pt-2">Yesterday</p>
                  {groupedItems.yesterday.slice(0, Math.max(0, visibleCount - groupedItems.today.length)).map((n, i) => renderCard(n, i))}
                </div>
              )}

              {groupedItems.earlier.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 pt-2">Earlier</p>
                  {groupedItems.earlier.slice(0, Math.max(0, visibleCount - groupedItems.today.length - groupedItems.yesterday.length)).map((n, i) => renderCard(n, i))}
                </div>
              )}
            </div>
          )
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="py-24 text-center glass-card rounded-3xl p-8 space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/60">
              <BellOff className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {subFilter === 'reminders'
                ? 'No reminders right now'
                : subFilter === 'activity'
                  ? 'No recent activity'
                  : subFilter === 'updates'
                    ? 'No recent updates'
                    : subFilter === 'friends'
                      ? 'No friend request notifications'
                      : 'No notifications found'}
            </p>
            <p className="text-xs text-muted-foreground">You're all caught up in this category!</p>
          </div>
        )}
      </div>

      {!loading && filteredItems.length > 0 && (
        <div className="mx-auto max-w-2xl px-4 pt-4 pb-6">
          {filteredItems.length > visibleCount ? (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full rounded-2xl border border-border/60 bg-secondary/50 py-3 text-xs font-semibold text-primary hover:bg-secondary transition-colors"
            >
              Show more · {filteredItems.length - visibleCount} remaining
            </button>
          ) : visibleCount > PAGE_SIZE ? (
            <button
              type="button"
              onClick={() => setVisibleCount(PAGE_SIZE)}
              className="w-full rounded-2xl border border-border/60 bg-secondary/50 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Show less
            </button>
          ) : null}
        </div>
      )}

      <BottomNav />

      <WarningDialog
        warning={openWarning ? { id: openWarning.warningId ?? openWarning.id, reason: openWarning.message } : null}
        mode={openWarning && isWaitingWarning(openWarning) ? 'acknowledge' : 'review'}
        submitting={ackSubmitting}
        error={ackError}
        onAcknowledge={() => void onAcknowledgeWarning()}
        onClose={() => setOpenWarning(null)}
      />
    </div>
  );
}