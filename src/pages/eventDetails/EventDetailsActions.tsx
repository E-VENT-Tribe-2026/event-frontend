import { useState } from 'react';
import { Ban, Flag, LogOut, Pencil, UserPlus } from 'lucide-react';
import ReportContentDialog from '@/components/ReportContentDialog';

type EventDetailsActionsProps = {
  signedIn: boolean;
  canAccessEventChat: boolean;
  isCancelledEvent: boolean;
  isChatExpired: boolean;
  isEventOwner: boolean;
  isEventPassed: boolean;
  isPastEvent: boolean;
  isAtCapacity: boolean;
  isOrganizer: boolean;
  hasJoined: boolean;
  participationLoading: boolean;
  isUpdatingParticipation: boolean;
  isCancellingEvent: boolean;
  showSplitJoinLeave: boolean;
  useApiParticipation: boolean;
  requiresApproval: boolean;
  isFreeEvent: boolean;
  requestRejected: boolean;
  joinLabel: string;
  onOpenChat: () => void;
  onEdit: () => void;
  onCancelEvent: () => void;
  onJoin: () => void;
  onLeave: () => void;
  eventId?: string;
  onReportSuccess?: (message: string) => void;
};

export default function EventDetailsActions({
  signedIn,
  canAccessEventChat,
  isCancelledEvent,
  isChatExpired,
  isEventOwner,
  isEventPassed,
  isPastEvent,
  isAtCapacity,
  isOrganizer,
  hasJoined,
  participationLoading,
  isUpdatingParticipation,
  isCancellingEvent,
  showSplitJoinLeave,
  useApiParticipation,
  requiresApproval,
  isFreeEvent,
  requestRejected,
  joinLabel,
  onOpenChat,
  onEdit,
  onCancelEvent,
  onJoin,
  onLeave,
  eventId,
  onReportSuccess,
}: EventDetailsActionsProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const canReport = signedIn && !isEventOwner && Boolean(eventId);

  return (
    <>
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">
          {isEventOwner ? 'Your event' : 'Join or leave'}
        </h2>
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Event chat</h2>
        {!signedIn ? (
          <p className="text-xs text-muted-foreground">Sign in and join this event to access the event chat.</p>
        ) : canAccessEventChat ? (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={onOpenChat}
              className="w-full rounded-xl bg-secondary/80 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              Open Event Chat
            </button>
            {isCancelledEvent && (
              <p className="text-[11px] text-center text-muted-foreground">
                This event is cancelled. Chat is read-only.
              </p>
            )}
            {isChatExpired && !isCancelledEvent && (
              <p className="text-[11px] text-center text-muted-foreground">
                This event ended more than 48 hours ago. Chat is read-only.
              </p>
            )}
          </div>
        ) : isCancelledEvent ? (
          <p className="text-xs text-muted-foreground">This event is cancelled.</p>
        ) : (
          <p className="text-xs text-muted-foreground">Join this event to access its chat.</p>
        )}
      </div>

      <div className="flex gap-3">
        {isEventOwner ? (
          <>
            <button
              type="button"
              disabled={isPastEvent || isCancelledEvent}
              onClick={() => !isPastEvent && !isCancelledEvent && onEdit()}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-semibold transition-colors active:scale-[0.98] ${
                isPastEvent || isCancelledEvent
                  ? 'border-border bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                  : 'border-primary/45 bg-primary/15 text-primary hover:bg-primary/25'
              }`}
            >
              <Pencil className="h-4 w-4 shrink-0" />
              Edit event
            </button>
            {!isEventPassed && (
              <button
                type="button"
                disabled={isCancellingEvent || isCancelledEvent}
                onClick={() => void onCancelEvent()}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-semibold transition-colors active:scale-[0.98] ${
                  isCancelledEvent
                    ? 'border-border bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                    : 'border-destructive/45 bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-60'
                }`}
              >
                <Ban className="h-4 w-4 shrink-0" />
                {isCancellingEvent ? 'Cancelling…' : isCancelledEvent ? 'Cancelled' : 'Cancel event'}
              </button>
            )}
          </>
        ) : showSplitJoinLeave ? (
          <>
            <button
              type="button"
              onClick={() => { if (!hasJoined && !participationLoading && !isPastEvent && !isCancelledEvent && !isAtCapacity) void onJoin(); }}
              disabled={isPastEvent || isCancelledEvent || isAtCapacity || hasJoined || participationLoading || isUpdatingParticipation || requestRejected}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] ${
                isPastEvent || isCancelledEvent || isAtCapacity || hasJoined || participationLoading || isUpdatingParticipation
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'gradient-primary text-primary-foreground shadow-glow ripple-container'
              }`}
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              {isCancelledEvent ? 'Event Cancelled' : isPastEvent ? 'Event Ended' : isAtCapacity ? 'Event Full' : 'Join Event'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (hasJoined && !isUpdatingParticipation && !participationLoading && !isCancelledEvent) void onLeave();
              }}
              disabled={!hasJoined || participationLoading || isUpdatingParticipation || isCancelledEvent}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] ${
                !hasJoined || participationLoading || isUpdatingParticipation || isCancelledEvent
                  ? 'cursor-not-allowed bg-muted/50 text-muted-foreground'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Leave Event
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => { if (!isCancelledEvent) void onJoin(); }}
            disabled={isCancelledEvent || isPastEvent || isAtCapacity || isOrganizer || isEventOwner || requestRejected || isUpdatingParticipation || participationLoading}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-transform active:scale-[0.98] ${
              isCancelledEvent || isPastEvent || isAtCapacity || isOrganizer || isEventOwner || requestRejected || isUpdatingParticipation || participationLoading
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : hasJoined
                  ? 'border border-border bg-secondary text-foreground hover:bg-secondary/80'
                  : 'gradient-primary text-primary-foreground shadow-glow ripple-container'
            }`}
          >
            {useApiParticipation && !requiresApproval && isFreeEvent && !isCancelledEvent ? (
              hasJoined ? <LogOut className="h-4 w-4 shrink-0" /> : <UserPlus className="h-4 w-4 shrink-0" />
            ) : null}
            {joinLabel}
          </button>
        )}
      </div>

      {canReport && (
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10"
        >
          <Flag className="h-4 w-4" />
          Report event
        </button>
      )}

      {eventId && (
        <ReportContentDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetType="event"
          targetId={eventId}
          origin="event_details"
          title="Report this event"
          onSuccess={onReportSuccess}
        />
      )}
    </>
  );
}
