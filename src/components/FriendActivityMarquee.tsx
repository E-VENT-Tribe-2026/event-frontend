import { useMemo } from 'react';
import type { EventItem } from '@/lib/storage';
import type { UserSummary } from '@/lib/friendsApi';
import InterestEventCard from '@/components/InterestEventCard';
import FriendsGoing from '@/components/FriendsGoing';

export type FriendActivityItem = { event: EventItem; friends: UserSummary[] };

/** Repeat the list until the strip is long enough, then duplicate it so -50% loops seamlessly. */
function loopForMarquee<T>(items: T[], minCards = 6): T[] {
  if (items.length === 0) return [];
  const base: T[] = [];
  while (base.length < minCards) base.push(...items);
  return [...base, ...base];
}

function friendFooter(item: FriendActivityItem) {
  if (item.friends.length > 0) {
    return <FriendsGoing friends={item.friends} compact linkProfiles={false} />;
  }
  const n = item.event.friendsAttendingCount ?? 0;
  if (n <= 0) return null;
  return (
    <p className="text-[10px] font-medium text-accent">
      {n === 1 ? '1 friend is going' : `${n} friends are going`}
    </p>
  );
}

export default function FriendActivityMarquee({ items }: { items: FriendActivityItem[] }) {
  const looped = useMemo(() => loopForMarquee(items), [items]);
  const durationSec = Math.max(24, Math.min(48, items.length * 5));

  return (
    <div className="group relative overflow-hidden py-1 motion-reduce:overflow-x-auto" data-testid="friends-marquee">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent" />
      <div
        className="flex w-max gap-4 animate-marquee-x group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ animationDuration: `${durationSec}s` }}
      >
        {looped.map((item, i) => (
          <InterestEventCard
            key={`${item.event.id}-${i}`}
            event={item.event}
            footer={friendFooter(item)}
          />
        ))}
      </div>
    </div>
  );
}
