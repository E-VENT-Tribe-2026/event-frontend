import { useState } from 'react';
import { type EventItem, getCurrentUser } from '@/lib/storage';
import { MapPin, Clock, Users, UserCheck, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserAvatar } from '@/components/UserAvatar';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';

interface EventCardProps {
  event: EventItem;
  onJoin?: (id: string) => void;
  showFriendBadge?: boolean;
}

export default function EventCard({ event, onJoin, showFriendBadge }: EventCardProps) {
  const user = getCurrentUser();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);

  const friendJoined = user?.isPremium && user?.friends?.some(fId => event.participants.includes(fId));

  const handleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const token = getAuthToken();
    if (!token) return;

    setLoadingFav(true);
    try {
      const response = await fetch(getApiUrl(`/api/favorites/save-events/${event.id}`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setIsFavorite(!isFavorite);
      }
    } catch (error) {
      console.error("Failed to favorite event:", error);
    } finally {
      setLoadingFav(false);
    }
  };

  return (
    <Link
      to={`/event/${event.id}`}
      className="block rounded-2xl overflow-hidden glass-card card-lift animate-fade-in relative"
    >
      <div className="relative h-40 overflow-hidden">
        <img src={event.image} alt={event.title} className="h-full w-full object-cover transition-transform duration-500 hover:scale-110" />
        
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        <div className="absolute top-2 right-2 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-primary-foreground backdrop-blur-sm">
          {event.category}
        </div>
        
        {event.budget === 0 ? (
          <div className="absolute top-2 left-2 rounded-full bg-accent/90 px-3 py-1 text-xs font-semibold text-accent-foreground backdrop-blur-sm">
            Free
          </div>
        ) : (
          <div className="absolute top-2 left-2 rounded-full bg-secondary/90 px-3 py-1 text-xs font-semibold text-secondary-foreground backdrop-blur-sm">
            ${event.budget}
          </div>
        )}

        {(showFriendBadge || friendJoined) && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-accent/90 px-2.5 py-1 text-[10px] font-semibold text-accent-foreground backdrop-blur-sm">
            <UserCheck className="h-3 w-3" /> Friend joined
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        <h3 className="text-sm font-semibold text-foreground line-clamp-1">{event.title}</h3>
        
        {(event.organizer || event.organizerId) && (
          <div className="flex items-center gap-2 pt-0.5">
            <UserAvatar
              src={event.organizerAvatar}
              seed={event.organizerId || event.organizer || event.id}
              name={event.organizer || 'Organizer'}
              size="xs"
              className="ring-1 ring-primary/25"
            />
            <span className="text-[11px] text-muted-foreground truncate">
              {event.organizer || 'Organizer'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{event.date} · {event.time}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{event.location}</span>
        </div>

        {/* Footer Action Area */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{event.participants.length}/{event.participantsLimit}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Moved Favorite Button Here */}
            <button
              onClick={handleFavorite}
              disabled={loadingFav}
              className={`p-2 rounded-full transition-all active:scale-90 ${
                isFavorite 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:bg-secondary/50'
              }`}
            >
              <Heart 
                className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''} ${loadingFav ? 'animate-pulse' : ''}`} 
              />
            </button>

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
      </div>
    </Link>
  );
}