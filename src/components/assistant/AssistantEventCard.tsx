import React from 'react';
import { Calendar, MapPin, DollarSign, Users, ChevronRight, Tag } from 'lucide-react';
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
      navigate(`/event/${event.id}`);
    }
  };

  const dateText = formatDateTime(event.start_datetime, event.end_datetime);
  const isFree = event.cost === 0 || event.cost === undefined;

  return (
    <div
      onClick={handleCardClick}
      data-testid={`assistant-event-card-${event.id}`}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-border/70 bg-gradient-to-br from-card/90 to-card/60 p-3.5 shadow-md transition-all duration-200 hover:border-primary/60 hover:shadow-glow hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {event.category && (
            <div className="mb-1 flex items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                <Tag className="h-3 w-3" />
                {event.category}
              </span>
              {event.status && event.status !== 'active' && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {event.status}
                </span>
              )}
            </div>
          )}
          <h4 className="truncate text-sm font-bold text-foreground group-hover:text-primary transition-colors">
            {event.title}
          </h4>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
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

      <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`font-semibold ${
              isFree ? 'text-emerald-400' : 'text-foreground'
            }`}
          >
            {isFree ? 'Free' : `$${event.cost}`}
          </span>
          {event.max_capacity !== undefined && event.max_capacity > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Users className="h-3 w-3" />
              {event.max_capacity} spots
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/event/${event.id}`);
          }}
          className="text-xs font-semibold text-primary hover:text-accent transition-colors underline-offset-2 hover:underline"
        >
          View Details →
        </button>
      </div>
    </div>
  );
};
