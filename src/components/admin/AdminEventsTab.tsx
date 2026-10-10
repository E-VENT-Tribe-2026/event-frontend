import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Search,
  X,
  Loader2,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
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
  Users,
} from 'lucide-react';
import { fetchAdminCounts } from '@/lib/adminApi';

/* -------------------------------------------------------------------------- */
/* Types & config                                                             */
/* -------------------------------------------------------------------------- */

type SubTab = 'all' | 'upcoming' | 'past' | 'cancelled';
type EventStatus = 'upcoming' | 'past' | 'cancelled';

interface Organizer {
  id: string;
  username: string | null;
  full_name: string | null;
  display_name: string | null;
}

/** Shape returned by GET /api/events/ */
interface ApiEvent {
  id: string;
  title: string;
  category: string | null;
  status: string;
  is_cancelled?: boolean;
  start_datetime: string;
  end_datetime: string | null;
  organizer: Organizer | null;
}

interface AdminEventsTabProps {
  onOpenEvent: (eventId: string) => void;
  onErrorToast: (msg: string) => void;
  onSuccessToast?: (msg: string) => void;
}

// Set VITE_API_URL if your API lives somewhere else.
const API_BASE: string =
  (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') ??
  'https://e-vent-orchestrator.onrender.com';

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

const CATS = [
  { id: 'All',        icon: LayoutGrid, color: '#94a3b8', rgb: '148,163,184' },
  { id: 'Music',      icon: Music,      color: '#a78bfa', rgb: '167,139,250' },
  { id: 'Tech',       icon: Cpu,        color: '#60a5fa', rgb: '96,165,250'  },
  { id: 'Food',       icon: Utensils,   color: '#fb923c', rgb: '251,146,60'  },
  { id: 'Fitness',    icon: Dumbbell,   color: '#4ade80', rgb: '74,222,128'  },
  { id: 'Art',        icon: Palette,    color: '#f472b6', rgb: '244,114,182' },
  { id: 'Gaming',     icon: Gamepad2,   color: '#818cf8', rgb: '129,140,248' },
  { id: 'Sports',     icon: Trophy,     color: '#34d399', rgb: '52,211,153'  },
  { id: 'Movies',     icon: Film,       color: '#f87171', rgb: '248,113,113' },
  { id: 'Study',      icon: BookOpen,   color: '#facc15', rgb: '250,204,21'  },
  { id: 'Travel',     icon: Plane,      color: '#38bdf8', rgb: '56,189,248'  },
  { id: 'Coffee',     icon: Coffee,     color: '#fbbf24', rgb: '251,191,36'  },
  { id: 'Networking', icon: Network,    color: '#22d3ee', rgb: '34,211,238'  },
  { id: 'Wellness',   icon: Leaf,       color: '#2dd4bf', rgb: '45,212,191'  },
  { id: 'Community',  icon: Users,      color: '#c084fc', rgb: '192,132,252' },
] as const;

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
];

const CATEGORY_IMAGES: Record<string, string> = {
  music:      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&q=80',
  tech:       'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=300&q=80',
  food:       'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
  fitness:    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=300&q=80',
  art:        'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=300&q=80',
  gaming:     'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=300&q=80',
  sports:     'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=300&q=80',
  movies:     'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=300&q=80',
  study:      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=300&q=80',
  travel:     'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=300&q=80',
  coffee:     'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=300&q=80',
  networking: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=300&q=80',
  wellness:   'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=300&q=80',
  community:  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=300&q=80',
  default:    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=300&q=80',
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

// Names the API uses that differ from the pill names.
const CATEGORY_ALIASES: Record<string, string> = {
  technology: 'tech',
};

function normalizeCategory(raw: string | null | undefined): string {
  const c = (raw ?? '').trim().toLowerCase();
  return CATEGORY_ALIASES[c] ?? c;
}

function matchesCategory(e: ApiEvent, selected: string): boolean {
  if (selected === 'All') return true;
  return normalizeCategory(e.category) === selected.toLowerCase();
}

/**
 * The status of one event. When the server already filtered by sub-tab,
 * that tab IS the status. In the "All" tab we work it out: cancelled wins,
 * then an event counts as upcoming until it has ended.
 */
function getEventStatus(e: ApiEvent, tab: SubTab, now: number): EventStatus {
  if (e.is_cancelled || e.status === 'cancelled') return 'cancelled';
  if (tab === 'upcoming' || tab === 'past') return tab;
  const endOrStart = new Date(e.end_datetime ?? e.start_datetime).getTime();
  return !isNaN(endOrStart) && endOrStart > now ? 'upcoming' : 'past';
}

function organizerName(o: Organizer | null): string {
  return o?.display_name || o?.full_name || o?.username || '';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Fetches every page of /api/events/ for one sub-tab. */
async function fetchEvents(tab: SubTab, signal: AbortSignal): Promise<ApiEvent[]> {
  const collected: ApiEvent[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
    if (tab !== 'all') params.set('status', tab);

    const res = await fetch(`${API_BASE}/api/events/?${params}`, { signal });
    if (!res.ok) throw new Error(`Failed to load events (${res.status})`);

    const body = await res.json();
    const items: ApiEvent[] = body?.data ?? body?.items ?? [];

    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        collected.push(item);
      }
    }
    if (items.length < PAGE_SIZE) break;
  }
  return collected;
}

