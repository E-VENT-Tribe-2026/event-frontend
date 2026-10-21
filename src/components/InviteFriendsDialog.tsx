import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserAvatar } from '@/components/UserAvatar';
import { FriendsApiError, userAvatarUrl } from '@/lib/friendsApi';
import { fetchInvitableFriends, sendInvitation, type InvitableFriend, type InviteStatus } from '@/lib/invitationsApi';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 350;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
};

/** Short text shown next to a greyed-out Invite button. "Can't be invited" has no reason. */
const STATUS_TEXT: Partial<Record<InviteStatus, string>> = {
  invited: 'Invited',
  attending: 'Attending',
  unavailable: "Can't be invited",
};

export default function InviteFriendsDialog({ open, onOpenChange, eventId }: Props) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [friends, setFriends] = useState<InvitableFriend[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invitingId, setInvitingId] = useState<string | null>(null);
  // Ignore answers of older searches that arrive late.
  const requestSeq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [search]);

  const load = async (nextPage: number, replace: boolean) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const res = await fetchInvitableFriends(eventId, debounced, nextPage, PAGE_SIZE);
      if (seq !== requestSeq.current) return;
      setFriends((prev) => (replace ? res.data : [...prev, ...res.data]));
      setPage(nextPage);
      setHasMore(res.has_more);
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setError(e instanceof FriendsApiError ? e.message : 'Could not load your friends. Please try again.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  // Reload the first page when the window opens or the search text settles.
  useEffect(() => {
    if (!open) return;
    void load(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debounced, eventId]);

  const invite = async (friend: InvitableFriend) => {
    setInvitingId(friend.user.id);
    setError('');
    try {
      await sendInvitation(eventId, friend.user.id);
      // Update the row right away, without reopening the window.
      setFriends((prev) =>
        prev.map((f) => (f.user.id === friend.user.id ? { ...f, invite_status: 'invited', can_invite: false } : f)),
      );
    } catch (e) {
      setError(e instanceof FriendsApiError ? e.message : 'Could not send the invitation. Please try again.');
    } finally {
      setInvitingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite friends</DialogTitle>
          <DialogDescription>Invite your friends to this event.</DialogDescription>
        </DialogHeader>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search friends by username"
          aria-label="Search friends"
          className="w-full rounded-xl border border-border/50 bg-secondary/80 px-4 py-2.5 text-sm outline-none"
        />

        {error && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}

        <ul className="max-h-80 space-y-2 overflow-y-auto" aria-label="Friends">
          {friends.map((f) => {
            const statusText = STATUS_TEXT[f.invite_status];
            const disabled = f.invite_status !== 'can_invite' || !f.can_invite || invitingId === f.user.id;
            const name = f.user.full_name || f.user.display_name;
            return (
              <li key={f.user.id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/40 px-3 py-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <UserAvatar src={userAvatarUrl(f.user)} seed={f.user.id} name={name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{name}</p>
                    {f.user.username && <p className="truncate text-xs text-muted-foreground">@{f.user.username}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {statusText && <span className="text-[11px] text-muted-foreground">{statusText}</span>}
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void invite(f)}
                    aria-label={`Invite ${name}`}
                    className="rounded-full gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {invitingId === f.user.id ? '…' : 'Invite'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {!loading && !error && friends.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {debounced ? 'No friends match your search.' : 'You have no friends to invite yet.'}
          </p>
        )}
        {loading && <p className="text-center text-xs text-muted-foreground">Loading…</p>}
        {hasMore && !loading && (
          <button
            type="button"
            onClick={() => void load(page + 1, false)}
            className="w-full rounded-xl border border-border py-2 text-xs font-medium text-primary hover:bg-secondary/50"
          >
            Load more
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
