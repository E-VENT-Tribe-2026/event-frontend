import { UserAvatar } from '@/components/UserAvatar';
import { userAvatarUrl } from '@/lib/friendsApi';
import type { EventInvitationSummary } from '@/lib/invitationsApi';

/** Top-of-page notice for an invited user: who invited them (and how many others did). */
export default function InvitedByBanner({ invitation }: { invitation: EventInvitationSummary | null | undefined }) {
  if (!invitation?.invited || !invitation.invited_by) return null;
  const inviter = invitation.invited_by;
  const name = inviter.full_name || inviter.display_name;
  const others = invitation.other_inviters_count;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3"
      data-testid="invited-by-banner"
    >
      <UserAvatar src={userAvatarUrl(inviter)} seed={inviter.id} name={name} size="md" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {others > 0
            ? `${name} and ${others} ${others === 1 ? 'other' : 'others'} invited you`
            : `${name} has invited you to this event`}
        </p>
        {inviter.username && <p className="truncate text-xs text-muted-foreground">@{inviter.username}</p>}
      </div>
    </div>
  );
}
