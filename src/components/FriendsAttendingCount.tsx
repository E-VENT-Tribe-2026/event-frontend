import { Users } from 'lucide-react';

/**
 * The Friends icon (the same one as the Friends entry of the bottom navigation) with a small
 * green number: how many of the user's friends attend. Renders nothing when none do.
 */
export default function FriendsAttendingCount({ count, className = '' }: { count?: number; className?: string }) {
  if (!count || count <= 0) return null;
  return (
    <span
      data-testid="friends-attending-count"
      aria-label={`${count} ${count === 1 ? 'friend' : 'friends'} attending`}
      title={`${count} ${count === 1 ? 'friend' : 'friends'} attending`}
      className={`inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm ${className}`}
    >
      <Users className="h-3 w-3 text-foreground" aria-hidden="true" />
      <span className="text-green-500">{count}</span>
    </span>
  );
}
