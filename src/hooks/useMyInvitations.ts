import { useCallback, useEffect, useRef, useState } from 'react';
import { FriendsApiError } from '@/lib/friendsApi';
import {
  INVITATION_DISMISSED_EVENT,
  MY_INVITATIONS_PAGE_SIZE,
  fetchMyInvitations,
  type MyInvitation,
} from '@/lib/myInvitationsApi';

/**
 * The user's invitations, loaded a page at a time. The counter and the list share the
 * client-side cache, and a dismissed invitation leaves every open view at once.
 */
export function useMyInvitations(enabled: boolean) {
  const [invitations, setInvitations] = useState<MyInvitation[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const loadPage = useCallback(async (next: number) => {
    const mine = ++seq.current;
    if (next === 1) setLoading(true);
    else setLoadingMore(true);
    setError('');
    try {
      const res = await fetchMyInvitations(next, MY_INVITATIONS_PAGE_SIZE);
      if (mine !== seq.current) return;
      setInvitations((prev) => (next === 1 ? res.data : [...prev, ...res.data]));
      setTotal(res.total);
      setHasMore(res.has_more);
      setPage(next);
    } catch (e) {
      if (mine !== seq.current) return;
      setError(e instanceof FriendsApiError ? e.message : 'Could not load your invitations.');
    } finally {
      if (mine === seq.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void loadPage(1);
  }, [enabled, loadPage]);

  // A dismissed invitation disappears here too and lowers the number.
  useEffect(() => {
    const onDismissed = (e: Event) => {
      const id = (e as CustomEvent<{ id: number }>).detail?.id;
      setInvitations((prev) => {
        if (!prev.some((i) => i.invitation_id === id)) return prev;
        setTotal((t) => Math.max(0, t - 1));
        return prev.filter((i) => i.invitation_id !== id);
      });
    };
    window.addEventListener(INVITATION_DISMISSED_EVENT, onDismissed);
    return () => window.removeEventListener(INVITATION_DISMISSED_EVENT, onDismissed);
  }, []);

  return {
    invitations,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore: () => loadPage(page + 1),
    reload: () => loadPage(1),
  };
}
