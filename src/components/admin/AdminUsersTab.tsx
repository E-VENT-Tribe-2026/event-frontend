import { useEffect, useState, useRef, useCallback } from 'react';
import { Search, Users, ShieldCheck, UserCheck, Loader2, X, ChevronRight, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { UserAvatar } from '@/components/UserAvatar';
import {
  fetchAdminCounts,
  fetchAdminUsers,
  type AdminUserSummary,
} from '@/lib/adminApi';

type FilterChip = 'all' | 'administrators' | 'suspended' | 'with_warnings';

interface AdminUsersTabProps {
  onOpenUser: (userId: string) => void;
  onErrorToast: (msg: string) => void;
  onSuccessToast: (msg: string) => void;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const FILTER_LABELS: Record<FilterChip, string> = {
  all: 'All',
  administrators: 'Administrators',
  suspended: 'Suspended',
  with_warnings: 'With Warnings',
};

export default function AdminUsersTab({ onOpenUser, onErrorToast }: AdminUsersTabProps) {
  // Counts
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [loadingCounts, setLoadingCounts] = useState<boolean>(true);

  // Users list & search
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
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
  const countsFetchedRef = useRef<boolean>(false);

  // Load counts on mount
  useEffect(() => {
    let cancelled = false;
    fetchAdminCounts()
      .then((data) => {
        if (!cancelled && typeof data.total_users === 'number') {
          countsFetchedRef.current = true;
          setTotalUsers(data.total_users);
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

  // Fetch users list
  const loadUsers = useCallback(
    async (targetPage: number, query: string, filter: FilterChip, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingUsers(true);
      }

      try {
        const searchParam = query.trim();
        const res = await fetchAdminUsers(targetPage, PAGE_SIZE, searchParam || undefined);

        let items = res.items;
        if (filter === 'administrators') {
          items = items.filter((u) => u.role === 'administrator');
        } else if (filter === 'suspended') {
          items = items.filter((u) => (u as AdminUserSummary & { is_suspended?: boolean }).is_suspended);
        } else if (filter === 'with_warnings') {
          items = items.filter(
            (u) =>
              (u as AdminUserSummary & { warnings_count?: number }).warnings_count !== undefined &&
              ((u as AdminUserSummary & { warnings_count?: number }).warnings_count ?? 0) > 0,
          );
        }

        setUsers((prev) => (append ? [...prev, ...items] : items));
        setPage(res.page);
        setTotalPages(res.total_pages);
        if (!countsFetchedRef.current && !query.trim()) {
          setTotalUsers((prev) => (prev !== null ? prev : res.total));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch users';
        onErrorToast(msg);
      } finally {
        setLoadingUsers(false);
        setLoadingMore(false);
      }
    },
    [onErrorToast],
  );

  // Initial load
  useEffect(() => {
    void loadUsers(1, '', 'all');
  }, [loadUsers]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const trimmed = value.trim();
      setActiveSearch(trimmed);
      void loadUsers(1, trimmed, activeFilter, false);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    void loadUsers(1, '', activeFilter, false);
  };

  const handleFilterChange = (filter: FilterChip) => {
    setActiveFilter(filter);
    void loadUsers(1, activeSearch, filter, false);
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      void loadUsers(page + 1, activeSearch, activeFilter, true);
    }
  };

  // Compute counts per filter for chips
  const filterCounts: Record<FilterChip, number> = {
    all: totalUsers ?? users.length,
    administrators: users.filter((u) => u.role === 'administrator').length,
    suspended: users.filter((u) => (u as AdminUserSummary & { is_suspended?: boolean }).is_suspended).length,
    with_warnings: users.filter(
      (u) => ((u as AdminUserSummary & { warnings_count?: number }).warnings_count ?? 0) > 0,
    ).length,
  };

  return (
    <div className="space-y-6">
      {/* Total Registered Users Card */}
      <div
        className="rounded-[16px] border p-5"
        style={{
          background: 'var(--adm-grad-card)',
          borderColor: 'var(--adm-border)',
          boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--adm-muted-fg)' }}
            >
              Total Registered Users
            </p>
            <h2 className="mt-1.5 text-3xl font-extrabold" style={{ color: 'var(--adm-fg)' }}>
              {loadingCounts && totalUsers === null ? (
                <span
                  className="inline-block h-8 w-16 animate-pulse rounded"
                  style={{ background: 'var(--adm-secondary)' }}
                />
              ) : (
                (totalUsers ?? users.length).toLocaleString()
              )}
            </h2>
          </div>
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'hsl(271 76% 53% / .18)', color: 'var(--adm-primary)' }}
          >
            <Users className="h-6 w-6" />
          </div>
        </div>
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
          placeholder="Search users by username..."
          aria-label="Search users by username"
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

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(FILTER_LABELS) as FilterChip[]).map((chip) => {
          const isActive = activeFilter === chip;
          return (
            <button
              key={chip}
              type="button"
              onClick={() => handleFilterChange(chip)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all"
              style={
                isActive
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
              {chip === 'administrators' && <ShieldCheck className="h-3 w-3" />}
              {chip === 'suspended' && <X className="h-3 w-3" />}
              {chip === 'with_warnings' && <AlertTriangle className="h-3 w-3" />}
              {FILTER_LABELS[chip]}
              {chip !== 'all' && (
                <span className="font-bold">{filterCounts[chip]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* User List Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--adm-muted-fg)' }}
          >
            {activeSearch ? `Search Results for "${activeSearch}"` : 'Registered Users'}
          </p>
          <span className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </span>
        </div>

        {loadingUsers ? (
          <div
            className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border"
            style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
          >
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--adm-primary)' }} />
            <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              Loading users...
            </p>
          </div>
        ) : users.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-14 text-center rounded-2xl border border-dashed p-6 space-y-2"
            style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
          >
            <Users className="h-10 w-10 opacity-50" style={{ color: 'var(--adm-muted-fg)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--adm-fg)' }}>
              No users found
            </p>
            <p className="text-xs max-w-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              {activeSearch
                ? `No user accounts matched "${activeSearch}". Try another search term.`
                : 'There are no registered accounts in the system yet.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => {
              const isAdmin = u.role === 'administrator';
              const hasUsername = Boolean(u.username && u.username.trim());
              const isHovered = hoveredRow === u.id;

              return (
                <motion.li
                  key={u.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative"
                >
                  <button
                    type="button"
                    onClick={() => onOpenUser(u.id)}
                    onMouseEnter={() => setHoveredRow(u.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    aria-label={`View details for ${u.full_name}`}
                    className="w-full flex items-center justify-between gap-3 rounded-[12px] border p-3.5 text-left transition-all active:scale-[0.99]"
                    style={{
                      background: isHovered ? 'hsl(213 50% 17%)' : 'var(--adm-card)',
                      borderColor: isHovered ? 'hsl(271 76% 53% / .55)' : 'var(--adm-border)',
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        src={u.avatar_url}
                        srcSecondary={u.avatar_url}
                        seed={u.id}
                        name={u.full_name}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{ color: 'var(--adm-fg)' }}
                        >
                          {u.full_name}
                        </p>
                        {hasUsername && (
                          <p className="text-xs truncate" style={{ color: 'var(--adm-muted-fg)' }}>
                            @{u.username}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {isAdmin ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
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
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            background: 'var(--adm-secondary)',
                            color: 'hsl(213 20% 78%)',
                          }}
                        >
                          <UserCheck className="h-3 w-3" />
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

        {/* Load More Button */}
        {page < totalPages && !loadingUsers && (
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
                'Load More Users'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
