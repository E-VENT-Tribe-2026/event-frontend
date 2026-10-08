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
      <span
        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: 'hsl(0 84% 60% / .15)',
          color: 'var(--adm-danger-text)',
          borderColor: 'hsl(0 84% 60% / .3)',
        }}
      >
        <XCircle className="h-3 w-3" />
        Cancelled
      </span>
    );
  }
  const now = Date.now();
  const eventDate = new Date(event.date).getTime();
  if (eventDate > now) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
        style={{
          background: 'hsl(199 90% 70% / .12)',
          color: 'var(--adm-info-text)',
          borderColor: 'hsl(199 90% 70% / .3)',
        }}
      >
        <Clock className="h-3 w-3" />
        Upcoming
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        background: 'var(--adm-secondary)',
        color: 'var(--adm-muted-fg)',
      }}
    >
      <CheckCircle2 className="h-3 w-3" />
      Past
    </span>
  );
}

export default function AdminEventsTab({
  onOpenEvent,
  onErrorToast,
}: AdminEventsTabProps) {
  const [counts, setCounts] = useState<{
    total: number;
    upcoming: number;
    past: number;
    cancelled: number;
  } | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);

  const [events, setEvents] = useState<AdminEventSummaryFull[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      iconStyle: { background: 'hsl(271 76% 53% / .18)', color: 'var(--adm-primary)' },
    },
    {
      label: 'Upcoming',
      value: counts?.upcoming ?? null,
      icon: <Clock className="h-5 w-5" />,
      iconStyle: { background: 'hsl(199 90% 70% / .15)', color: 'var(--adm-info-text)' },
    },
    {
      label: 'Past',
      value: counts?.past ?? null,
      icon: <CheckCircle2 className="h-5 w-5" />,
      iconStyle: { background: 'var(--adm-secondary)', color: 'var(--adm-muted-fg)' },
    },
    {
      label: 'Cancelled',
      value: counts?.cancelled ?? null,
      icon: <XCircle className="h-5 w-5" />,
      iconStyle: { background: 'hsl(0 84% 60% / .15)', color: 'var(--adm-danger-text)' },
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
            className="rounded-[16px] border p-4 space-y-2"
            style={{
              background: 'var(--adm-grad-card)',
              borderColor: 'var(--adm-border)',
              boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                ...card.iconStyle,
              }}
            >
              {card.icon}
            </div>
            <div>
              <p
                className="text-[11px] font-medium uppercase tracking-wider leading-tight"
                style={{ color: 'var(--adm-muted-fg)' }}
              >
                {card.label}
              </p>
              <p className="text-2xl font-extrabold mt-0.5" style={{ color: 'var(--adm-fg)' }}>
                {loadingCounts && card.value === null ? (
                  <span
                    className="inline-block h-7 w-10 animate-pulse rounded"
                    style={{ background: 'var(--adm-secondary)' }}
                  />
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
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: 'var(--adm-muted-fg)' }}
        />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search events by title..."
          aria-label="Search events by title"
          className="w-full rounded-[12px] border pl-10 pr-10 text-sm outline-none transition-colors"
          style={{
            background: 'var(--adm-card)',
            borderColor: searchFocused ? 'hsl(271 76% 53% / .7)' : 'var(--adm-border)',
            boxShadow: searchFocused ? '0 0 0 3px hsl(271 76% 53% / .15)' : 'none',
            color: 'var(--adm-fg)',
            height: 44,
            paddingTop: '0.75rem',
            paddingBottom: '0.75rem',
          }}
        />
        {searchInput && (
          <button
            type="button"
            onClick={handleClearSearch}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1"
            style={{ color: 'var(--adm-muted-fg)' }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div
        role="tablist"
        aria-label="Event filter"
        className="flex gap-1.5 rounded-[14px] border p-1"
        style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
      >
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeSubTab === tab.id}
            onClick={() => handleSubTabChange(tab.id)}
            className="flex-1 rounded-xl py-2 text-xs font-semibold transition-all"
            style={
              activeSubTab === tab.id
                ? {
                    background: 'var(--adm-grad)',
                    color: 'white',
                    boxShadow: 'var(--adm-shadow-glow)',
                  }
                : {
                    background: 'transparent',
                    color: 'var(--adm-muted-fg)',
                  }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Event List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--adm-muted-fg)' }}
          >
            {activeSearch ? `Results for "${activeSearch}"` : 'Events'}
          </p>
          <span className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </span>
        </div>

        {loadingEvents ? (
          <div
            className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border"
            style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
          >
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--adm-primary)' }} />
            <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              Loading events...
            </p>
          </div>
        ) : events.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-14 text-center rounded-2xl border border-dashed p-6 space-y-2"
            style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
          >
            <Calendar className="h-10 w-10 opacity-50" style={{ color: 'var(--adm-muted-fg)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--adm-fg)' }}>
              No events found
            </p>
            <p className="text-xs max-w-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              {activeSearch
                ? `No events matched "${activeSearch}".`
                : 'There are no events in this category yet.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => {
              const isHovered = hoveredRow === event.id;
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => onOpenEvent(event.id)}
                    onMouseEnter={() => setHoveredRow(event.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    aria-label={`View event ${event.title}`}
                    className="group w-full flex items-center gap-3 rounded-[12px] border p-3.5 text-left transition-all active:scale-[0.99]"
                    style={{
                      background: isHovered ? 'hsl(213 50% 17%)' : 'var(--adm-card)',
                      borderColor: isHovered ? 'hsl(271 76% 53% / .55)' : 'var(--adm-border)',
                    }}
                  >
                    {/* Organizer initial thumbnail */}
                    <div
                      className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-sm font-bold text-white select-none"
                      style={{
                        background: 'linear-gradient(135deg, hsl(213 50% 22%), hsl(213 50% 17%))',
                      }}
                      aria-hidden="true"
                    >
                      {(event.organizer_name?.[0] ?? '?').toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{ color: 'var(--adm-fg)' }}
                      >
                        {event.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                          {formatDate(event.date)}
                        </p>
                        <span style={{ color: 'var(--adm-muted-fg)', opacity: 0.4 }}>·</span>
                        <p className="text-xs truncate" style={{ color: 'var(--adm-muted-fg)' }}>
                          {event.organizer_name}
                        </p>
                      </div>
                    </div>

                    {/* Status pill + chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusPill event={event} />
                      <ChevronRight
                        className="h-4 w-4 transition-colors"
                        style={{
                          color: isHovered ? 'var(--adm-fg)' : 'var(--adm-muted-fg)',
                        }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Load More */}
        {page < totalPages && !loadingEvents && (
          <div className="pt-2 text-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={handleLoadMore}
              className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-semibold transition-all disabled:opacity-50 active:scale-95"
              style={{
                borderColor: 'var(--adm-border)',
                background: 'var(--adm-secondary)',
                color: 'var(--adm-fg)',
              }}
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
