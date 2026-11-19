import React from 'react';
import { Calendar, MapPin, Users, Tag, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AssistantEventItem } from '@/lib/assistantApi';

interface AssistantEventCardProps {
  event: AssistantEventItem;
  onSelect?: (event: AssistantEventItem) => void;
}

export const AssistantEventCard: React.FC<AssistantEventCardProps> = ({ event, onSelect }) => {
  const navigate = useNavigate();

  const formatDateTime = (startStr?: string, endStr?: string) => {
    if (!startStr) return null;
    try {
      const start = new Date(startStr);
      const datePart = start.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const timePart = start.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });

      if (endStr) {
        const end = new Date(endStr);
        const endTimePart = end.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        });
        return `${datePart} · ${timePart} - ${endTimePart}`;
      }
      return `${datePart} · ${timePart}`;
    } catch {
      return startStr;
    }
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(event);
    } else if (event.id) {
      navigate(`/events/${event.id}`);
    }
  };

  const dateText = formatDateTime(event.start_datetime, event.end_datetime);
  const isFree = event.cost === 0 || event.cost === undefined;

  return (
    <div
      onClick={handleCardClick}
      data-testid={`assistant-event-card-${event.id}`}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-card/95 via-card/85 to-card/70 p-3.5 shadow-md backdrop-blur-sm transition-all duration-200 hover:border-primary/60 hover:shadow-glow hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {event.category && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/25 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <Tag className="h-2.5 w-2.5" />
                {event.category}
              </span>
            )}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isFree
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-primary/15 text-primary border border-primary/30'
              }`}
            >
              {isFree ? 'Free' : `$${event.cost}`}
            </span>
            {event.status && event.status !== 'active' && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {event.status}
              </span>
            )}
          </div>
          <h4 className="truncate text-sm font-bold text-foreground group-hover:text-primary transition-colors">
            {event.title}
          </h4>
        </div>
      </div>

      {event.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
          {event.description}
        </p>
      )}

      <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
        {dateText && (
          <div className="flex items-center gap-1.5 truncate">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{dateText}</span>
          </div>
        )}
        {event.location_name && (
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="truncate">{event.location_name}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2.5 text-xs">
        <div className="flex items-center gap-2">
          {event.max_capacity !== undefined && event.max_capacity > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
              <Users className="h-3 w-3 text-muted-foreground/80" />
              {event.max_capacity} spots
            </span>
          )}
        </div>
        <button
          type="button"
          data-testid="open-event-btn"
          aria-label={`Open event ${event.title}`}
          onClick={(e) => {
            e.stopPropagation();
            if (onSelect) {
              onSelect(event);
            } else if (event.id) {
              navigate(`/events/${event.id}`);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg gradient-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-95 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <span>Open Event</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
