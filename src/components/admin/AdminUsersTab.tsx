import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  Users,
  Loader2,
  X,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
  Shield,
  Ban,
  Star,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { UserAvatar } from '@/components/UserAvatar';
import { fetchAdminUsers, type AdminUserSummary } from '@/lib/adminApi';

type FilterChip = 'all' | 'administrators' | 'suspended' | 'with_warnings' | 'pro';

type UserRow = AdminUserSummary & {
  is_suspended?: boolean;
  warnings_count?: number;
  is_pro?: boolean;
};

interface AdminUsersTabProps {
  onOpenUser: (userId: string) => void;
  onErrorToast: (msg: string) => void;
}

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

const FILTER_LABELS: Record<FilterChip, string> = {
  all: 'All',
  administrators: 'Administrators',
  suspended: 'Suspended',
  with_warnings: 'With warnings',
  pro: 'Pro',
};

const FILTER_ICONS: Partial<Record<FilterChip, typeof Shield>> = {
  administrators: Shield,
  suspended: Ban,
  with_warnings: AlertTriangle,
  pro: Star,
};

const isAdminUser = (u: UserRow) => (u.role ?? '').toLowerCase().includes('admin');
const isSuspendedUser = (u: UserRow) => Boolean(u.is_suspended);
const hasWarnings = (u: UserRow) => (u.warnings_count ?? 0) > 0;
const isProUser = (u: UserRow) => Boolean(u.is_pro);

const FILTER_PREDICATES: Record<FilterChip, (u: UserRow) => boolean> = {
  all: () => true,
  administrators: isAdminUser,
  suspended: isSuspendedUser,
  with_warnings: hasWarnings,
  pro: isProUser,
};

