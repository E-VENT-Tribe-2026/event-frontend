import { useEffect, useState } from 'react';
import {
  MapPin,
  Search,
  Calendar,
  ArrowLeft,
  Loader2,
  LayoutGrid,
  Music,
  Cpu,
  Utensils,
  Dumbbell,
  Palette,
  Gamepad2,
  Trophy,
  Film,
  BookOpen,
  Plane,
  Coffee,
  Network,
  Leaf,
  Heart,
  Users,
  Sparkles,
} from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { mapApiEventToItem, parseEventsApiList } from '@/lib/mapApiEvent';
import type { EventItem } from '@/lib/storage';
import AdminMapView from './AdminMapView';

export interface UserViewState {
  active: boolean;
  screen: 'home' | 'map';
  eventId: string | null;
  categoryFilter: string;
  searchQuery: string;
}

interface AdminUserViewProps {
  state: UserViewState;
  onStateChange: (s: UserViewState) => void;
  onBack: () => void;
  /**
   * Optional. If provided, the map popup's "View event details" button calls this
   * (e.g. to open the admin events page). If omitted, the event opens in this view.
   */
  onOpenEvent?: (eventId: string) => void;
}

interface PublicEvent {
  id: string;
  title: string;
  date: string;
  end_date?: string;
  time?: string;
  category?: string;
  organizer_name?: string;
  organizer_handle?: string;
  organizer_avatar?: string;
  location?: string;
  description?: string;
  participants_count?: number;
  max_participants?: number;
  is_free?: boolean;
  price?: number;
  is_featured?: boolean;
}

const CATS = [
  { id: 'All', icon: LayoutGrid, iconColor: '#94a3b8', activeBg: 'rgba(148,163,184,0.15)', activeBorderColor: 'rgba(148,163,184,0.5)' },
  { id: 'Music', icon: Music, iconColor: '#a78bfa', activeBg: 'rgba(167,139,250,0.15)', activeBorderColor: 'rgba(167,139,250,0.5)' },
  { id: 'Tech', icon: Cpu, iconColor: '#60a5fa', activeBg: 'rgba(96,165,250,0.15)', activeBorderColor: 'rgba(96,165,250,0.5)' },
  { id: 'Food', icon: Utensils, iconColor: '#fb923c', activeBg: 'rgba(251,146,60,0.15)', activeBorderColor: 'rgba(251,146,60,0.5)' },
  { id: 'Fitness', icon: Dumbbell, iconColor: '#4ade80', activeBg: 'rgba(74,222,128,0.15)', activeBorderColor: 'rgba(74,222,128,0.5)' },
  { id: 'Art', icon: Palette, iconColor: '#f472b6', activeBg: 'rgba(244,114,182,0.15)', activeBorderColor: 'rgba(244,114,182,0.5)' },
  { id: 'Gaming', icon: Gamepad2, iconColor: '#818cf8', activeBg: 'rgba(129,140,248,0.15)', activeBorderColor: 'rgba(129,140,248,0.5)' },
  { id: 'Sports', icon: Trophy, iconColor: '#34d399', activeBg: 'rgba(52,211,153,0.15)', activeBorderColor: 'rgba(52,211,153,0.5)' },
  { id: 'Movies', icon: Film, iconColor: '#f87171', activeBg: 'rgba(248,113,113,0.15)', activeBorderColor: 'rgba(248,113,113,0.5)' },
  { id: 'Study', icon: BookOpen, iconColor: '#facc15', activeBg: 'rgba(250,204,21,0.15)', activeBorderColor: 'rgba(250,204,21,0.5)' },
  { id: 'Travel', icon: Plane, iconColor: '#38bdf8', activeBg: 'rgba(56,189,248,0.15)', activeBorderColor: 'rgba(56,189,248,0.5)' },
  { id: 'Coffee', icon: Coffee, iconColor: '#fbbf24', activeBg: 'rgba(251,191,36,0.15)', activeBorderColor: 'rgba(251,191,36,0.5)' },
  { id: 'Networking', icon: Network, iconColor: '#22d3ee', activeBg: 'rgba(34,211,238,0.15)', activeBorderColor: 'rgba(34,211,238,0.5)' },
  { id: 'Wellness', icon: Leaf, iconColor: '#2dd4bf', activeBg: 'rgba(45,212,191,0.15)', activeBorderColor: 'rgba(45,212,191,0.5)' },
] as const;

const CATEGORY_HUE: Record<string, number> = {
  music: 290,
  tech: 200,
  technology: 200,
  food: 18,
  sports: 150,
  sport: 150,
  art: 330,
  arts: 330,
  gaming: 255,
  fitness: 140,
  movies: 0,
  study: 50,
  travel: 195,
  coffee: 35,
  networking: 220,
  wellness: 170,
  other: 271,
};

