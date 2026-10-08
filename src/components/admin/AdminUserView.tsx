import { useEffect, useState } from 'react';
import { MapPin, Search, Calendar, ArrowLeft, Loader2 } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';

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
}

interface PublicEvent {
  id: string;
  title: string;
  date: string;
  category?: string;
  organizer_name?: string;
  location?: string;
  description?: string;
  participants_count?: number;
  is_free?: boolean;
  price?: number;
}

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
  health: 160,
  education: 55,
  social: 340,
  business: 220,
  other: 213,
};

function getCategoryHue(category?: string): number {
  if (!category) return 271;
  return CATEGORY_HUE[category.toLowerCase()] ?? 271;
}

function formatDate(isoString: string): string {
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

function formatDateTime(isoString: string): string {
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

export default function AdminUserView({ state, onStateChange, onBack }: AdminUserViewProps) {
  const [events, setEvents] = useState<PublicEvent[]>([]);
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
    fetch(getApiUrl('/api/events?status=upcoming&limit=50'), { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        const raw = data as Record<string, unknown>;
        const nested = raw.data as Record<string, unknown> | undefined;
        const items =
          (nested?.items as PublicEvent[] | undefined) ??
          (raw.items as PublicEvent[] | undefined) ??
          (Array.isArray(data) ? (data as PublicEvent[]) : []);
        setEvents(items);
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
    // Try to find in already-fetched list first
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
        const raw = data as Record<string, unknown>;
        const ev = (raw.data ?? raw.event ?? raw) as PublicEvent;
        setDetailEvent(ev);
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [state.eventId, events]);

  const categories = [...new Set(events.map((e) => e.category).filter(Boolean))] as string[];

  const filtered = events
    .filter((e) => !state.categoryFilter || e.category === state.categoryFilter)
    .filter(
      (e) =>
        !state.searchQuery ||
        e.title.toLowerCase().includes(state.searchQuery.toLowerCase()),
    );

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
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => onStateChange({ ...state, eventId: null })}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
          style={{ color: 'var(--adm-muted-fg)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Hero band */}
        <div
          className="relative overflow-hidden"
          style={{
            height: 120,
            borderRadius: '16px 16px 0 0',
            background: `linear-gradient(135deg, hsl(${H} 70% 40%), hsl(${(H + 45) % 360} 70% 25%))`,
          }}
        >
          <Calendar
            className="absolute bottom-2 right-3 h-20 w-20 pointer-events-none text-white"
            style={{ opacity: 0.28 }}
          />
          <div className="relative z-10 p-5">
            {ev.category && (
              <span
                className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{ background: 'hsl(271 76% 53% / .35)', color: 'var(--adm-primary-text)' }}
              >
                {ev.category}
              </span>
            )}
            <h2 className="mt-2 text-lg font-bold text-white leading-tight">{ev.title}</h2>
          </div>
        </div>

        {/* Details card */}
        <div
          className="rounded-b-2xl border p-5 space-y-4"
          style={{
            borderRadius: '0 0 16px 16px',
            background: 'var(--adm-grad-card)',
            borderColor: 'var(--adm-border)',
          }}
        >
          {ev.description && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--adm-fg)' }}>
              {ev.description}
            </p>
          )}

          <dl className="space-y-2 text-xs">
            {ev.organizer_name && (
              <div className="flex items-center gap-2">
                <dt style={{ color: 'var(--adm-muted-fg)' }}>Organizer:</dt>
                <dd className="font-semibold" style={{ color: 'var(--adm-fg)' }}>
                  {ev.organizer_name}
                </dd>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--adm-muted-fg)' }} />
              <dd className="font-semibold" style={{ color: 'var(--adm-fg)' }}>
                {formatDateTime(ev.date)}
              </dd>
            </div>
            {ev.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--adm-muted-fg)' }} />
                <dd className="font-semibold" style={{ color: 'var(--adm-fg)' }}>
                  {ev.location}
                </dd>
              </div>
            )}
          </dl>

          {/* Disabled action row */}
          <div className="flex gap-2 pt-2 opacity-50 cursor-not-allowed">
            <button
              type="button"
              disabled
              title="Actions disabled in admin view"
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: 'var(--adm-border)', background: 'var(--adm-secondary)', color: 'var(--adm-muted-fg)' }}
            >
              Join
            </button>
            <button
              type="button"
              disabled
              title="Actions disabled in admin view"
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: 'var(--adm-border)', background: 'var(--adm-secondary)', color: 'var(--adm-muted-fg)' }}
            >
              Favourite
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs: Home | Map */}
      <div
        className="flex rounded-[14px] border p-1 gap-1"
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
        <>
          {/* Category filter chips */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onStateChange({ ...state, categoryFilter: '' })}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-all"
                style={
                  state.categoryFilter === ''
                    ? {
                        background: 'var(--adm-grad)',
                        borderColor: 'var(--adm-primary)',
                        color: 'white',
                        boxShadow: 'var(--adm-shadow-glow)',
                      }
                    : {
                        background: 'var(--adm-card)',
                        borderColor: 'hsl(213 30% 28%)',
                        color: 'hsl(213 20% 82%)',
                      }
                }
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() =>
                    onStateChange({
                      ...state,
                      categoryFilter: state.categoryFilter === cat ? '' : cat,
                    })
                  }
                  className="rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-all"
                  style={
                    state.categoryFilter === cat
                      ? {
                          background: 'var(--adm-grad)',
                          borderColor: 'var(--adm-primary)',
                          color: 'white',
                          boxShadow: 'var(--adm-shadow-glow)',
                        }
                      : {
                          background: 'var(--adm-card)',
                          borderColor: 'hsl(213 30% 28%)',
                          color: 'hsl(213 20% 82%)',
                        }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
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
              className="w-full rounded-[12px] border pl-10 pr-4 py-2.5 text-sm outline-none transition-colors"
              style={{
                background: 'var(--adm-card)',
                borderColor: 'var(--adm-border)',
                color: 'var(--adm-fg)',
                height: 44,
              }}
            />
          </div>

          {/* Event grid */}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtered.map((e) => {
                const H = getCategoryHue(e.category);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onStateChange({ ...state, eventId: e.id })}
                    className="rounded-[16px] border overflow-hidden text-left transition-all hover:opacity-90 active:scale-[0.99]"
                    style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
                  >
                    {/* Hero band */}
                    <div
                      className="relative h-20"
                      style={{
                        background: `linear-gradient(135deg, hsl(${H} 70% 40%), hsl(${(H + 45) % 360} 70% 25%))`,
                      }}
                    >
                      {e.category && (
                        <span
                          className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                          style={{
                            background: 'hsl(271 76% 53% / .35)',
                            color: 'var(--adm-primary-text)',
                          }}
                        >
                          {e.category}
                        </span>
                      )}
                    </div>
                    {/* Content */}
                    <div className="p-3 space-y-1">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--adm-fg)' }}>
                        {e.title}
                      </p>
                      {e.organizer_name && (
                        <p className="text-xs truncate" style={{ color: 'var(--adm-muted-fg)' }}>
                          {e.organizer_name}
                        </p>
                      )}
                      <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                        {formatDate(e.date)}
                      </p>
                      {e.location && (
                        <p className="text-xs flex items-center gap-1" style={{ color: 'var(--adm-muted-fg)' }}>
                          <MapPin className="h-3 w-3" />
                          {e.location}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {state.screen === 'map' && (
        <>
          {/* Map placeholder */}
          <div
            className="h-48 rounded-[16px] flex flex-col items-center justify-center gap-2 border"
            style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
          >
            <MapPin className="h-8 w-8 opacity-30" style={{ color: 'var(--adm-muted-fg)' }} />
            <p className="text-xs font-medium" style={{ color: 'var(--adm-muted-fg)' }}>
              Map view — read-only
            </p>
          </div>

          {/* Compact list */}
          <div className="mt-4 space-y-2">
            {events.slice(0, 10).map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onStateChange({ ...state, eventId: e.id })}
                className="w-full flex items-center gap-3 rounded-[12px] border p-3 text-left"
                style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--adm-fg)' }}>
                    {e.title}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                    {e.organizer_name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
