import { useEffect, useState, useRef, useCallback } from 'react';
import { Search, Users, ShieldCheck, UserCheck, Loader2, X, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { UserAvatar } from '@/components/UserAvatar';
import AdminUserDetailsModal from './AdminUserDetailsModal';
import {
  fetchAdminCounts,
  fetchAdminUsers,
  type AdminUserSummary,
} from '@/lib/adminApi';

interface AdminUsersTabProps {
  onErrorToast: (msg: string) => void;
  onSuccessToast: (msg: string) => void;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

export default function AdminUsersTab({ onErrorToast, onSuccessToast }: AdminUsersTabProps) {
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

  // Selected user for details modal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

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
      .catch(() => {
        // Fallback or non-blocking
      })
      .finally(() => {
        if (!cancelled) setLoadingCounts(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch users list
  const loadUsers = useCallback(
    async (targetPage: number, query: string, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingUsers(true);
      }

      try {
        const res = await fetchAdminUsers(targetPage, PAGE_SIZE, query);
        setUsers((prev) => (append ? [...prev, ...res.items] : res.items));
        setPage(res.page);
        setTotalPages(res.total_pages);
        // Fallback to res.total only if counts endpoint did not supply total_users
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
    void loadUsers(1, '');
  }, [loadUsers]);

  // Handle debounced search input change
  const handleSearchChange = (value: string) => {
    setSearchInput(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const trimmed = value.trim();
      setActiveSearch(trimmed);
      void loadUsers(1, trimmed, false);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    void loadUsers(1, '', false);
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      void loadUsers(page + 1, activeSearch, true);
    }
  };

  const handleOpenUser = (userId: string) => {
    setSelectedUserId(userId);
    setModalOpen(true);
  };

  const handleRoleGranted = (updatedUserId: string) => {
    // Update role in list dynamically without page reload
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUserId ? { ...u, role: 'administrator' } : u)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Total Registered Users Card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Registered Users
            </p>
            <h2 className="mt-1.5 text-3xl font-extrabold text-foreground">
              {loadingCounts && totalUsers === null ? (
                <span className="inline-block h-8 w-16 animate-pulse rounded bg-secondary" />
              ) : (
                (totalUsers ?? users.length).toLocaleString()
              )}
            </h2>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search users by username..."
          aria-label="Search users by username"
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

      {/* User List Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {activeSearch ? `Search Results for "${activeSearch}"` : 'Registered Users'}
          </p>
          <span className="text-xs text-muted-foreground">
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </span>
        </div>

        {loadingUsers ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border border-border/50 bg-card">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center rounded-2xl border border-dashed border-border bg-card/50 p-6 space-y-2">
            <Users className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No users found</p>
            <p className="text-xs text-muted-foreground max-w-xs">
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
                    onClick={() => handleOpenUser(u.id)}
                    aria-label={`View details for ${u.full_name}`}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all hover:bg-secondary/40 hover:border-primary/40 active:scale-[0.99]"
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
                        {/* If no username, appear with full name alone */}
                        <p className="text-sm font-semibold text-foreground truncate">{u.full_name}</p>
                        {hasUsername && (
                          <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <UserCheck className="h-3 w-3" />
                          User
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
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
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary/80 active:scale-95 transition-all disabled:opacity-50"
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

      {/* Selected User Details Modal */}
      <AdminUserDetailsModal
        userId={selectedUserId}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedUserId(null);
        }}
        onRoleGranted={handleRoleGranted}
        onErrorToast={onErrorToast}
        onSuccessToast={onSuccessToast}
      />
    </div>
  );
}
