import { UserAvatar } from '@/components/UserAvatar';
import { userAvatarUrl } from '@/lib/friendsApi';
import type { ParticipantRow } from '@/lib/eventAttendeesApi';

/**
 * Attendees box for a user who has not joined: the user's friends who attend, each with picture,
 * full name and username, and every other attendee only as a number.
 */
export default function FriendsAttendingSection({
  friends,
  othersCount,
}: {
  friends: ParticipantRow[];
  othersCount: number;
}) {
  if (friends.length === 0) return null;
  return (
    <section className="space-y-2" aria-label="Friends attending this event">
      <h3 className="text-xs font-semibold text-muted-foreground">Friends attending this event</h3>
      <ul className="space-y-2">
        {friends.map((row) => {
          const summary = row.user;
          const name = summary?.full_name || row.profiles?.full_name || summary?.display_name || 'Friend';
          // Only a real username is shown; without one, the full name stands alone.
          const username = summary?.username || row.profiles?.username || '';
          return (
            <li key={row.user_id} className="flex items-center gap-2 rounded-xl bg-secondary/40 px-3 py-2.5" data-testid="friend-attending-row">
              <UserAvatar
                src={summary ? userAvatarUrl(summary) : row.profiles?.avatar_url}
                seed={row.user_id}
                name={name}
                size="sm"
                className="shrink-0 border border-border/50"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{name}</p>
                {username && <p className="truncate text-xs text-muted-foreground">@{username}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      {othersCount > 0 && (
        <p className="text-sm text-muted-foreground" data-testid="other-attendees-count">
          <span className="font-semibold text-foreground">{othersCount}</span>{' '}
          other {othersCount === 1 ? 'person is' : 'people are'} going.
        </p>
      )}
    </section>
  );
}
