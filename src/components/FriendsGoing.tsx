import { Link } from 'react-router-dom';
import { UserAvatar } from '@/components/UserAvatar';
import { friendsGoingLabel } from '@/lib/eventSocial';
import { userAvatarUrl, userProfilePath, type UserSummary } from '@/lib/friendsApi';
import { getCurrentUser } from '@/lib/storage';

export default function FriendsGoing({
  friends,
  compact = false,
  linkProfiles = true,
}: {
  friends: UserSummary[];
  compact?: boolean;
  linkProfiles?: boolean;
}) {
  if (friends.length === 0) return null;
  const me = getCurrentUser()?.id;
  const shown = friends.slice(0, 4);
  const extra = friends.length - shown.length;

  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'pt-1'}`}>
      <div className="flex -space-x-2">
        {shown.map((friend) => {
          const avatar = (
            <UserAvatar
              src={userAvatarUrl(friend) || undefined}
              seed={friend.id}
              name={friend.full_name || friend.username || 'Friend'}
              size="xs"
            />
          );
          if (!linkProfiles) {
            return (
              <span key={friend.id} className="rounded-full ring-2 ring-background" title={friend.full_name || friend.username || 'Friend'}>
                {avatar}
              </span>
            );
          }
          return (
          <Link
            key={friend.id}
            to={userProfilePath(friend.id, me)}
            onClick={(e) => e.stopPropagation()}
            title={friend.full_name || friend.username || 'Friend'}
            className="rounded-full ring-2 ring-background"
          >
            {avatar}
          </Link>
          );
        })}
        {extra > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground ring-2 ring-background">
            +{extra}
          </div>
        )}
      </div>
      <p className={`min-w-0 truncate font-medium text-accent ${compact ? 'text-[10px]' : 'text-xs'}`}>
        {friendsGoingLabel(friends)}
      </p>
    </div>
  );
}