function getCategoryHue(category?: string): number {
  if (!category) return 271;
  return CATEGORY_HUE[category.toLowerCase()] ?? 271;
}

function formatDate(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function formatDateTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * The API returns start_datetime, location_name, cost, max_capacity and an
 * `organizer` object. This converts one API row into the flat shape the page uses,
 * so the cards, the detail screen and the map all read the same fields.
 */
function normalizeEvent(raw: any): PublicEvent {
  const o = raw?.organizer ?? null;
  const cost = Number(raw?.cost ?? raw?.price ?? 0) || 0;
  return {
    id: raw.id,
    title: raw.title ?? '',
    date: raw.date ?? raw.start_datetime ?? '',
    end_date: raw.end_datetime ?? undefined,
    time: raw.time ?? undefined,
    category: raw.category ?? undefined,
    organizer_name:
      raw.organizer_name ?? o?.full_name ?? o?.display_name ?? o?.username ?? undefined,
    organizer_handle: raw.organizer_handle ?? o?.username ?? undefined,
    organizer_avatar: raw.organizer_avatar ?? o?.avatar_url ?? undefined,
    location: raw.location ?? raw.location_name ?? undefined,
    description: raw.description ?? undefined,
    participants_count: raw.participants_count ?? undefined,
    max_participants: raw.max_participants ?? raw.max_capacity ?? undefined,
    is_free: raw.is_free ?? cost === 0,
    price: raw.price ?? cost,
    is_featured: raw.is_featured ?? false,
  };
}

/** mapApiEventToItem does not carry the organizer object, so add it from the raw row. */
function toMapItem(row: any): EventItem {
  const item = mapApiEventToItem(row) as any;
  const o = row?.organizer;
  if (!o) return item as EventItem;
  const fullName = o.full_name || o.display_name || o.username || '';
  return {
    ...item,
    organizer: fullName || item.organizer,
    organizerId: o.id ?? item.organizerId,
    organizerFullName: fullName || item.organizerFullName,
    organizerUsername: o.username ?? item.organizerUsername,
    organizerAvatar: o.avatar_url ?? item.organizerAvatar,
  } as EventItem;
}

function OrganizerAvatar({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || 'O').charAt(0).toUpperCase();
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className="h-9 w-9 rounded-full object-cover shrink-0 border"
        style={{ borderColor: 'var(--adm-border)' }}
      />
    );
  }
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ background: '#6d28d9' }}
    >
      {initial}
    </span>
  );
}

