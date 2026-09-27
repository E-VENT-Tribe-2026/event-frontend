import { useState, useEffect } from 'react';
import { type EventItem, getCurrentUser } from '@/lib/storage';
import { MapPin, Clock, Users, UserCheck, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { UserAvatar } from '@/components/UserAvatar';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { getCategoryBanner } from '@/lib/categoryBanners';
import { useParticipantCount, invalidateFavorites } from '@/lib/queries';

interface EventCardProps {
  event: EventItem;
  onJoin?: (id: string) => void;
  showFriendBadge?: boolean;
  isFavorite?: boolean; 
}

export default function EventCard({ event, onJoin, showFriendBadge, isFavorite: initialIsFavorite = false }: EventCardProps) {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isAlreadyJoined = Boolean(user && event.participants?.includes(user.id));
  
  const [favorite, setFavorite] = useState(initialIsFavorite);
  const [loadingFav, setLoadingFav] = useState(false);
  const [joinLocked, setJoinLocked] = useState(false);
  
  // Organizer fetched state from GUID reference
  const [organizerProfile, setOrganizerProfile] = useState<{ full_name?: string; username?: string; avatar_url?: string } | null>(null);

  // Use TanStack Query for participant count (persisted to localStorage)
  const { data: countData } = useParticipantCount(event.id);
  const attendeeCount = countData?.count ?? event.participants?.length ?? 0;

  // Sync favorite state from props
  useEffect(() => {
    setFavorite(initialIsFavorite);
  }, [initialIsFavorite]);

  useEffect(() => {
    if (!isAlreadyJoined) {
      setJoinLocked(false);
    }
  }, [isAlreadyJoined, event.id]);

  // Fetch organizer profile via created_by / organizerId GUID if name is generic
  useEffect(() => {
    const creatorId = event.organizerId || (event as any).created_by;
    if (!creatorId) return;

    let cancelled = false;
    (async () => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(getApiUrl(`/api/profile/${creatorId}`), { headers });
        if (res.ok) {
          const profData = await res.json().catch(() => null);
          const prof = profData?.data || profData?.profile || profData;
          if (prof && !cancelled) {
            setOrganizerProfile({
              full_name: prof.full_name || prof.name,
              username: prof.username,
              avatar_url: prof.avatar_url,
            });
          }
        }
      } catch {
        // ignore profile lookup failure
      }
    })();

    return () => { cancelled = true; };
  }, [event.organizerId, (event as any).created_by]);

  const friendJoined = user?.isPremium && user?.friends?.some(fId => event.participants?.includes(fId));

  const handleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const token = getAuthToken();
    if (!token) {
      navigate('/login');
      return;
    }

    setLoadingFav(true);
    const method = favorite ? 'DELETE' : 'POST';
    const endpoint = favorite 
      ? `/api/favorites/unsave-events/${event.id}` 
      : `/api/favorites/save-events/${event.id}`;

    try {
      const response = await fetch(getApiUrl(endpoint), {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setFavorite(!favorite);
        invalidateFavorites(user?.id ?? '');
      }
    } catch (error) {
      console.error("Failed to update favorite status:", error);
    } finally {
      setLoadingFav(false);
    }
  };

  const handleJoinClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isAlreadyJoined || joinLocked) {
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }

    setJoinLocked(true);
    if (onJoin) {
      onJoin(event.id);
    }
  };

  const organizerFullName = organizerProfile?.full_name || event.organizerFullName || (event.organizer !== 'Organizer' ? event.organizer : '') || 'Organizer';
  const organizerUsername = organizerProfile?.username || event.organizerUsername;
  const formattedUsername = organizerUsername ? `@${organizerUsername.replace(/^@/, '')}` : null;
  const organizerAvatar = organizerProfile?.avatar_url || event.organizerAvatar;

  return (
    <Link
      to={`/event/${event.id}`}
      state={{ event }}
      className="block rounded-2xl overflow-hidden glass-card card-lift animate-fade-in relative"
    >
      <div className="relative h-40 overflow-hidden">
        <img 
          src={event.image || getCategoryBanner(event.category)} 
          alt={event.title} 
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-110" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        <div className="absolute top-2 right-2 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-primary-foreground backdrop-blur-sm">
          {event.category}
        </div>
        {event.budget === 0 ? (
          <div className="absolute top-2 left-2 rounded-full bg-accent/90 px-3 py-1 text-xs font-semibold text-accent-foreground backdrop-blur-sm">Free</div>
        ) : (
          <div className="absolute top-2 left-2 rounded-full bg-secondary/90 px-3 py-1 text-xs font-semibold text-secondary-foreground backdrop-blur-sm">€{event.budget}</div>
        )}
        {(showFriendBadge || friendJoined) && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-accent/90 px-2.5 py-1 text-[10px] font-semibold text-accent-foreground backdrop-blur-sm">
            <UserCheck className="h-3 w-3" /> Friend joined
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        <h3 className="text-sm font-semibold text-foreground line-clamp-1">{event.title}</h3>
        {(event.organizer || event.organizerId || (event as any).created_by) && (
          <div className="flex items-center gap-2 pt-0.5">
            <UserAvatar 
              src={organizerAvatar} 
              seed={event.organizerId || (event as any).created_by || event.id} 
              name={organizerFullName} 
              size="xs" 
              className="ring-1 ring-primary/25" 
            />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-[11px] font-medium text-foreground truncate">{organizerFullName}</p>
              {formattedUsername && (
                <p className="text-[10px] text-muted-foreground truncate">{formattedUsername}</p>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{event.date} · {event.time}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{event.location}</span>
        </div>
        
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{attendeeCount}/{event.participantsLimit}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFavorite}
              disabled={loadingFav}
              className={`p-2 rounded-full transition-all active:scale-90 ${favorite ? 'text-primary' : 'text-muted-foreground hover:bg-secondary/50'}`}
            >
              <Heart className={`h-5 w-5 ${favorite ? 'fill-current' : ''} ${loadingFav ? 'animate-pulse' : ''}`} />
            </button>
            
            <button
              type="button"
              onClick={handleJoinClick}
              disabled={isAlreadyJoined || joinLocked}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-transform active:scale-95 ${
                isAlreadyJoined || joinLocked
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'gradient-primary text-primary-foreground shadow-glow'
              }`}
            >
              {isAlreadyJoined ? 'Joined' : joinLocked ? 'Opening...' : 'View Details'}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}