import { Link } from 'react-router-dom';
import { Sparkles, Users } from 'lucide-react';
import EventCard from '@/components/EventCard';
import FriendActivityMarquee, { type FriendActivityItem } from '@/components/FriendActivityMarquee';
import InterestEventCard from '@/components/InterestEventCard';
import type { EventItem } from '@/lib/storage';
import HomeSectionHeader from '@/pages/home/HomeSectionHeader';
import { PAGE } from '@/pages/home/homeModel';

type HomeFeedProps = {
  showSocial: boolean;
  collapsed: Record<string, boolean>;
  onToggleSection: (key: string) => void;
  friendsGoingLoading: boolean;
  friendsGoingEvents: FriendActivityItem[];
  friendCount: number;
  hasInterests: boolean;
  recsInitialLoading: boolean;
  filteredRecommendations: EventItem[];
  eventsInitialLoading: boolean;
  filtered: EventItem[];
  visibleAll: number;
  onVisibleAllChange: (value: number | ((v: number) => number)) => void;
  favoriteIds: Set<string>;
  onJoin: (id: string) => void;
  onClearFilters: () => void;
};

export default function HomeFeed({
  showSocial,
  collapsed,
  onToggleSection,
  friendsGoingLoading,
  friendsGoingEvents,
  friendCount,
  hasInterests,
  recsInitialLoading,
  filteredRecommendations,
  eventsInitialLoading,
  filtered,
  visibleAll,
  onVisibleAllChange,
  favoriteIds,
  onJoin,
  onClearFilters,
}: HomeFeedProps) {
  return (
    <div className="space-y-6 min-w-0">
      {showSocial && (
        <div className="space-y-2">
          <HomeSectionHeader
            icon={Users}
            title="See what your friends are up to"
            collapsed={!!collapsed['friends']}
            onToggle={() => onToggleSection('friends')}
            iconClassName="text-orange-500"
            iconWrapClassName="bg-orange-500/15 group-hover:bg-orange-500/25"
          />
          {!collapsed['friends'] && (
            friendsGoingLoading && friendsGoingEvents.length === 0 ? (
              <div className="flex gap-4 overflow-hidden pt-1" aria-busy="true">
                <span className="sr-only">Looking for events your friends joined</span>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 w-56 shrink-0 animate-pulse rounded-2xl border border-border/40 bg-secondary/40" />
                ))}
              </div>
            ) : friendsGoingEvents.length > 0 ? (
              <FriendActivityMarquee items={friendsGoingEvents} />
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-2xl glass-card px-4 py-5 text-center">
                <p className="text-xs text-muted-foreground max-w-[16rem]">
                  {friendCount === 0
                    ? 'Add friends to see the events they join.'
                    : 'None of your friends have joined an upcoming event yet.'}
                </p>
                {friendCount === 0 && (
                  <Link
                    to="/friends"
                    className="rounded-full bg-orange-500/15 px-3 py-1.5 text-[11px] font-semibold text-orange-500 hover:bg-orange-500/25 transition-colors"
                  >
                    Find friends
                  </Link>
                )}
              </div>
            )
          )}
        </div>
      )}

      {showSocial && (
        <div className="space-y-2">
          <HomeSectionHeader
            icon={Sparkles}
            title="Based on your interests"
            iconClassName="text-pink-400"
            iconWrapClassName="bg-pink-400/15 group-hover:bg-pink-400/25"
          />
          {hasInterests ? (
            recsInitialLoading ? (
              <div className="space-y-2 pt-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 w-full animate-pulse rounded-2xl border border-border/40 bg-secondary/40" />
                ))}
              </div>
            ) : filteredRecommendations.length > 0 ? (
              <div className="space-y-2" data-testid="interest-event-list">
                {filteredRecommendations.map((event) => (
                  <InterestEventCard key={event.id} event={event} variant="row" />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl glass-card px-4 py-5 text-xs text-muted-foreground text-center">
                No events match your interests yet. Update them from your profile to discover more.
              </div>
            )
          ) : (
            <div className="rounded-2xl glass-card px-4 py-5 text-xs text-muted-foreground text-center">
              Add interests in your profile to get personalized events.
            </div>
          )}
        </div>
      )}

      <div id="all-events-section" className="space-y-2">
        <HomeSectionHeader icon={Sparkles} title="All events" collapsed={!!collapsed['events']} onToggle={() => onToggleSection('events')} />
        {!collapsed['events'] && (
          eventsInitialLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
              <span className="sr-only">Loading the latest events...</span>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl glass-card overflow-hidden">
                  <div className="h-40 shimmer" />
                  <div className="p-4 space-y-2">
                    <div className="h-3.5 w-3/4 rounded-full shimmer" />
                    <div className="h-3 w-1/2 rounded-full shimmer" />
                    <div className="h-3 w-2/3 rounded-full shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.slice(0, visibleAll).map((event) => (
                  <EventCard key={event.id} event={event} onJoin={onJoin} isFavorite={favoriteIds.has(event.id)} />
                ))}
              </div>

              {(visibleAll < filtered.length || visibleAll > PAGE) && (
                <div className="flex gap-2 pt-2">
                  {visibleAll < filtered.length && (
                    <button
                      type="button"
                      onClick={() => onVisibleAllChange((v) => v + PAGE)}
                      className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-primary hover:bg-secondary/50 transition-colors"
                    >
                      View more · {filtered.length - visibleAll} remaining
                    </button>
                  )}
                  {visibleAll > PAGE && (
                    <button
                      type="button"
                      onClick={() => onVisibleAllChange(PAGE)}
                      className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary/50 transition-colors"
                    >
                      Show less
                    </button>
                  )}
                </div>
              )}

              {filtered.length === 0 && (
                <div className="rounded-3xl py-16 px-6 text-center glass-card space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/60">
                    <Sparkles className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No events match your filters.</p>
                  <p className="text-xs text-muted-foreground">Try a different date, location, or budget.</p>
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="mt-1 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-primary hover:bg-secondary/50 transition-colors"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
