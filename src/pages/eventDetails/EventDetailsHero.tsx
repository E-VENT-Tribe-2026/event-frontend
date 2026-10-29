import { CalendarPlus, Clock, MapPin, Users } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import FriendsGoing from '@/components/FriendsGoing';
import { downloadIcs, googleCalendarUrl } from '@/lib/calendar';
import type { UserSummary } from '@/lib/friendsApi';
import type { EventItem } from '@/lib/storage';
import type { AttendeeRow, OrganizerProfile } from '@/pages/eventDetails/eventDetailsModel';

type EventDetailsHeroProps = {
  event: EventItem;
  isCancelledEvent: boolean;
  isFreeEvent: boolean;
  organizerProfile: OrganizerProfile | null;
  organizerName: string;
  organizerFullName: string;
  organizerAvatar?: string;
  attendeeDisplayCount: number;
  friendsGoing: UserSummary[];
  canViewFullAttendeeList: boolean;
  participantPreview: AttendeeRow[];
  userSignedIn: boolean;
};

export default function EventDetailsHero({
  event,
  isCancelledEvent,
  isFreeEvent,
  organizerProfile,
  organizerName,
  organizerFullName,
  organizerAvatar,
  attendeeDisplayCount,
  friendsGoing,
  canViewFullAttendeeList,
  participantPreview,
  userSignedIn,
}: EventDetailsHeroProps) {
  return (
    <div className="rounded-2xl glass-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">{event.title}</h1>
            {isCancelledEvent && (
              <span
                data-testid="cancelled-badge"
                className="rounded-full bg-destructive/15 text-destructive border border-destructive/30 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide"
              >
                Cancelled
              </span>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">{event.category}</span>
        </div>

        <div className="flex items-center gap-3">
          <UserAvatar
            src={organizerAvatar}
            seed={event.organizerId || event.id}
            name={organizerName}
            size="md"
            className="h-10 w-10 ring-2 ring-primary/30"
          />
          <div>
            <p className="text-sm font-medium text-foreground" data-testid="organizer-full-name">
              {organizerFullName}
            </p>
            {(organizerProfile?.username || event.organizerUsername) ? (
              <p className="text-xs text-muted-foreground" data-testid="organizer-username">
                @{(organizerProfile?.username || event.organizerUsername || '').replace(/^@/, '')}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">Organizer</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4 text-primary" />{event.date} · {event.time}</div>
          <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 text-accent" /><span className="truncate">{event.location}</span></div>
          <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4 text-primary" />{attendeeDisplayCount}/{event.participantsLimit}</div>
          <div className="flex items-center gap-2 text-foreground font-semibold">
            {isFreeEvent ? 'Free' : `€${event.budget} at venue`}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80"
          >
            <CalendarPlus className="h-3.5 w-3.5 text-primary" />
            Google Calendar
          </a>
          <button
            type="button"
            onClick={() => downloadIcs(event)}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80"
          >
            <CalendarPlus className="h-3.5 w-3.5 text-primary" />
            Download .ics
          </button>
        </div>

        <FriendsGoing friends={friendsGoing} />

        <div className="space-y-1">
          {canViewFullAttendeeList ? (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {participantPreview.map((p) => (
                  <UserAvatar
                    key={p.id}
                    src={p.profilePhoto}
                    srcSecondary={p.avatar}
                    seed={p.id}
                    name={p.name}
                    email={p.email}
                    size="sm"
                    className="border-2 border-card"
                  />
                ))}
                {attendeeDisplayCount > 6 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs text-muted-foreground">
                    +{attendeeDisplayCount - 6}
                  </div>
                )}
              </div>
              {attendeeDisplayCount > 0 && (
                <p className="text-xs text-muted-foreground">{attendeeDisplayCount} attending</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{attendeeDisplayCount}</span>{' '}
              {attendeeDisplayCount === 1 ? 'person is' : 'people are'} attending.
              {userSignedIn ? ' Join the event to see who is going.' : ' Sign in and join to see who is going.'}
            </p>
          )}
        </div>
    </div>
  );
}
