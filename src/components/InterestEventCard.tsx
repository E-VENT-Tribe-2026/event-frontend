import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import type { EventItem } from '@/lib/storage';
import { categoryCardStyle } from '@/lib/categoryStyle';
import FriendsAttendingCount from '@/components/FriendsAttendingCount';

export default function InterestEventCard({
  event,
  footer,
  variant = 'tile',
}: {
  event: EventItem;
  footer?: ReactNode;
  /** tile = welcome-style square; row = full-width stacked card */
  variant?: 'tile' | 'row';
}) {
  const style = categoryCardStyle(event.category);
  const categoryChip = event.category ? (
    <span className="shrink-0 whitespace-nowrap rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
      {event.category}
    </span>
  ) : null;
  const location = event.location ? (
    <span className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
      <MapPin className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{event.location}</span>
    </span>
  ) : null;

  if (variant === 'row') {
    return (
      <Link
        to={`/event/${event.id}`}
        state={{ event }}
        data-testid="interest-event-row"
        className={`flex w-full items-center gap-3 rounded-2xl border bg-gradient-to-r px-3.5 py-3 backdrop-blur-sm transition-transform active:scale-[0.99] ${style.border} ${style.color}`}
      >
        <span className="text-xl shrink-0" aria-hidden="true">{style.emoji}</span>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{event.title}</h3>
          <div className="flex items-center gap-2">
            {categoryChip}
            {location}
          </div>
        </div>
        {footer ?? <FriendsAttendingCount count={event.friendsAttendingCount} />}
      </Link>
    );
  }

  return (
    <Link
      to={`/event/${event.id}`}
      state={{ event }}
      className={`block w-56 shrink-0 space-y-2 rounded-2xl border bg-gradient-to-br p-4 backdrop-blur-sm transition-transform active:scale-[0.98] ${style.border} ${style.color}`}
    >
      <span className="text-2xl" aria-hidden="true">{style.emoji}</span>
      <h3 className="line-clamp-1 text-sm font-semibold text-foreground">{event.title}</h3>
      <div className="flex items-center justify-between gap-2">
        {categoryChip ?? <span />}
        {location}
      </div>
      {footer ?? <FriendsAttendingCount count={event.friendsAttendingCount} />}
    </Link>
  );
}
