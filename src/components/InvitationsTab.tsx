import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserAvatar } from '@/components/UserAvatar';
import { FriendsApiError, userAvatarUrl } from '@/lib/friendsApi';
import { useMyInvitations } from '@/hooks/useMyInvitations';
import { dismissInvitation, type MyInvitation } from '@/lib/myInvitationsApi';
import { invalidateNotifications } from '@/lib/queries';

/** Content of the Invitations tab on the user's own profile. One row per invitation. */
export default function InvitationsTab({ viewerId }: { viewerId: string | undefined }) {
  const navigate = useNavigate();
  const { invitations, loading, loadingMore, hasMore, error, loadMore, reload } = useMyInvitations(Boolean(viewerId));
  const [dismissingId, setDismissingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');

  const dismiss = async (invitation: MyInvitation) => {
    setDismissingId(invitation.invitation_id);
    setActionError('');
    try {
      // Drops the row and lowers the counter everywhere the list is shown.
      await dismissInvitation(invitation.invitation_id);
      invalidateNotifications();
    } catch (e) {
      setActionError(e instanceof FriendsApiError ? e.message : 'Could not dismiss the invitation. Please try again.');
      // The invitation may be gone already (joined, cancelled event); show the real list.
      void reload();
    } finally {
      setDismissingId(null);
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-xs text-muted-foreground">Loading invitations…</p>;
  }

  if (error && invitations.length === 0) {
    return (
      <p role="alert" className="py-8 text-center text-xs text-destructive">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="px-1 text-sm font-semibold">Invitations</h3>
      {actionError && (
        <p role="alert" className="px-1 text-xs font-medium text-destructive">
          {actionError}
        </p>
      )}
      {invitations.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">You have no invitations.</p>
      ) : (
        <ul className="space-y-2.5">
          {invitations.map((inv) => {
            const name = inv.inviter.full_name || inv.inviter.display_name;
            return (
              <li
                key={inv.invitation_id}
                data-testid="invitation-row"
                onClick={() => navigate(`/event/${inv.event.id}`)}
                className="flex cursor-pointer items-center gap-3 rounded-2xl glass-card p-2.5 transition-all hover:border-primary/40"
              >
                <UserAvatar src={userAvatarUrl(inv.inviter)} seed={inv.inviter.id} name={name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground">
                    {name} has invited you to {inv.event.title ? `"${inv.event.title}"` : 'an event'}
                  </p>
                  {inv.inviter.username && <p className="truncate text-[10px] text-muted-foreground">@{inv.inviter.username}</p>}
                </div>
                <button
                  type="button"
                  disabled={dismissingId === inv.invitation_id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void dismiss(inv);
                  }}
                  className="shrink-0 rounded-lg bg-secondary/50 px-3 py-1 text-[10px] text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                >
                  {dismissingId === inv.invitation_id ? '…' : 'Dismiss'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          className="w-full rounded-xl border border-border py-2 text-xs font-medium text-primary transition-colors hover:bg-secondary/50"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
