import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Ban, Check, Search, Sparkles, UserMinus, UserPlus, Users, X, Loader2, Inbox, Send } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { useTopBarSearch } from '@/app/AppChrome';
import AppToast from '@/components/AppToast';
import ProfileLoadingRunner from '@/components/ProfileLoadingRunner';
import { UserAvatar } from '@/components/UserAvatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getCurrentUser } from '@/lib/storage';
import { hasSignedInSession } from '@/lib/signedIn';
import { invalidatePrefix } from '@/lib/queryCache';
import { invalidateNotifications } from '@/lib/queries';
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  fetchBlockedUsers,
  fetchFriendSuggestions,
  fetchFriends,
  fetchIncomingRequests,
  fetchSentRequests,
  FRIENDS_CHANGED_EVENT,
  removeFriend,
  searchUsers,
  sendFriendRequest,
  unblockUser,
  userAvatarUrl,
  userProfilePath,
  type BlockedUserItem,
  type FriendItem,
  type FriendRequestItem,
  type Page,
  type UserSearchResult,
  type UserSummary,
} from '@/lib/friendsApi';

type Section = 'friends' | 'incoming' | 'sent' | 'blocked' | 'discover';

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'discover', label: 'Discover' },
  { id: 'friends', label: 'Friends' },
  { id: 'incoming', label: 'Requests' },
  { id: 'sent', label: 'Sent' },
  { id: 'blocked', label: 'Blocked' },
];

const PAGE_SIZE = 20;
const SEARCH_PAGE_SIZE = 10;
export const SEARCH_DEBOUNCE_MS = 400;

type ListState<T> = { items: T[]; page: number; hasMore: boolean; loading: boolean; loaded: boolean; error: string };

const emptyList = <T,>(): ListState<T> => ({ items: [], page: 0, hasMore: false, loading: false, loaded: false, error: '' });

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.';
}

function withoutHiddenRequests<T>(items: T[], hidden: Set<number>): T[] {
  if (hidden.size === 0) return items;
  return items.filter((item) => {
    const id = (item as { request_id?: number }).request_id;
    return typeof id !== 'number' || !hidden.has(id);
  });
}

/** Paged list backed by one of the cached friendship fetchers. */
function usePagedList<T>(
  fetchPage: (page: number, limit: number) => Promise<Page<T>>,
  hiddenIds?: MutableRefObject<Set<number>>,
) {
  const [state, setState] = useState<ListState<T>>(emptyList<T>);

  const load = useCallback(
    async (page: number) => {
      setState((s) => ({ ...s, loading: true, error: '' }));
      try {
        const res = await fetchPage(page, PAGE_SIZE);
        const hidden = hiddenIds?.current ?? new Set<number>();
        setState((s) => ({
          items: withoutHiddenRequests(page === 1 ? res.data : [...s.items, ...res.data], hidden),
          page,
          hasMore: res.has_more,
          loading: false,
          loaded: true,
          error: '',
        }));
      } catch (err) {
        setState((s) => ({ ...s, loading: false, loaded: true, error: errorMessage(err) }));
      }
    },
    [fetchPage, hiddenIds],
  );

  return { state, setState, load };
}

function UserRow({
  user,
  onOpen,
  children,
}: {
  user: Pick<UserSummary, 'id' | 'username' | 'full_name' | 'avatar_kind' | 'icon_id' | 'avatar_url'> & { display_name?: string };
  onOpen: () => void;
  children?: React.ReactNode;
}) {
  const username = (user.username || '').trim();
  const fullName = (user.full_name || '').trim();
  const primary = fullName || (username ? `@${username}` : user.display_name) || 'Unknown user';
  const handle = username && fullName ? `@${username}` : null;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3 rounded-2xl glass-card px-4 py-3"
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <UserAvatar src={userAvatarUrl(user)} seed={user.id} name={primary} size="md" alt={`${primary}'s profile picture`} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{primary}</p>
          {handle && (
            <p className="truncate text-xs text-muted-foreground">{handle}</p>
          )}
        </div>
      </button>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </motion.li>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground glass-card rounded-3xl p-8">
      <Icon className="h-8 w-8 opacity-60 text-primary" />
      <p className="text-sm font-medium text-foreground">{text}</p>
    </div>
  );
}

function LoadMore({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mx-auto mt-2 flex items-center gap-2 rounded-2xl border border-border/60 bg-secondary/50 py-3 px-6 text-xs font-semibold text-primary hover:bg-secondary transition-colors disabled:opacity-60"
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      Load more
    </button>
  );
}

