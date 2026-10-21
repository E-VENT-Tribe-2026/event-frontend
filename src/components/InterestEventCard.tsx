import { Link } from 'react-router-dom';
import { Clock, MapPin } from 'lucide-react';
import type { EventItem } from '@/lib/storage';
import { getCategoryBanner } from '@/lib/categoryBanners';
import FriendsAttendingCount from '@/components/FriendsAttendingCount';

function shortWhen(event: EventItem): string {
  const start = (event as EventItem & { start_datetime?: string }).start_datetime;
  const parsed = start
    ? new Date(start)
    : new Date(`${event.date}T${event.time || '00:00'}`);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  return [event.date, event.time].filter(Boolean).join(' · ');
}

export default function InterestEventCard({ event }: { event: EventItem }) {
  return (
    <Link
      to={`/event/${event.id}`}
      state={{ event }}
      className="block w-[168px] shrink-0 overflow-hidden rounded-xl border border-border/50 bg-card/80 transition-transform active:scale-[0.98]"
    >
      <div className="relative h-[88px] overflow-hidden bg-secondary">
        <img
          src={event.image || getCategoryBanner(event.category)}
          alt=""
          className="h-full w-full object-cover"
        />
        <span className="absolute left-1.5 top-1.5 rounded bg-background/85 px-1.5 py-0.5 text-[9px] font-semibold text-foreground">
          {event.budget === 0 ? 'Free' : `€${event.budget}`}
        </span>
        {event.category && (
          <span className="absolute right-1.5 top-1.5 max-w-[46%] truncate rounded bg-background/85 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
            {event.category}
          </span>
        )}
        <FriendsAttendingCount count={event.friendsAttendingCount} className="absolute bottom-1.5 left-1.5" />
      </div>
      <div className="space-y-1 px-2.5 py-2">
        <h3 className="line-clamp-2 text-[12px] font-semibold leading-snug text-foreground">{event.title}</h3>
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">{shortWhen(event)}</span>
        </p>
        {event.location ? (
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{event.location}</span>
          </p>
        ) : null}
      </div>
    </Link>
  );
}
