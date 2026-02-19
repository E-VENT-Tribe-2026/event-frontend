import { type EventItem } from '@/lib/storage';
import { MapPin, Clock, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EventCardProps {
  event: EventItem;
  onJoin?: (id: string) => void;
}

export default function EventCard({ event, onJoin }: EventCardProps) {
  return (
    <Link
      to={`/event/${event.id}`}
      className="block rounded-xl overflow-hidden gradient-card shadow-card card-lift animate-fade-in"
    >
      <div className="relative h-40 overflow-hidden">
        <img src={event.image} alt={event.title} className="h-full w-full object-cover" />
        <div className="absolute top-2 right-2 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-primary-foreground">
          {event.category}
        </div>
        {event.budget === 0 ? (
          <div className="absolute top-2 left-2 rounded-full bg-accent/90 px-3 py-1 text-xs font-semibold text-accent-foreground">
            Free
          </div>
        ) : (
          <div className="absolute top-2 left-2 rounded-full bg-secondary/90 px-3 py-1 text-xs font-semibold text-secondary-foreground">
            ${event.budget}
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <h3 className="text-base font-semibold text-foreground line-clamp-1">{event.title}</h3>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{event.date} · {event.time}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location}</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{event.participants.length}/{event.participantsLimit}</span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onJoin?.(event.id);
            }}
            className="gradient-primary rounded-full px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow ripple-container transition-transform active:scale-95"
          >
            Join
          </button>
        </div>
      </div>
    </Link>
  );
}
