import { useState } from 'react';
import { MapPinned, UserMinus, UserPlus, Users } from 'lucide-react';
import FriendsAttendingSection from '@/components/FriendsAttendingSection';
import InviteFriendsDialog from '@/components/InviteFriendsDialog';
import { UserAvatar } from '@/components/UserAvatar';
import type { ParticipantRow } from '@/lib/eventAttendeesApi';
import { formatUserIdentity } from '@/lib/userIdentity';
import type { AttendeeRow } from '@/pages/eventDetails/eventDetailsModel';

type EventDetailsAttendeesProps = {
  eventId: string;
  currentUserId?: string;
  canViewFullAttendeeList: boolean;
  canInviteFriends: boolean;
  showInviteDialog: boolean;
  onInviteDialogChange: (open: boolean) => void;
  participationKnown: boolean;
  useApiParticipation: boolean;
  apiParticipantsEmpty: boolean;
  fullAttendeeRows: AttendeeRow[];
  attendingFriends: ParticipantRow[];
  attendeeDisplayCount: number;
  isEventOwner: boolean;
  isCancelledEvent: boolean;
  isPastEvent: boolean;
  checkedInUserIds?: Set<string>;
  removingParticipantId: string | null;
  onRemove: (userId: string) => void;
};

export default function EventDetailsAttendees({
  eventId,
  currentUserId,
  canViewFullAttendeeList,
  canInviteFriends,
  showInviteDialog,
  onInviteDialogChange,
  participationKnown,
  useApiParticipation,
  apiParticipantsEmpty,
  fullAttendeeRows,
  attendingFriends,
  attendeeDisplayCount,
  isEventOwner,
  isCancelledEvent,
  isPastEvent,
  checkedInUserIds,
  removingParticipantId,
  onRemove,
}: EventDetailsAttendeesProps) {
  const [showAllAttendees, setShowAllAttendees] = useState(false);
  const attendeePreviewLimit = 5;
  const visibleAttendeeRows =
    showAllAttendees || fullAttendeeRows.length <= attendeePreviewLimit
      ? fullAttendeeRows
      : fullAttendeeRows.slice(0, attendeePreviewLimit);
  const hiddenAttendeeCount = Math.max(0, fullAttendeeRows.length - attendeePreviewLimit);

  return (
    <>
      <div className="rounded-2xl glass-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 text-primary" />
            Attendees
          </h2>
          {canInviteFriends && (
            <button
              type="button"
              onClick={() => onInviteDialogChange(true)}
              className="inline-flex items-center gap-1 rounded-full gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-glow"
            >
              <UserPlus className="h-3.5 w-3.5" /> Invite friends
            </button>
          )}
        </div>
        {canViewFullAttendeeList ? (
          (!participationKnown || (useApiParticipation && apiParticipantsEmpty && !participationKnown)) && useApiParticipation ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-secondary/40 px-3 py-2.5">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-secondary" />
                  <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
                </div>
              ))}
            </div>
          ) : fullAttendeeRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">No attendees yet.</p>
          ) : (
            <div className="space-y-2">
              <ul className="space-y-2">
                {visibleAttendeeRows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-secondary/40 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <UserAvatar
                        src={row.profilePhoto}
                        srcSecondary={row.avatar}
                        seed={row.id}
                        name={row.name}
                        email={row.email}
                        size="sm"
                        className="shrink-0 border border-border/50"
                      />
                      <span className="truncate text-sm font-medium text-foreground">
                        {formatUserIdentity({ fullName: row.name })}
                        {row.username && (
                          <p className="text-sm text-muted-foreground" data-testid="profile-username">@{row.username}</p>
                        )}
                      </span>
                      {row.isFriend && (
                        <span
                          data-testid="friend-label"
                          className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary"
                        >
                          Friend
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {checkedInUserIds?.has(row.id) && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-primary/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                          <MapPinned className="h-3 w-3" />
                          Here
                        </span>
                      )}
                      {isEventOwner && currentUserId && String(row.id) !== String(currentUserId) && !isPastEvent && !isCancelledEvent && (
                        <button
                          type="button"
                          disabled={removingParticipantId === row.id}
                          onClick={() => void onRemove(row.id)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-destructive/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <UserMinus className="h-3 w-3" />
                          {removingParticipantId === row.id ? '…' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {hiddenAttendeeCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllAttendees((open) => !open)}
                  className="w-full rounded-xl py-2 text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  {showAllAttendees ? 'See less' : 'See more'}
                </button>
              )}
            </div>
          )
        ) : attendingFriends.length > 0 ? (
          <FriendsAttendingSection
            friends={attendingFriends}
            othersCount={Math.max(0, attendeeDisplayCount - attendingFriends.length)}
          />
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            For privacy, only the count is shown here:{' '}
            <span className="font-semibold text-foreground">{attendeeDisplayCount}</span>{' '}
            {attendeeDisplayCount === 1 ? 'person is' : 'people are'} going.
          </p>
        )}
      </div>

      {canInviteFriends && (
        <InviteFriendsDialog open={showInviteDialog} onOpenChange={onInviteDialogChange} eventId={eventId} />
      )}
    </>
  );
}
