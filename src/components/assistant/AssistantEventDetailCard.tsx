import React from 'react';
import { Calendar, MapPin, Users, Tag, ArrowRight, User as UserIcon, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AssistantEventItem } from '@/lib/assistantApi';
import { getGeneratedAvatarUrl } from '@/lib/avatars';

interface AssistantEventDetailCardProps {
  event: AssistantEventItem;
  onOpen?: (event: AssistantEventItem) => void;
}

export const AssistantEventDetailCard: React.FC<AssistantEventDetailCardProps> = ({ event, onOpen }) => {
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

  const handleOpenEventPage = () => {
    if (onOpen) {
      onOpen(event);
    } else if (event.id) {
      navigate(`/events/${event.id}`);
    }
  };

  const dateText = formatDateTime(event.start_datetime, event.end_datetime);
  const isFree = event.cost === 0 || event.cost === undefined;
  const organizerName = event.created_by || 'Community Organizer';
  const organizerAvatar = getGeneratedAvatarUrl(event.created_by || 'organizer');

  return (
    <div
      data-testid={`assistant-event-detail-card-${event.id || 'current'}`}
      className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-card/95 via-card/90 to-primary/10 p-4 shadow-xl backdrop-blur-md transition-all duration-200 hover:border-primary/60 hover:shadow-glow"
    >
      {/* Header Accent Pill */}
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Sparkles className="h-3 w-3" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Event Spotlight
          </span>
        </div>
        <div className="flex items-center gap-1.5">
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
      </div>

      {/* Title */}
      <div className="mt-3">
        <h3 className="text-base font-extrabold text-foreground leading-snug tracking-tight">
          {event.title}
        </h3>

        {/* Organizer info */}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <img
            src={organizerAvatar}
            alt={organizerName}
            className="h-5 w-5 rounded-full object-cover ring-1 ring-border/60"
            onError={(e) => {
              // fallback to User icon
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex items-center gap-1">
            <UserIcon className="h-3 w-3 text-primary/80" />
            <span>Organized by <span className="font-semibold text-foreground">{organizerName}</span></span>
          </div>
        </div>

        {/* Full description */}
        {event.description && (
          <p className="mt-2.5 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-l-2 border-primary/30 pl-2.5">
            {event.description}
          </p>
        )}

        {/* Key Event Metadata */}
        <div className="mt-3.5 grid grid-cols-1 gap-2 rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground sm:grid-cols-2">
          {dateText && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{dateText}</span>
            </div>
          )}
          {event.location_name && (
            <div className="flex items-center gap-1.5 min-w-0">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="truncate">{event.location_name}</span>
            </div>
          )}
          {event.max_capacity !== undefined && event.max_capacity > 0 && (
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{event.max_capacity} max capacity</span>
            </div>
          )}
        </div>
      </div>

      {/* Prominent Action Button */}
      <div className="mt-4 border-t border-border/40 pt-3">
        <button
          type="button"
          data-testid="open-event-page-btn"
          aria-label={`Open event page for ${event.title}`}
          onClick={handleOpenEventPage}
          className="flex w-full items-center justify-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95 transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <span>Open Event Page</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default AssistantEventDetailCard;
