import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Search, UserMinus, Users, X, Loader2, Inbox, Send } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import AppToast from '@/components/AppToast';
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
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriends,
  fetchIncomingRequests,
  fetchSentRequests,
  removeFriend,
  searchUsers,
  userAvatarUrl,
  userProfilePath,
  type FriendItem,
  type FriendRequestItem,
  type Page,
  type UserSearchResult,
  type UserSummary,
} from '@/lib/friendsApi';

type Section = 'friends' | 'search' | 'incoming' | 'sent';

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'friends', label: 'Friends' },
  { id: 'search', label: 'Search' },
  { id: 'incoming', label: 'Requests' },
  { id: 'sent', label: 'Sent' },
];

const PAGE_SIZE = 20;
const SEARCH_PAGE_SIZE = 10;
export const SEARCH_DEBOUNCE_MS = 400;

type ListState<T> = { items: T[]; page: number; hasMore: boolean; loading: boolean; loaded: boolean; error: string };

const emptyList = <T,>(): ListState<T> => ({ items: [], page: 0, hasMore: false, loading: false, loaded: false, error: '' });

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.';
}

/** Paged list backed by one of the cached friendship fetchers. */
function usePagedList<T>(fetchPage: (page: number, limit: number) => Promise<Page<T>>) {
  const [state, setState] = useState<ListState<T>>(emptyList<T>);

  const load = useCallback(
    async (page: number) => {
      setState((s) => ({ ...s, loading: true, error: '' }));
      try {
        const res = await fetchPage(page, PAGE_SIZE);
        setState((s) => ({
          items: page === 1 ? res.data : [...s.items, ...res.data],
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
    [fetchPage],
  );

  return { state, setState, load };
}

function UserRow({
  user,
  showFullName = true,
  onOpen,
  children,
}: {
  user: Pick<UserSummary, 'id' | 'username' | 'full_name' | 'avatar_kind' | 'icon_id' | 'avatar_url'> & { display_name?: string };
  showFullName?: boolean;
  onOpen: () => void;
  children?: React.ReactNode;
}) {
  const label = user.username || user.display_name || user.full_name || 'Unknown user';
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3 rounded-2xl glass-card px-4 py-3"
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <UserAvatar src={userAvatarUrl(user)} seed={user.id} name={label} size="md" alt={`${label}'s profile picture`} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">@{label}</p>
          {showFullName && user.full_name && (
            <p className="truncate text-xs text-muted-foreground">{user.full_name}</p>
          )}
        </div>
      </button>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </motion.li>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
      <Icon className="h-8 w-8 opacity-60" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function LoadMore({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mx-auto mt-2 flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary/80 disabled:opacity-60"
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1';

export default function FriendsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUserId = getCurrentUser()?.id ?? null;

  const tabParam = searchParams.get('tab') as Section | null;
  const section: Section = SECTIONS.some((s) => s.id === tabParam) ? (tabParam as Section) : 'friends';
  const setSection = (id: Section) => setSearchParams({ tab: id }, { replace: true });

  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as 'error' | 'success' });
  const showError = (err: unknown) => setToast({ show: true, message: errorMessage(err), type: 'error' });

  const friends = usePagedList<FriendItem>(fetchFriends);
  const incoming = usePagedList<FriendRequestItem>(fetchIncomingRequests);
  const sent = usePagedList<FriendRequestItem>(fetchSentRequests);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<UserSummary | null>(null);

  // Load every list once so the section counts are known.
  useEffect(() => {
    void friends.load(1);
    void incoming.load(1);
    void sent.load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openProfile = (userId: string) => navigate(userProfilePath(userId, currentUserId));

  // ── Search ────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
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
      if (latestQuery.current !== q) return; // a newer search replaced this one
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
    // Results must always belong to the text in the box, so drop the old ones right away.
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

  // ── Actions ───────────────────────────────────────────────────────────────
  const onAccept = async (req: FriendRequestItem) => {
    setBusyKey(`in:${req.request_id}`);
    try {
      const res = await acceptFriendRequest(req.request_id);
      incoming.setState((s) => ({ ...s, items: s.items.filter((r) => r.request_id !== req.request_id) }));
      friends.setState((s) => ({
        ...s,
        items: [res, ...s.items.filter((f) => f.user.id !== res.user.id)],
      }));
    } catch (err) {
      showError(err);
    } finally {
      setBusyKey(null);
    }
  };

  const onDecline = async (req: FriendRequestItem) => {
    setBusyKey(`in:${req.request_id}`);
    try {
      await declineFriendRequest(req.request_id);
      incoming.setState((s) => ({ ...s, items: s.items.filter((r) => r.request_id !== req.request_id) }));
    } catch (err) {
      showError(err);
    } finally {
      setBusyKey(null);
    }
  };

  const onCancel = async (req: FriendRequestItem) => {
    setBusyKey(`sent:${req.request_id}`);
    try {
      await cancelFriendRequest(req.request_id);
      sent.setState((s) => ({ ...s, items: s.items.filter((r) => r.request_id !== req.request_id) }));
    } catch (err) {
      showError(err);
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

  const counts: Partial<Record<Section, number>> = {
    friends: friends.state.loaded ? friends.state.items.length : undefined,
    incoming: incoming.state.loaded ? incoming.state.items.length : undefined,
    sent: sent.state.loaded ? sent.state.items.length : undefined,
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppToast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <h1 className="mx-auto max-w-lg text-lg font-bold text-foreground">Friends</h1>
      </header>

      <div className="mx-auto max-w-lg space-y-4 px-4 pt-3">
        <div role="tablist" aria-label="Friends sections" className="flex gap-1 rounded-xl bg-secondary/60 p-1">
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
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                  active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
                {count !== undefined && count > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] ${id === 'incoming' ? 'gradient-primary text-primary-foreground' : 'bg-secondary'}`}>
                    {count}{(id === 'incoming' ? incoming : id === 'sent' ? sent : friends).state.hasMore ? '+' : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {section === 'friends' && (
          <section aria-label="Your friends">
            <ListBody
              list={friends.state}
              emptyIcon={Users}
              emptyText="No friends yet. Find people in Search."
              onLoadMore={() => void friends.load(friends.state.page + 1)}
            >
              {friends.state.items.map((f) => (
                <UserRow key={f.user.id} user={f.user} onOpen={() => openProfile(f.user.id)}>
                  <button
                    type="button"
                    onClick={() => setPendingRemoval(f.user)}
                    disabled={busyKey === `friend:${f.user.id}`}
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

        {section === 'search' && (
          <section aria-label="Search users" className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username"
                aria-label="Search by username"
                autoComplete="off"
                className="w-full rounded-xl bg-secondary py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {searchError && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{searchError}</p>}
            {searching && results.length === 0 ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !query.trim() ? (
              <EmptyState icon={Search} text="Type a username to find people." />
            ) : searchedFor && results.length === 0 && !searchError ? (
              <EmptyState icon={Search} text={`No users found for “${searchedFor}”.`} />
            ) : (
              <ul className="space-y-2">
                {results.map((u) => (
                  <UserRow key={u.id} user={u} showFullName={false} onOpen={() => openProfile(u.id)} />
                ))}
              </ul>
            )}
            {searchHasMore && <LoadMore onClick={() => void runSearch(searchedFor, searchPage + 1)} loading={searching} />}
          </section>
        )}

        {section === 'incoming' && (
          <section aria-label="Incoming friend requests">
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

        {section === 'sent' && (
          <section aria-label="Sent friend requests">
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
      </div>

      <AlertDialog open={pendingRemoval !== null} onOpenChange={(open) => !open && setPendingRemoval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove friend?</AlertDialogTitle>
            <AlertDialogDescription>
              @{pendingRemoval?.display_name} will be removed from your friends. They won't be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onConfirmRemove()}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
