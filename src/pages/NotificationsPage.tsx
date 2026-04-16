import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getNotifications, saveNotifications, type Notification } from '@/lib/storage';
import { getAuthToken, setAuthToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { fetchNotifications, markNotificationRead, relativeTime, type ApiNotification } from '@/lib/notificationsApi';
import { ArrowLeft, CalendarClock, BellOff, RefreshCw, Info } from 'lucide-react';
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
      setUsingFallback(false);
    } catch {
      setItems(getNotifications().map(fromLocal));
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user?.id]);

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
          {unreadCount} unread
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
