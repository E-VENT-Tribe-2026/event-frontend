import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, Calendar, ChevronRight } from 'lucide-react';
import AdminPerson from './AdminPerson';
import {
  fetchAdminCounts,
  fetchAdminEvents,
  type AdminEventListItem,
  type AdminEventStatusFilter,
} from '@/lib/adminApi';
import { adminEventPath } from '@/lib/adminRoutes';
import { formatAdminDateTime, isEventCancelled } from '@/lib/adminFormat';

interface AdminEventsTabProps {
  onErrorToast: (msg: string) => void;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const FILTERS: { key: AdminEventStatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'cancelled', label: 'Cancelled' },
];

type Counts = { total: number; upcoming: number; past: number; cancelled: number };

export default function AdminEventsTab({ onErrorToast }: AdminEventsTabProps) {
  const navigate = useNavigate();

  const [counts, setCounts] = useState<Counts | null>(null);
  const [filter, setFilter] = useState<AdminEventStatusFilter>('all');
  const [events, setEvents] = useState<AdminEventListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only the newest request may update the screen (tab or search can change mid-request).
  const requestIdRef = useRef(0);
  const onErrorToastRef = useRef(onErrorToast);
  onErrorToastRef.current = onErrorToast;

  // Counts at the top. Fetched fresh every time the tab opens, never cached.
  useEffect(() => {
    let cancelled = false;
    fetchAdminCounts()
      .then((data) => {
        if (!cancelled && data.events) setCounts(data.events);
      })
      .catch(() => {
        // Counts are informative only; the list still works without them.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadEvents = useCallback(
    async (status: AdminEventStatusFilter, targetPage: number, query: string, append: boolean) => {
      const requestId = ++requestIdRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const res = await fetchAdminEvents(status, targetPage, PAGE_SIZE, query);
        if (requestId !== requestIdRef.current) return;
        setEvents((prev) => (append ? [...prev, ...res.items] : res.items));
        setPage(res.page);
        setTotalPages(res.total_pages);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        onErrorToastRef.current(err instanceof Error ? err.message : 'Failed to fetch events');
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  // First load.
  useEffect(() => {
    void loadEvents('all', 1, '', false);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadEvents]);

  const handleFilterChange = (next: AdminEventStatusFilter) => {
    if (next === filter) return;
    setFilter(next);
    void loadEvents(next, 1, activeSearch, false);
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim();
      setActiveSearch(trimmed);
      void loadEvents(filter, 1, trimmed, false);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void loadEvents(filter, 1, '', false);
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      void loadEvents(filter, page + 1, activeSearch, true);
    }
  };

  const countCards: { label: string; value: number | undefined }[] = [
    { label: 'Total events', value: counts?.total },
    { label: 'Upcoming', value: counts?.upcoming },
    { label: 'Past', value: counts?.past },
    { label: 'Cancelled', value: counts?.cancelled },
  ];

  return (
    <div className="space-y-6">
      {/* Counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Event counts">
        {countCards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-1.5 text-2xl font-extrabold text-foreground">
              {c.value === undefined ? (
                <span className="inline-block h-7 w-10 animate-pulse rounded bg-secondary" />
              ) : (
                c.value.toLocaleString()
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div role="tablist" aria-label="Event status" className="flex rounded-xl bg-secondary p-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => handleFilterChange(f.key)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
              filter === f.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by event title..."
          aria-label="Search by event title"
          className="w-full rounded-xl border border-border/50 bg-secondary py-3 pl-10 pr-10 text-sm text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/50"
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

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border border-border/50 bg-card py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-dashed border-border bg-card/50 p-6 py-14 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No events found</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {activeSearch
              ? `No events in this tab matched "${activeSearch}".`
              : 'There are no events in this tab yet.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => navigate(adminEventPath(event.id))}
                aria-label={`View details for ${event.title}`}
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all hover:border-primary/40 hover:bg-secondary/40 active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="truncate text-sm font-semibold text-foreground">{event.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatAdminDateTime(event.date)}
                    </p>
                  </div>
                  {event.organizer && <AdminPerson person={event.organizer} size="xs" />}
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  {isEventCancelled(event) && (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                      Cancelled
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Load more */}
      {page < totalPages && !loading && (
        <div className="pt-2 text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={handleLoadMore}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-5 py-2.5 text-xs font-semibold text-foreground transition-all hover:bg-secondary/80 active:scale-95 disabled:opacity-50"
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
  );
}