/* -------------------------------------------------------------------------- */
/* Status pill                                                                */
/* -------------------------------------------------------------------------- */

function StatusPill({ status }: { status: EventStatus }) {
  const base = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold';

  if (status === 'cancelled') {
    return (
      <span className={base}
        style={{ background: 'hsl(0 84% 60% / .15)', color: 'var(--adm-danger-text)', borderColor: 'hsl(0 84% 60% / .3)' }}>
        <XCircle className="h-3 w-3" />Cancelled
      </span>
    );
  }
  if (status === 'upcoming') {
    return (
      <span className={base}
        style={{ background: 'hsl(199 90% 70% / .12)', color: 'var(--adm-info-text)', borderColor: 'hsl(199 90% 70% / .3)' }}>
        <Clock className="h-3 w-3" />Upcoming
      </span>
    );
  }
  return (
    <span className={base}
      style={{ background: 'var(--adm-secondary)', color: 'var(--adm-muted-fg)', borderColor: 'var(--adm-border)' }}>
      <CheckCircle2 className="h-3 w-3" />Past
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function AdminEventsTab({ onOpenEvent, onErrorToast }: AdminEventsTabProps) {
  const [serverCounts, setServerCounts] = useState<
    { total: number; upcoming: number; past: number; cancelled: number } | null
  >(null);
  const [loadingCounts, setLoadingCounts] = useState(true);

  // Events are loaded per sub-tab and cached, so switching back is instant.
  const [eventsByTab, setEventsByTab] = useState<Partial<Record<SubTab, ApiEvent[]>>>({});
  const [loadingTab, setLoadingTab] = useState<SubTab | null>('all');

  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchFocused, setSearchFocused] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest toast callback in a ref so an inline function from the
  // parent never re-triggers the data fetch.
  const errorToastRef = useRef(onErrorToast);
  useEffect(() => { errorToastRef.current = onErrorToast; }, [onErrorToast]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  /* ---- Server counts for the stat cards ---- */
  useEffect(() => {
    let cancelled = false;
    fetchAdminCounts()
      .then((data) => { if (!cancelled && data?.events) setServerCounts(data.events); })
      .catch(() => { /* cards show a dash if counts are unavailable */ })
      .finally(() => { if (!cancelled) setLoadingCounts(false); });
    return () => { cancelled = true; };
  }, []);

  /* ---- Load the events for the active sub-tab (once per tab) ---- */
  const loadedTabs = useRef<Set<SubTab>>(new Set());

  useEffect(() => {
    if (loadedTabs.current.has(activeSubTab)) {
      setLoadingTab(null);
      return;
    }

    const controller = new AbortController();
    setLoadingTab(activeSubTab);

    fetchEvents(activeSubTab, controller.signal)
      .then((items) => {
        loadedTabs.current.add(activeSubTab);
        setEventsByTab((prev) => ({ ...prev, [activeSubTab]: items }));
        setLoadingTab(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        errorToastRef.current(err instanceof Error ? err.message : 'Failed to load events');
        setLoadingTab(null);
      });

    return () => controller.abort();
  }, [activeSubTab]);

  /* ---- Search handlers ---- */
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setActiveSearch(value.trim()), 300);
  }, []);

  const handleClearSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchInput('');
    setActiveSearch('');
  }, []);

  const handleResetFilters = useCallback(() => {
    handleClearSearch();
    setSelectedCategory('All');
    setActiveSubTab('all');
  }, [handleClearSearch]);

  /* ---- Derived data ----
     1. The sub-tab decides which events are loaded (Upcoming = server's upcoming list).
     2. The category pill narrows that list.
     3. The search box narrows it again.
     So Upcoming -> Music shows only upcoming music events. */

  const tabEvents = eventsByTab[activeSubTab] ?? [];
  const isLoading = loadingTab === activeSubTab;

  const subTabItems = useMemo(() => {
    const now = Date.now();
    return tabEvents.map((event) => ({ event, status: getEventStatus(event, activeSubTab, now) }));
  }, [tabEvents, activeSubTab]);

  // Pill counts always describe the current sub-tab.
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: subTabItems.length };
    for (const { id } of CATS) {
      if (id !== 'All') counts[id] = subTabItems.filter(({ event }) => matchesCategory(event, id)).length;
    }
    return counts;
  }, [subTabItems]);

  const filteredItems = useMemo(() => {
    const q = activeSearch.toLowerCase();
    return subTabItems.filter(
      ({ event }) =>
        matchesCategory(event, selectedCategory) &&
        (!q || (event.title ?? '').toLowerCase().includes(q)),
    );
  }, [subTabItems, selectedCategory, activeSearch]);

  const statCards = [
    { label: 'Total Events', value: serverCounts?.total ?? null,     icon: <LayoutGrid className="h-5 w-5" />,   iconStyle: { background: 'hsl(271 76% 53% / .18)', color: 'var(--adm-primary)' } },
    { label: 'Upcoming',     value: serverCounts?.upcoming ?? null,  icon: <Clock className="h-5 w-5" />,        iconStyle: { background: 'hsl(199 90% 70% / .15)', color: 'var(--adm-info-text)' } },
    { label: 'Past',         value: serverCounts?.past ?? null,      icon: <CheckCircle2 className="h-5 w-5" />, iconStyle: { background: 'var(--adm-secondary)',   color: 'var(--adm-muted-fg)' } },
    { label: 'Cancelled',    value: serverCounts?.cancelled ?? null, icon: <XCircle className="h-5 w-5" />,      iconStyle: { background: 'hsl(0 84% 60% / .15)',   color: 'var(--adm-danger-text)' } },
  ];

  const hasActiveFilters = !!activeSearch || selectedCategory !== 'All' || activeSubTab !== 'all';

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-[16px] border p-4 space-y-2"
            style={{ background: 'var(--adm-grad-card)', borderColor: 'var(--adm-border)', boxShadow: '0 4px 20px hsl(213 61% 5% / .5)' }}>
            <div className="flex items-center justify-center" style={{ width: 42, height: 42, borderRadius: 999, ...card.iconStyle }}>
              {card.icon}
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider leading-tight" style={{ color: 'var(--adm-muted-fg)' }}>
                {card.label}
              </p>
              <p className="text-2xl font-extrabold mt-0.5" style={{ color: 'var(--adm-fg)' }}>
                {loadingCounts
                  ? <span className="inline-block h-7 w-10 animate-pulse rounded" style={{ background: 'var(--adm-secondary)' }} />
                  : card.value === null ? '–' : card.value.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--adm-muted-fg)' }} />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search events by title..."
          aria-label="Search events by title"
          className="w-full rounded-[12px] border text-sm outline-none transition-colors"
          style={{
            background: 'var(--adm-card)',
            borderColor: searchFocused ? 'hsl(271 76% 53% / .7)' : 'var(--adm-border)',
            boxShadow: searchFocused ? '0 0 0 3px hsl(271 76% 53% / .15)' : 'none',
            color: 'var(--adm-fg)',
            height: 44,
            padding: '0 2.5rem',
          }}
        />
        {searchInput && (
          <button type="button" onClick={handleClearSearch} aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1" style={{ color: 'var(--adm-muted-fg)' }}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div role="tablist" aria-label="Event status filter" className="flex gap-1.5 rounded-[14px] border p-1"
        style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}>
        {SUB_TABS.map((tab) => {
          const active = activeSubTab === tab.id;
          return (
            <button key={tab.id} type="button" role="tab" aria-selected={active}
              onClick={() => setActiveSubTab(tab.id)}
              className="flex-1 rounded-xl py-2 text-xs font-semibold transition-all"
              style={active
                ? { background: 'var(--adm-grad)', color: 'white', boxShadow: 'var(--adm-shadow-glow)' }
                : { background: 'transparent', color: 'var(--adm-muted-fg)' }}>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Category pills: counts reflect the selected sub-tab */}
      <div role="group" aria-label="Category filter" className="flex flex-wrap gap-1.5">
        {CATS.map(({ id, icon: Icon, color, rgb }) => {
          const active = selectedCategory === id;
          const count = categoryCounts[id] ?? 0;
          const empty = count === 0 && !active;
          return (
            <button key={id} type="button"
              aria-pressed={active}
              onClick={() => setSelectedCategory(id)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-95"
              style={{
                background: `rgba(${rgb},${active ? 0.15 : 0.08})`,
                borderColor: `rgba(${rgb},${active ? 0.5 : 0.25})`,
                color: active ? color : 'var(--adm-muted-fg)',
                opacity: empty ? 0.5 : 1,
              }}>
              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
              {id}
              {!isLoading && <span className="tabular-nums" style={{ opacity: 0.65 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Event list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--adm-muted-fg)' }}>
            {activeSearch ? `Results for "${activeSearch}"` : 'Events'}
          </p>
          <span className="text-xs" style={{ color: 'var(--adm-muted-fg)' }} aria-live="polite">
            {filteredItems.length} {filteredItems.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border"
            style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}>
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--adm-primary)' }} />
            <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>Loading events...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center rounded-2xl border border-dashed p-6 space-y-2"
            style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}>
            <Calendar className="h-10 w-10 opacity-50" style={{ color: 'var(--adm-muted-fg)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--adm-fg)' }}>No events found</p>
            <p className="text-xs max-w-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              {hasActiveFilters
                ? 'No events match your current filters or search.'
                : 'There are no events yet.'}
            </p>
            {hasActiveFilters && (
              <button type="button" onClick={handleResetFilters}
                className="mt-2 rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
                style={{ borderColor: 'var(--adm-border)', color: 'var(--adm-fg)', background: 'var(--adm-secondary)' }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredItems.map(({ event, status }) => {
              const catKey = normalizeCategory(event.category);
              const imageUrl = CATEGORY_IMAGES[catKey] || CATEGORY_IMAGES.default;
              const organizer = organizerName(event.organizer);
              return (
                <li key={event.id}>
                  <button type="button"
                    onClick={() => onOpenEvent(event.id)}
                    aria-label={`View event ${event.title}`}
                    className="group w-full flex items-center gap-3 rounded-[12px] border p-3.5 text-left transition-all active:scale-[0.99] bg-[var(--adm-card)] border-[var(--adm-border)] hover:bg-[hsl(213_50%_17%)] hover:border-[hsl(271_76%_53%/.55)]">
                    <img src={imageUrl} alt="" loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-xl object-cover border"
                      style={{ borderColor: 'var(--adm-border)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--adm-fg)' }}>{event.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>{formatDate(event.start_datetime)}</p>
                        {organizer && (
                          <>
                            <span aria-hidden style={{ color: 'var(--adm-muted-fg)', opacity: 0.4 }}>·</span>
                            <p className="text-xs truncate" style={{ color: 'var(--adm-muted-fg)' }}>{organizer}</p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {event.category && (
                        <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize hidden sm:inline-block"
                          style={{ background: 'hsl(271 76% 53% / .18)', color: 'var(--adm-primary-text)', border: '1px solid hsl(271 76% 53% / .4)' }}>
                          {event.category}
                        </span>
                      )}
                      <StatusPill status={status} />
                      <ChevronRight className="h-4 w-4 transition-colors group-hover:text-[var(--adm-fg)]"
                        style={{ color: 'var(--adm-muted-fg)' }} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}