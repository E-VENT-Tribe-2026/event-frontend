import { useEffect, useState, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import {
  fetchAdminCounts,
  fetchAdminEvents,
  type AdminEventsResponse,
  type AdminEventSummaryFull,
} from '@/lib/adminApi';

type SubTab = 'all' | 'upcoming' | 'past' | 'cancelled';

interface AdminEventsTabProps {
  onOpenEvent: (eventId: string) => void;
  onErrorToast: (msg: string) => void;
  onSuccessToast: (msg: string) => void;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const CATEGORY_COLORS: Record<string, string> = {
  music: 'bg-pink-500',
  sports: 'bg-green-500',
  tech: 'bg-blue-500',
  technology: 'bg-blue-500',
  food: 'bg-orange-500',
  art: 'bg-purple-500',
  arts: 'bg-purple-500',
  gaming: 'bg-cyan-500',
  health: 'bg-teal-500',
  education: 'bg-yellow-500',
  social: 'bg-rose-500',
  business: 'bg-indigo-500',
  other: 'bg-muted-foreground',
};

function getCategoryDot(category?: string): string {
  if (!category) return 'bg-muted-foreground';
  return CATEGORY_COLORS[category.toLowerCase()] ?? 'bg-muted-foreground';
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

function StatusPill({ event }: { event: AdminEventSummaryFull }) {
  if (event.is_cancelled || event.status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
        <XCircle className="h-3 w-3" />
        Cancelled
      </span>
    );
  }
  const now = Date.now();
  const eventDate = new Date(event.date).getTime();
  if (eventDate > now) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
        <Clock className="h-3 w-3" />
        Upcoming
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      <CheckCircle2 className="h-3 w-3" />
      Past
    </span>
  );
}

export default function AdminEventsTab({
  onOpenEvent,
  onErrorToast,
}: AdminEventsTabProps) {
  // Counts
  const [counts, setCounts] = useState<{
    total: number;
    upcoming: number;
    past: number;
    cancelled: number;
  } | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);

  // Events list
  const [events, setEvents] = useState<AdminEventSummaryFull[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Search & sub-tab
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('all');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load stat counts on mount
  useEffect(() => {
    let cancelled = false;
    fetchAdminCounts()
      .then((data) => {
        if (!cancelled && data.events) {
          setCounts(data.events);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingCounts(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadEvents = useCallback(
    async (targetPage: number, query: string, subTab: SubTab, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingEvents(true);
      }
      try {
        const res: AdminEventsResponse = await fetchAdminEvents(targetPage, PAGE_SIZE, query || undefined);
        // Client-side filter by sub-tab (API may not support it)
        const now = Date.now();
        let items = res.items;
        if (subTab === 'upcoming') {
          items = items.filter(
            (e) => !e.is_cancelled && e.status !== 'cancelled' && new Date(e.date).getTime() > now,
          );
        } else if (subTab === 'past') {
          items = items.filter(
            (e) => !e.is_cancelled && e.status !== 'cancelled' && new Date(e.date).getTime() <= now,
          );
        } else if (subTab === 'cancelled') {
          items = items.filter((e) => e.is_cancelled || e.status === 'cancelled');
        }
        setEvents((prev) => (append ? [...prev, ...items] : items));
        setPage(res.page);
        setTotalPages(res.total_pages);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load events';
        onErrorToast(msg);
      } finally {
        setLoadingEvents(false);
        setLoadingMore(false);
      }
    },
    [onErrorToast],
  );

  // Initial load
  useEffect(() => {
    void loadEvents(1, '', 'all');
  }, [loadEvents]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim();
      setActiveSearch(trimmed);
      void loadEvents(1, trimmed, activeSubTab);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void loadEvents(1, '', activeSubTab);
  };

  const handleSubTabChange = (tab: SubTab) => {
    setActiveSubTab(tab);
    void loadEvents(1, activeSearch, tab);
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      void loadEvents(page + 1, activeSearch, activeSubTab, true);
    }
  };

  const statCards = [
    {
      label: 'Total Events',
      value: counts?.total ?? null,
      icon: <LayoutGrid className="h-5 w-5" />,
      color: 'bg-primary/10 text-primary',
    },
    {
      label: 'Upcoming',
      value: counts?.upcoming ?? null,
      icon: <Clock className="h-5 w-5" />,
      color: 'bg-blue-500/10 text-blue-400',
    },
    {
      label: 'Past',
      value: counts?.past ?? null,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'bg-muted text-muted-foreground',
    },
    {
      label: 'Cancelled',
      value: counts?.cancelled ?? null,
      icon: <XCircle className="h-5 w-5" />,
      color: 'bg-destructive/10 text-destructive',
    },
  ];

  const SUB_TABS: { id: SubTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.color}`}>
              {card.icon}
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">
                {card.label}
              </p>
              <p className="text-2xl font-extrabold text-foreground mt-0.5">
                {loadingCounts && card.value === null ? (
                  <span className="inline-block h-7 w-10 animate-pulse rounded bg-secondary" />
                ) : (
                  (card.value ?? 0).toLocaleString()
                )}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search events by title..."
          aria-label="Search events by title"
          className="w-full rounded-xl bg-secondary pl-10 pr-10 py-3 text-sm text-foreground outline-none border border-border/50 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
        />
        {searchInput && (
          <button
            type="button"
            onClick={handleClearSearch}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div
        role="tablist"
        aria-label="Event filter"
        className="flex gap-1.5 rounded-xl bg-secondary p-1"
      >
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeSubTab === tab.id}
            onClick={() => handleSubTabChange(tab.id)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              activeSubTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Event List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {activeSearch ? `Results for "${activeSearch}"` : 'Events'}
          </p>
          <span className="text-xs text-muted-foreground">
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {loadingEvents ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border border-border/50 bg-card">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center rounded-2xl border border-dashed border-border bg-card/50 p-6 space-y-2">
            <Calendar className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No events found</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {activeSearch
                ? `No events matched "${activeSearch}".`
                : 'There are no events in this category yet.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => onOpenEvent(event.id)}
                  aria-label={`View event ${event.title}`}
                  className="group w-full flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all hover:bg-secondary/40 hover:border-primary/40 active:scale-[0.99]"
                >
                  {/* Category dot */}
                  <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${getCategoryDot(undefined)}`} />

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{formatDate(event.date)}</p>
                      <span className="text-muted-foreground/40">·</span>
                      <p className="text-xs text-muted-foreground truncate">{event.organizer_name}</p>
                    </div>
                  </div>

                  {/* Status pill + chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill event={event} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Load More */}
        {page < totalPages && !loadingEvents && (
          <div className="pt-2 text-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={handleLoadMore}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary/80 active:scale-95 transition-all disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading more...
                </>
              ) : (
                'Load More Events'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