export default function AdminUsersTab({ onOpenUser, onErrorToast }: AdminUsersTabProps) {
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [allFetchedUsers, setAllFetchedUsers] = useState<UserRow[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeSearch, setActiveSearch] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  // Search query for which every page is already loaded (null = not fully loaded)
  const fullyLoadedRef = useRef<string | null>(null);
  const onErrorToastRef = useRef(onErrorToast);
  onErrorToastRef.current = onErrorToast;

  // Filtering is derived from the loaded data, so switching chips is instant once loaded
  const users = useMemo(
    () => allFetchedUsers.filter(FILTER_PREDICATES[activeFilter]),
    [allFetchedUsers, activeFilter],
  );

  const loadUsers = useCallback(
    async (
      targetPage: number,
      query: string,
      opts: { append?: boolean; loadAll?: boolean } = {},
    ) => {
      const reqId = ++requestIdRef.current;
      if (opts.append) {
        setLoadingMore(true);
      } else {
        setLoadingUsers(true);
        setLoadingMore(false);
      }

      try {
        let current = targetPage;
        let items: UserRow[] = [];
        let last;

        // Fetch one page, or every remaining page when loadAll is set
        while (true) {
          const res = await fetchAdminUsers(current, PAGE_SIZE, query.trim() || undefined);
          if (reqId !== requestIdRef.current) return;
          items = items.concat(res.items as UserRow[]);
          last = res;
          if (!opts.loadAll || res.page >= res.total_pages) break;
          current = res.page + 1;
        }

        setAllFetchedUsers((prev) => {
          const combined = opts.append ? [...prev, ...items] : items;
          return Array.from(new Map(combined.map((u) => [u.id, u])).values());
        });

        setPage(last.page);
        setTotalPages(last.total_pages);
        fullyLoadedRef.current = last.page >= last.total_pages ? query.trim() : null;

        if (!query.trim() && last.total !== undefined) {
          setTotalUsers(last.total);
        }
      } catch (err) {
        if (reqId !== requestIdRef.current) return;
        onErrorToastRef.current(err instanceof Error ? err.message : 'Failed to fetch users');
      } finally {
        if (reqId === requestIdRef.current) {
          setLoadingUsers(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  // Runs on mount and whenever the search or filter changes
  useEffect(() => {
    if (fullyLoadedRef.current === activeSearch) return; // everything already in memory
    void loadUsers(1, activeSearch, { loadAll: activeFilter !== 'all' });
  }, [activeSearch, activeFilter, loadUsers]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(
      () => setActiveSearch(value.trim()),
      SEARCH_DEBOUNCE_MS,
    );
  };

  const handleClearSearch = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setSearchInput('');
    setActiveSearch('');
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      void loadUsers(page + 1, activeSearch, { append: true });
    }
  };

  return (
    <div className="space-y-4">
      {/* Registered users card */}
      <div
        className="rounded-[18px] border p-4 sm:p-5"
        style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: 'hsl(210 80% 50% / .18)', color: 'hsl(210 90% 60%)' }}
          >
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2
              className="text-2xl font-bold leading-none tracking-tight"
              style={{ color: 'var(--adm-fg)' }}
            >
              {totalUsers === null ? (
                <span
                  className="inline-block h-6 w-10 animate-pulse rounded"
                  style={{ background: 'var(--adm-secondary)' }}
                />
              ) : (
                totalUsers.toLocaleString()
              )}
            </h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              Registered users
            </p>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(FILTER_LABELS) as FilterChip[]).map((chip) => {
          const isActive = activeFilter === chip;
          const Icon = FILTER_ICONS[chip];
          return (
            <button
              key={chip}
              type="button"
              onClick={() => setActiveFilter(chip)}
              aria-pressed={isActive}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-all"
              style={
                isActive
                  ? {
                      background: 'hsl(271 76% 53%)',
                      borderColor: 'hsl(271 76% 53%)',
                      color: 'white',
                      boxShadow: '0 0 14px hsl(271 76% 53% / .45)',
                    }
                  : {
                      background: 'var(--adm-card)',
                      borderColor: 'var(--adm-border)',
                      color: 'var(--adm-fg)',
                    }
              }
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              <span>{FILTER_LABELS[chip]}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: 'var(--adm-muted-fg)' }}
        />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search by username..."
          aria-label="Search by username"
          className="w-full rounded-[14px] border pl-11 pr-10 text-sm outline-none transition-colors"
          style={{
            background: 'var(--adm-card)',
            borderColor: searchFocused ? 'hsl(271 76% 53% / .7)' : 'var(--adm-border)',
            boxShadow: searchFocused ? '0 0 0 3px hsl(271 76% 53% / .15)' : 'none',
            color: 'var(--adm-fg)',
            height: 44,
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

      {/* List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p
            className="text-[11px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--adm-muted-fg)' }}
          >
            User
          </p>
          <span className="text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
            Role · warnings · status
          </span>
        </div>

        {loadingUsers ? (
          <div
            className="flex flex-col items-center justify-center space-y-3 rounded-2xl border py-16"
            style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
          >
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--adm-primary)' }} />
            <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              Loading users...
            </p>
          </div>
        ) : users.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-dashed p-6 py-14 text-center"
            style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
          >
            <Users className="h-10 w-10 opacity-50" style={{ color: 'var(--adm-muted-fg)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--adm-fg)' }}>
              No users found
            </p>
            <p className="max-w-xs text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              {activeSearch
                ? `No user accounts matched "${activeSearch}". Try another search term.`
                : 'No users match this filter.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => {
              const isAdmin = isAdminUser(u);
              const suspended = isSuspendedUser(u);
              const warnings = u.warnings_count ?? 0;
              const hasUsername = Boolean(u.username && u.username.trim());
              const isHovered = hoveredRow === u.id;

              return (
                <motion.li
                  key={u.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <button
                    type="button"
                    onClick={() => onOpenUser(u.id)}
                    onMouseEnter={() => setHoveredRow(u.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    aria-label={`View details for ${u.full_name}`}
                    className="flex w-full items-center justify-between gap-3 rounded-[14px] border px-4 py-3.5 text-left transition-all active:scale-[0.99]"
                    style={{
                      background: isHovered ? 'hsl(213 50% 17%)' : 'var(--adm-card)',
                      borderColor: isHovered ? 'hsl(271 76% 53% / .55)' : 'var(--adm-border)',
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <UserAvatar
                        src={u.avatar_url}
                        srcSecondary={u.avatar_url}
                        seed={u.id}
                        name={u.full_name}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-semibold"
                          style={{ color: 'var(--adm-fg)' }}
                        >
                          {u.full_name}
                        </p>
                        {hasUsername && (
                          <p
                            className="truncate text-xs"
                            style={{ color: 'var(--adm-muted-fg)' }}
                          >
                            @{u.username}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {isProUser(u) && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold"
                          style={{
                            background: 'hsl(45 93% 50% / .15)',
                            color: 'hsl(45 93% 60%)',
                            borderColor: 'hsl(45 93% 50% / .35)',
                          }}
                        >
                          <Star className="h-3 w-3" />
                          Pro
                        </span>
                      )}

                      {warnings > 0 && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold"
                          style={{
                            background: 'hsl(38 92% 52% / .15)',
                            color: 'var(--adm-warn-text)',
                            borderColor: 'hsl(38 92% 52% / .35)',
                          }}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {warnings}
                        </span>
                      )}

                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                        style={
                          suspended
                            ? {
                                background: 'hsl(0 72% 51% / .15)',
                                color: 'hsl(0 85% 70%)',
                                borderColor: 'hsl(0 72% 51% / .4)',
                              }
                            : {
                                background: 'hsl(142 70% 45% / .15)',
                                color: 'hsl(142 70% 60%)',
                                borderColor: 'hsl(142 70% 45% / .35)',
                              }
                        }
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: suspended ? 'hsl(0 85% 70%)' : 'hsl(142 70% 60%)' }}
                        />
                        {suspended ? 'Suspended' : 'Active'}
                      </span>

                      {isAdmin ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            background: 'hsl(271 76% 53% / .18)',
                            color: 'var(--adm-primary-text)',
                            borderColor: 'hsl(271 76% 53% / .4)',
                          }}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                          style={{
                            background: 'var(--adm-secondary)',
                            borderColor: 'var(--adm-border)',
                            color: 'hsl(213 20% 78%)',
                          }}
                        >
                          User
                        </span>
                      )}

                      <ChevronRight
                        className="h-4 w-4 transition-colors"
                        style={{ color: isHovered ? 'var(--adm-fg)' : 'var(--adm-muted-fg)' }}
                      />
                    </div>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}

        {/* Load more (only for "All"; other filters load everything up front) */}
        {activeFilter === 'all' && page < totalPages && !loadingUsers && (
          <div className="pt-1 text-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={handleLoadMore}
              className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
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
                'Load More Users'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}