function ListBody<T>({
  list,
  emptyIcon,
  emptyText,
  onLoadMore,
  children,
}: {
  list: ListState<T>;
  emptyIcon: React.ElementType;
  emptyText: string;
  onLoadMore: () => void;
  children: React.ReactNode;
}) {
  if (!list.loaded && list.loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <>
      {list.error && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{list.error}</p>}
      {list.loaded && !list.error && list.items.length === 0 ? (
        <EmptyState icon={emptyIcon} text={emptyText} />
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
      {list.hasMore && <LoadMore onClick={onLoadMore} loading={list.loading} />}
    </>
  );
}

const actionBtn =
  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1';

export default function FriendsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUserId = getCurrentUser()?.id ?? null;

  const tabParam = searchParams.get('tab') as Section | null;
  const section: Section = SECTIONS.some((s) => s.id === tabParam) ? (tabParam as Section) : 'discover';
  const setSection = (id: Section) => setSearchParams({ tab: id }, { replace: true });

  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as 'error' | 'success' });
  const showError = (err: unknown) => setToast({ show: true, message: errorMessage(err), type: 'error' });

  const hiddenRequestIds = useRef(new Set<number>());
  const friends = usePagedList<FriendItem>(fetchFriends);
  const incoming = usePagedList<FriendRequestItem>(fetchIncomingRequests, hiddenRequestIds);
  const sent = usePagedList<FriendRequestItem>(fetchSentRequests, hiddenRequestIds);
  const blocked = usePagedList<BlockedUserItem>(fetchBlockedUsers);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<UserSummary | null>(null);
  const [pendingBlock, setPendingBlock] = useState<UserSummary | null>(null);
  const [pendingUnblock, setPendingUnblock] = useState<UserSummary | null>(null);
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  useEffect(() => {
    const refresh = () => {
      void friends.load(1);
      void incoming.load(1);
      void sent.load(1);
      void blocked.load(1);
    };
    refresh();
    window.addEventListener(FRIENDS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FRIENDS_CHANGED_EVENT, refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSuggestions = () => {
      setSuggestionsLoading(true);
      fetchFriendSuggestions()
        .then((rows) => {
          if (!cancelled) setSuggestions(rows);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setSuggestionsLoading(false);
        });
    };
    loadSuggestions();
    window.addEventListener(FRIENDS_CHANGED_EVENT, loadSuggestions);
    return () => {
      cancelled = true;
      window.removeEventListener(FRIENDS_CHANGED_EVENT, loadSuggestions);
    };
  }, []);

  const openProfile = (userId: string) => navigate(userProfilePath(userId, currentUserId));

  // ── Search State ────────────────────────────────────────────────────────
  const { search: query, setSearch: setQuery } = useTopBarSearch();
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searchPage, setSearchPage] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchedFor, setSearchedFor] = useState('');
  const latestQuery = useRef('');

  const runSearch = useCallback(async (q: string, page: number) => {
    setSearching(true);
    setSearchError('');
    try {
      const res = await searchUsers(q, page, SEARCH_PAGE_SIZE);
      if (latestQuery.current !== q) return;
      setResults((prev) => (page === 1 ? res.data : [...prev, ...res.data]));
      setSearchPage(page);
      setSearchHasMore(res.has_more);
      setSearchedFor(q);
    } catch (err) {
      if (latestQuery.current === q) setSearchError(errorMessage(err));
    } finally {
      if (latestQuery.current === q) setSearching(false);
    }
  }, []);

  useEffect(() => {
    const q = query.trim();
    latestQuery.current = q;
    setResults([]);
    setSearchHasMore(false);
    setSearchPage(0);
    setSearchError('');
    setSearchedFor('');
    if (!q) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => void runSearch(q, 1), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  // ── Actions ──────────────────────────────────────────────────────────────
  // The backend deletes the "friend request received" notification when a
  // request is accepted, declined or cancelled.
  const refreshNotifications = () => {
    invalidatePrefix('/api/notifications');
    invalidateNotifications();
  };

  const onAccept = async (req: FriendRequestItem) => {
    setBusyKey(`in:${req.request_id}`);
    hiddenRequestIds.current.add(req.request_id);
    try {
      const res = await acceptFriendRequest(req.request_id);
      refreshNotifications();
      incoming.setState((s) => ({ ...s, items: s.items.filter((r) => r.request_id !== req.request_id) }));
      friends.setState((s) => ({
        ...s,
        items: [res, ...s.items.filter((f) => f.user.id !== res.user.id)],
      }));
    } catch (err) {
      hiddenRequestIds.current.delete(req.request_id);
      showError(err);
    } finally {
      setBusyKey(null);
    }
  };

  const onDecline = async (req: FriendRequestItem) => {
    setBusyKey(`in:${req.request_id}`);
    hiddenRequestIds.current.add(req.request_id);
    try {
      await declineFriendRequest(req.request_id);
      refreshNotifications();
      incoming.setState((s) => ({ ...s, items: s.items.filter((r) => r.request_id !== req.request_id) }));
    } catch (err) {
      hiddenRequestIds.current.delete(req.request_id);
      showError(err);
    } finally {
      setBusyKey(null);
    }
  };

  const onCancel = async (req: FriendRequestItem) => {
    setBusyKey(`sent:${req.request_id}`);
    hiddenRequestIds.current.add(req.request_id);
    sent.setState((s) => ({ ...s, items: s.items.filter((r) => r.request_id !== req.request_id) }));
    try {
      await cancelFriendRequest(req.request_id);
      refreshNotifications();
    } catch (err) {
      hiddenRequestIds.current.delete(req.request_id);
      showError(err);
      void sent.load(1);
    } finally {
      setBusyKey(null);
    }
  };

  const onConfirmRemove = async () => {
    const user = pendingRemoval;
    setPendingRemoval(null);
    if (!user) return;
    setBusyKey(`friend:${user.id}`);
    try {
      await removeFriend(user.id);
      friends.setState((s) => ({ ...s, items: s.items.filter((f) => f.user.id !== user.id) }));
    } catch (err) {
      showError(err);
    } finally {
      setBusyKey(null);
    }
  };

  const onConfirmBlock = async () => {
    const user = pendingBlock;
    setPendingBlock(null);
    if (!user) return;
    setBusyKey(`block:${user.id}`);
    try {
      const blockedRow = await blockUser(user.id);
      friends.setState((s) => ({ ...s, items: s.items.filter((f) => f.user.id !== user.id) }));
      blocked.setState((s) => ({
        ...s,
        loaded: true,
        items: [{
          user: blockedRow.user ?? user,
          blocked_at: blockedRow.blocked_at ?? new Date().toISOString(),
        }, ...s.items.filter((b) => b.user.id !== user.id)],
      }));
      setToast({ show: true, message: `@${user.display_name || user.username || 'user'} has been blocked.`, type: 'success' });
    } catch (err) {
      showError(err);
    } finally {
      setBusyKey(null);
    }
  };

  const onConfirmUnblock = async () => {
    const user = pendingUnblock;
    setPendingUnblock(null);
    if (!user) return;
    setBusyKey(`unblock:${user.id}`);
    try {
      await unblockUser(user.id);
      blocked.setState((s) => ({ ...s, items: s.items.filter((b) => b.user.id !== user.id) }));
      setToast({ show: true, message: `@${user.display_name || user.username || 'user'} has been unblocked.`, type: 'success' });
    } catch (err) {
      showError(err);
    } finally {
      setBusyKey(null);
    }
  };

  const onSuggestAdd = async (person: UserSearchResult) => {
    setBusyKey(`suggest:${person.id}`);
    try {
      const res = await sendFriendRequest(person.id);
      setSuggestions((prev) => prev.filter((row) => row.id !== person.id));
      sent.setState((s) => ({
        ...s,
        loaded: true,
        items: [res, ...s.items.filter((row) => row.user.id !== person.id)],
      }));
      setToast({ show: true, message: 'Friend request sent', type: 'success' });
    } catch (err) {
      showError(err);
    } finally {
      setBusyKey(null);
    }
  };

  const knownIds = new Set<string>([
    ...(currentUserId ? [currentUserId] : []),
    ...friends.state.items.map((row) => row.user.id),
    ...incoming.state.items.map((row) => row.user.id),
    ...sent.state.items.map((row) => row.user.id),
    ...blocked.state.items.map((row) => row.user.id),
  ]);
  const visibleSuggestions = suggestions.filter((row) => !knownIds.has(row.id)).slice(0, 8);

  const counts: Partial<Record<Section, number>> = {
    friends: friends.state.loaded ? friends.state.items.length : undefined,
    incoming: incoming.state.loaded ? incoming.state.items.length : undefined,
    sent: sent.state.loaded ? sent.state.items.length : undefined,
    blocked: blocked.state.loaded ? blocked.state.items.length : undefined,
    discover: suggestionsLoading ? undefined : visibleSuggestions.length,
  };

  const hasActiveSearch = query.trim().length > 0;

  if (!hasSignedInSession()) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppToast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />
      {busyKey && <ProfileLoadingRunner overlay label="Loading…" />}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md">
        <header className="mx-auto flex max-w-lg items-center border-b border-border/60 px-4 py-2.5">
          <h1 className="text-base font-bold text-foreground">Friends</h1>
        </header>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
        {/* If user is actively searching, display search results view */}
        {hasActiveSearch ? (
          <section aria-label="Search results" className="space-y-3 pt-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Search Results</h2>
            {searchError && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{searchError}</p>}
            {searching && results.length === 0 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : results.length === 0 && !searchError ? (
              <EmptyState icon={Search} text={`No users found for “${query.trim()}”.`} />
            ) : (
              <ul className="space-y-2">
                {results.map((u) => (
                  <UserRow key={u.id} user={u} onOpen={() => openProfile(u.id)} />
                ))}
              </ul>
            )}
            {searchHasMore && <LoadMore onClick={() => void runSearch(searchedFor, searchPage + 1)} loading={searching} />}
          </section>
        ) : (
          <>
            {/* Highlighted Navigation Tabs */}
            <div role="tablist" aria-label="Friends sections" className="flex gap-1 rounded-2xl glass-card p-1">
              {SECTIONS.map(({ id, label }) => {
                const active = section === id;
                const count = counts[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSection(id)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-xl px-1.5 py-2.5 text-[11px] font-semibold transition-all sm:px-3 sm:text-xs ${
                      active
                        ? 'gradient-primary text-primary-foreground shadow-glow'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    }`}
                  >
                    <span>{label}</span>
                    {count !== undefined && count > 0 && (
                      <span className={`inline-flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full text-[10px] font-bold ${
                        active ? 'bg-background/25 text-inherit' : 'bg-secondary text-muted-foreground'
                      }`}>
                        {count}{id === 'incoming' && incoming.state.hasMore ? '+' : id === 'sent' && sent.state.hasMore ? '+' : id === 'blocked' && blocked.state.hasMore ? '+' : id === 'friends' && friends.state.hasMore ? '+' : ''}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {section === 'friends' && (
              <section aria-label="Your friends" className="pt-1">
                <ListBody
                  list={friends.state}
                  emptyIcon={Users}
                  emptyText="No friends yet. Open Discover or search by username to find people."
                  onLoadMore={() => void friends.load(friends.state.page + 1)}
                >
                  {friends.state.items.map((f) => (
                    <UserRow key={f.user.id} user={f.user} onOpen={() => openProfile(f.user.id)}>
                      <button
                        type="button"
                        onClick={() => setPendingBlock(f.user)}
                        disabled={busyKey === `block:${f.user.id}` || busyKey === `friend:${f.user.id}`}
                        className={`${actionBtn} bg-secondary text-foreground hover:bg-destructive/15 hover:text-destructive`}
                        aria-label={`Block ${f.user.display_name}`}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Block
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingRemoval(f.user)}
                        disabled={busyKey === `friend:${f.user.id}` || busyKey === `block:${f.user.id}`}
                        className={`${actionBtn} bg-secondary text-foreground hover:bg-destructive/15 hover:text-destructive`}
                        aria-label={`Remove ${f.user.display_name} from friends`}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </UserRow>
                  ))}
                </ListBody>
              </section>
            )}

            {section === 'discover' && (
              <section aria-label="Discover people" className="space-y-3 pt-1" data-testid="friends-discover">
                <div className="flex items-center gap-2 px-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold text-foreground">People you may know</h2>
                </div>
                <p className="text-[11px] text-muted-foreground px-1">Suggestions for people to add. Search by username to find anyone.</p>
                {suggestionsLoading && visibleSuggestions.length === 0 ? (
                  <div className="space-y-2" aria-busy="true">
                    <span className="sr-only">Loading suggestions</span>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-2xl glass-card px-4 py-3">
                        <div className="h-10 w-10 shrink-0 rounded-full shimmer" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-2/5 rounded-full shimmer" />
                          <div className="h-2.5 w-1/3 rounded-full shimmer" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : visibleSuggestions.length === 0 ? (
                  <EmptyState icon={Sparkles} text="No suggestions right now. Search by username to find people." />
                ) : (
                  <ul className="space-y-2">
                    {visibleSuggestions.map((person) => {
                      const name = person.full_name || person.username || 'Someone';
                      return (
                        <UserRow key={person.id} user={person} onOpen={() => openProfile(person.id)}>
                          <button
                            type="button"
                            onClick={() => void onSuggestAdd(person)}
                            disabled={busyKey === `suggest:${person.id}`}
                            className={`${actionBtn} gradient-primary text-primary-foreground`}
                            aria-label={`Add ${name}`}
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Add
                          </button>
                        </UserRow>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {section === 'incoming' && (
              <section aria-label="Incoming friend requests" className="pt-1">
                <ListBody
                  list={incoming.state}
                  emptyIcon={Inbox}
                  emptyText="No friend requests right now."
                  onLoadMore={() => void incoming.load(incoming.state.page + 1)}
                >
                  {incoming.state.items.map((r) => (
                    <UserRow key={r.request_id} user={r.user} onOpen={() => openProfile(r.user.id)}>
                      <button
                        type="button"
                        onClick={() => void onAccept(r)}
                        disabled={busyKey === `in:${r.request_id}`}
                        className={`${actionBtn} gradient-primary text-primary-foreground`}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDecline(r)}
                        disabled={busyKey === `in:${r.request_id}`}
                        className={`${actionBtn} bg-secondary text-foreground hover:bg-secondary/80`}
                      >
                        <X className="h-3.5 w-3.5" />
                        Decline
                      </button>
                    </UserRow>
                  ))}
                </ListBody>
              </section>
            )}

            {section === 'blocked' && (
              <section aria-label="Blocked users" className="pt-1">
                <ListBody
                  list={blocked.state}
                  emptyIcon={Ban}
                  emptyText="You have not blocked anyone."
                  onLoadMore={() => void blocked.load(blocked.state.page + 1)}
                >
                  {blocked.state.items.map((b) => (
                    <UserRow key={b.user.id} user={b.user} onOpen={() => openProfile(b.user.id)}>
                      <button
                        type="button"
                        onClick={() => setPendingUnblock(b.user)}
                        disabled={busyKey === `unblock:${b.user.id}`}
                        className={`${actionBtn} bg-secondary text-foreground hover:bg-secondary/80`}
                        aria-label={`Unblock ${b.user.display_name}`}
                      >
                        Unblock
                      </button>
                    </UserRow>
                  ))}
                </ListBody>
              </section>
            )}

            {section === 'sent' && (
              <section aria-label="Sent friend requests" className="pt-1">
                <ListBody
                  list={sent.state}
                  emptyIcon={Send}
                  emptyText="You have no pending sent requests."
                  onLoadMore={() => void sent.load(sent.state.page + 1)}
                >
                  {sent.state.items.map((r) => (
                    <UserRow key={r.request_id} user={r.user} onOpen={() => openProfile(r.user.id)}>
                      <button
                        type="button"
                        onClick={() => void onCancel(r)}
                        disabled={busyKey === `sent:${r.request_id}`}
                        className={`${actionBtn} bg-secondary text-foreground hover:bg-destructive/15 hover:text-destructive`}
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </UserRow>
                  ))}
                </ListBody>
              </section>
            )}
          </>
        )}
      </div>

      <AlertDialog open={pendingRemoval !== null} onOpenChange={(open) => !open && setPendingRemoval(null)}>
        <AlertDialogContent className="rounded-3xl glass-card border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove friend?</AlertDialogTitle>
            <AlertDialogDescription>
              @{pendingRemoval?.display_name} will be removed from your friends. They won't be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Keep</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onConfirmRemove()} className="rounded-2xl bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingBlock !== null} onOpenChange={(open) => !open && setPendingBlock(null)}>
        <AlertDialogContent className="rounded-3xl glass-card border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Block this person?</AlertDialogTitle>
            <AlertDialogDescription>
              @{pendingBlock?.display_name} will be removed from your friends and added to your blocked list. You can unblock them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onConfirmBlock()} className="rounded-2xl bg-destructive text-destructive-foreground">Block</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingUnblock !== null} onOpenChange={(open) => !open && setPendingUnblock(null)}>
        <AlertDialogContent className="rounded-3xl glass-card border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock this person?</AlertDialogTitle>
            <AlertDialogDescription>
              Your previous friendship with @{pendingUnblock?.display_name} will not be restored. To be friends again, one of you will need to send a new friend request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Keep blocked</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onConfirmUnblock()} className="rounded-2xl gradient-primary text-primary-foreground">Unblock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}