export default function AdminUserView({ state, onStateChange, onBack, onOpenEvent }: AdminUserViewProps) {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  // Same events, in the shape the map needs (lat / lng, organizer, budget...)
  const [mapItems, setMapItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailEvent, setDetailEvent] = useState<PublicEvent | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch event list
  useEffect(() => {
    if (state.eventId) return;
    setLoading(true);
    const token = getAuthToken();
    const headers: HeadersInit = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(getApiUrl('/api/events?status=upcoming&limit=100'), { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        const body = data as Record<string, unknown>;
        // API returns { data: [...] } — same shape as everywhere else in the app
        const rows: any[] = Array.isArray(body.data) ? (body.data as any[]) : Array.isArray(data) ? (data as any[]) : [];
        setEvents(rows.map(normalizeEvent));

        try {
          setMapItems((parseEventsApiList(data) as any[]).map(toMapItem));
        } catch {
          setMapItems([]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [state.eventId]);

  // Fetch event detail when eventId is set
  useEffect(() => {
    if (!state.eventId) {
      setDetailEvent(null);
      return;
    }
    const existing = events.find((e) => e.id === state.eventId);
    if (existing) {
      setDetailEvent(existing);
      return;
    }
    setLoadingDetail(true);
    const token = getAuthToken();
    const headers: HeadersInit = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch(getApiUrl(`/api/events/${state.eventId}`), { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        const body = data as Record<string, unknown>;
        const ev = (body.data ?? body.event ?? body) as any;
        setDetailEvent(normalizeEvent(ev));
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [state.eventId, events]);

  const filtered = events.filter((e) => {
    if (state.categoryFilter && state.categoryFilter !== 'All') {
      const eventCat = (e.category || '').trim().toLowerCase();
      const targetCat = state.categoryFilter.trim().toLowerCase();
      if (eventCat !== targetCat) return false;
    }
    if (state.searchQuery && !e.title.toLowerCase().includes(state.searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const featuredEvents = filtered.filter((e) => e.is_featured);

  // Event detail view
  if (state.eventId) {
    if (loadingDetail || (!detailEvent && !events.find((e) => e.id === state.eventId))) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--adm-primary)' }} />
          <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            Loading event...
          </p>
        </div>
      );
    }
    const ev = detailEvent ?? events.find((e) => e.id === state.eventId) ?? null;
    if (!ev) return null;
    const H = getCategoryHue(ev.category);
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => onStateChange({ ...state, eventId: null })}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
          style={{ color: 'var(--adm-muted-fg)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div
          className="relative overflow-hidden"
          style={{
            height: 160,
            borderRadius: '16px 16px 0 0',
            background: `linear-gradient(135deg, hsl(${H} 70% 40%), hsl(${(H + 45) % 360} 70% 25%))`,
          }}
        >
          <Calendar
            className="absolute bottom-2 right-3 h-24 w-24 pointer-events-none text-white"
            style={{ opacity: 0.28 }}
          />
          <div className="relative z-10 p-6 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2">
              {ev.category && (
                <span
                  className="inline-flex rounded-full px-3 py-0.5 text-xs font-semibold capitalize"
                  style={{ background: 'hsl(271 76% 53% / .4)', color: '#fff' }}
                >
                  {ev.category}
                </span>
              )}
              <span
                className="inline-flex rounded-full px-3 py-0.5 text-xs font-bold"
                style={{ background: ev.is_free ? '#10b981' : '#f59e0b', color: '#fff' }}
              >
                {ev.is_free ? 'Free' : `€${ev.price}`}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">{ev.title}</h2>
          </div>
        </div>

        <div
          className="rounded-b-2xl border p-6 space-y-5"
          style={{
            background: 'var(--adm-card)',
            borderColor: 'var(--adm-border)',
          }}
        >
          {(ev.organizer_name || ev.organizer_handle) && (
            <div className="flex items-center gap-3">
              <OrganizerAvatar name={ev.organizer_name || ev.organizer_handle || 'O'} src={ev.organizer_avatar} />
              <div className="min-w-0">
                <p className="text-[10px] font-medium" style={{ color: 'var(--adm-muted-fg)' }}>Organizer</p>
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--adm-fg)' }}>
                  {ev.organizer_name || `@${ev.organizer_handle}`}
                </p>
                {ev.organizer_handle && ev.organizer_name && (
                  <p className="text-xs truncate" style={{ color: 'var(--adm-muted-fg)' }}>
                    @{ev.organizer_handle.replace(/^@/, '')}
                  </p>
                )}
              </div>
            </div>
          )}

          {ev.description && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--adm-fg)' }}>
              {ev.description}
            </p>
          )}

          <dl className="space-y-3 text-xs">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--adm-muted-fg)' }} />
              <div>
                <dt className="sr-only">Date</dt>
                <dd className="font-semibold" style={{ color: 'var(--adm-fg)' }}>
                  {formatDateTime(ev.date)}
                </dd>
                {ev.end_date && (
                  <dd style={{ color: 'var(--adm-muted-fg)' }}>Ends {formatDateTime(ev.end_date)}</dd>
                )}
              </div>
            </div>
            {ev.location && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--adm-muted-fg)' }} />
                <div>
                  <dt className="sr-only">Location</dt>
                  <dd className="font-semibold" style={{ color: 'var(--adm-fg)' }}>
                    {ev.location}
                  </dd>
                </div>
              </div>
            )}
            {ev.max_participants ? (
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--adm-muted-fg)' }} />
                <div>
                  <dt className="sr-only">Capacity</dt>
                  <dd className="font-semibold" style={{ color: 'var(--adm-fg)' }}>
                    {ev.participants_count != null
                      ? `${ev.participants_count} / ${ev.max_participants} going`
                      : `Up to ${ev.max_participants} people`}
                  </dd>
                </div>
              </div>
            ) : null}
          </dl>

          <div className="flex gap-3 pt-4 opacity-50 cursor-not-allowed">
            <button
              type="button"
              disabled
              title="Actions disabled in admin view"
              className="flex-1 rounded-xl border py-2.5 text-xs font-semibold text-center"
              style={{ borderColor: 'var(--adm-border)', background: 'var(--adm-secondary)', color: 'var(--adm-muted-fg)' }}
            >
              Join Event
            </button>
            <button
              type="button"
              disabled
              title="Actions disabled in admin view"
              className="rounded-xl border px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
              style={{ borderColor: 'var(--adm-border)', background: 'var(--adm-secondary)', color: 'var(--adm-muted-fg)' }}
            >
              <Heart className="h-4 w-4" /> Favourite
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderCard = (e: PublicEvent, featured = false) => {
    const H = getCategoryHue(e.category);
    return (
      <div
        key={e.id}
        className="rounded-[20px] border flex flex-col justify-between overflow-hidden transition-all hover:border-primary/50"
        style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
      >
        <div
          className="relative h-28 p-4 flex flex-col justify-between"
          style={{
            background: `linear-gradient(135deg, hsl(${H} 70% 35%), hsl(${(H + 45) % 360} 70% 20%))`,
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow"
              style={{ background: e.is_free ? '#10b981' : '#f59e0b' }}
            >
              {e.is_free ? 'Free' : `€${e.price}`}
            </span>
            {e.category && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white capitalize backdrop-blur-md"
                style={{ background: 'rgba(0,0,0,0.3)' }}
              >
                {e.category}
              </span>
            )}
          </div>
        </div>
        <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold truncate text-foreground">{e.title}</h4>
              {featured && (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-semibold">Featured</span>
              )}
            </div>
            {e.organizer_name && (
              <p className="text-xs text-muted-foreground">{e.organizer_name}</p>
            )}
          </div>
          <div className="space-y-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {formatDate(e.date)}</p>
            {e.location && <p className="flex items-center gap-1.5 truncate"><MapPin className="h-3 w-3" /> {e.location}</p>}
          </div>
          <div className="flex items-center justify-between pt-2">
            {e.max_participants ? (
              <span className="text-xs flex items-center gap-1 text-muted-foreground">
                <Users className="h-3 w-3" />
                {e.participants_count != null ? `${e.participants_count}/${e.max_participants}` : `Up to ${e.max_participants}`}
              </span>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button type="button" className="p-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground">
                <Heart className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onStateChange({ ...state, eventId: e.id })}
                className="rounded-xl px-3.5 py-1.5 text-xs font-bold text-white gradient-primary shadow-glow"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs: Home | Map */}
      <div
        className="flex rounded-[14px] border p-1 gap-1 max-w-xs"
        style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
      >
        {(['home', 'map'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onStateChange({ ...state, screen: s })}
            className="flex-1 rounded-xl py-2 text-xs font-semibold capitalize transition-all"
            style={
              state.screen === s
                ? {
                    background: 'var(--adm-grad)',
                    color: 'white',
                    boxShadow: 'var(--adm-shadow-glow)',
                  }
                : { color: 'var(--adm-muted-fg)' }
            }
          >
            {s === 'home' ? 'Home' : 'Map'}
          </button>
        ))}
      </div>

      {state.screen === 'home' && (
        <div className="space-y-6">
          {/* Search Input */}
          <div className="relative max-w-xl">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: 'var(--adm-muted-fg)' }}
            />
            <input
              type="text"
              value={state.searchQuery}
              onChange={(e) => onStateChange({ ...state, searchQuery: e.target.value })}
              placeholder="Search events..."
              aria-label="Search events"
              className="w-full rounded-[12px] border pl-10 pr-4 text-sm outline-none transition-colors"
              style={{
                background: 'var(--adm-card)',
                borderColor: 'var(--adm-border)',
                color: 'var(--adm-fg)',
                height: 44,
              }}
            />
          </div>

          {/* Category Filter Pills Row */}
          <div className="flex flex-wrap gap-1.5">
            {CATS.map(({ id, icon: Icon, iconColor, activeBg, activeBorderColor }) => {
              const active = (state.categoryFilter === '' && id === 'All') || state.categoryFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onStateChange({ ...state, categoryFilter: id === 'All' ? '' : id })}
                  style={active ? { background: activeBg, borderColor: activeBorderColor, color: iconColor } : { background: activeBg.replace('0.15', '0.08'), borderColor: activeBorderColor.replace('0.5', '0.25') }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-95 ${
                    active ? 'border-transparent shadow-sm' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: iconColor }} />
                  {id}
                </button>
              );
            })}
          </div>

          {/* Featured Section */}
          {featuredEvents.length > 0 && !state.searchQuery && !state.categoryFilter && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold tracking-wider uppercase text-foreground">Featured</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featuredEvents.map((e) => renderCard(e, true))}
              </div>
            </div>
          )}

          {/* All Events Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold tracking-wider uppercase text-foreground">All events</h3>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--adm-primary)' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-14 rounded-2xl border"
                style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
              >
                <Calendar className="h-8 w-8 mb-2 opacity-40" style={{ color: 'var(--adm-muted-fg)' }} />
                <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                  No events found
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((e) => renderCard(e))}
              </div>
            )}
          </div>
        </div>
      )}

      {state.screen === 'map' && (
        <AdminMapView
          events={mapItems}
          loading={loading}
          categoryFilter={state.categoryFilter}
          searchQuery={state.searchQuery}
          onCategoryChange={(c) => onStateChange({ ...state, categoryFilter: c })}
          onSearchChange={(q) => onStateChange({ ...state, searchQuery: q })}
          onOpenEvent={(id) =>
            onOpenEvent ? onOpenEvent(id) : onStateChange({ ...state, eventId: id })
          }
        />
      )}
    </div>
  );
}