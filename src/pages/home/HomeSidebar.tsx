import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, UserPlus, Users } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { userProfilePath } from '@/lib/friendsApi';
import type { EventItem, User } from '@/lib/storage';
import { UPCOMING_PREVIEW, type SuggestedUser } from '@/pages/home/homeModel';

type HomeSidebarProps = {
  user: User;
  upcomingForYou: EventItem[];
  upcomingLimit: number;
  upcomingInitialLoading: boolean;
  onUpcomingLimitChange: (limit: number) => void;
  onOpenEvent: (event: EventItem) => void;
  suggestedUsers: SuggestedUser[];
  suggestionsLoading: boolean;
  addingFriendId: string | null;
  onAddFriend: (id: string) => void;
  onOpenProfile: (path: string) => void;
};

export default function HomeSidebar({
  user,
  upcomingForYou,
  upcomingLimit,
  upcomingInitialLoading,
  onUpcomingLimitChange,
  onOpenEvent,
  suggestedUsers,
  suggestionsLoading,
  addingFriendId,
  onAddFriend,
  onOpenProfile,
}: HomeSidebarProps) {
  return (
    <aside className="space-y-4">
      <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4 space-y-3 shadow-lg shadow-black/5 backdrop-blur-sm">
        <Link to="/profile" className="flex items-center justify-between group">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar src={user.avatar || user.profilePhoto} seed={user.id} name={user.name} size="md" className="ring-2 ring-indigo-500/40 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground truncate group-hover:text-indigo-500 transition-colors">{user.name}</h2>
              <p className="text-[10px] text-muted-foreground">View profile</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-500 transition-colors shrink-0" />
        </Link>
      </div>

      <div data-testid="upcoming-events" className="rounded-2xl bg-secondary/40 border border-border/80 p-4 space-y-3.5 shadow-lg shadow-black/5 backdrop-blur-sm">
        <div className="flex items-center justify-between pb-1 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/20">
              <Calendar className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Upcoming events</h3>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{upcomingForYou.length} events</span>
        </div>

        {upcomingForYou.length > 0 ? (
          <div className="space-y-2">
            {upcomingForYou.slice(0, upcomingLimit).map((event) => (
              <button
                type="button"
                key={event.id}
                onClick={() => onOpenEvent(event)}
                className="block w-full text-left p-3 rounded-xl bg-background/60 border border-border/40 hover:border-primary/50 transition-all group"
              >
                <p className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{event.title}</p>
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3 opacity-70" /> {event.date} · {event.time}
                </p>
              </button>
            ))}
            {upcomingForYou.length > upcomingLimit ? (
              <button
                type="button"
                onClick={() => onUpcomingLimitChange(upcomingForYou.length)}
                className="w-full rounded-xl py-2 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                See all · {upcomingForYou.length - upcomingLimit} more
              </button>
            ) : upcomingForYou.length > UPCOMING_PREVIEW ? (
              <button
                type="button"
                onClick={() => onUpcomingLimitChange(UPCOMING_PREVIEW)}
                className="w-full rounded-xl py-2 text-[11px] font-semibold text-muted-foreground hover:bg-secondary/50 transition-colors"
              >
                Show less
              </button>
            ) : null}
          </div>
        ) : upcomingInitialLoading ? (
          <div className="h-16 shimmer rounded-xl" />
        ) : (
          <div className="text-center py-6 space-y-2.5">
            <p className="text-xs text-muted-foreground font-medium">Nothing planned yet</p>
            <button
              type="button"
              onClick={() => document.getElementById('all-events-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="rounded-full gradient-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow active:scale-95 transition-transform"
            >
              Find events
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4 space-y-3.5 shadow-lg shadow-black/5 backdrop-blur-sm">
        <div className="flex items-center justify-between pb-1 border-b border-indigo-500/20">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20">
              <Users className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">People you may know</h3>
          </div>
        </div>

        {suggestionsLoading && suggestedUsers.length === 0 ? (
          <div className="space-y-2.5" aria-busy="true">
            <span className="sr-only">Loading suggestions...</span>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-background/60 border border-border/40">
                <div className="h-8 w-8 rounded-full shimmer shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded-full shimmer" />
                  <div className="h-2.5 w-1/2 rounded-full shimmer" />
                </div>
                <div className="h-7 w-7 rounded-full shimmer shrink-0" />
              </div>
            ))}
          </div>
        ) : suggestedUsers.length > 0 ? (
          <div className="space-y-2.5">
            {suggestedUsers.map((person) => {
              const displayName = person.full_name || person.display_name || person.username || 'User';
              return (
                <div key={person.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-background/60 border border-border/40">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(userProfilePath(person.id, user.id))}
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1 text-left bg-transparent border-none p-0"
                  >
                    <UserAvatar src={person.avatar_url || undefined} seed={person.id} name={displayName} size="sm" className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-indigo-500 transition-colors">{displayName}</p>
                      {person.username && (
                        <p className="text-[10px] text-muted-foreground truncate">@{person.username}</p>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddFriend(person.id)}
                    disabled={addingFriendId === person.id}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all active:scale-90 shrink-0 disabled:opacity-50"
                    title="Send friend request"
                    aria-label={`Send friend request to ${displayName}`}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">No suggestions right now</p>
        )}
      </div>
    </aside>
  );
}
