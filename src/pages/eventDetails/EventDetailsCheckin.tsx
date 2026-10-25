import { MapPinned } from 'lucide-react';
import { isCheckedIn, isCheckinWindow, parseTicketQr, type CheckinRecord } from '@/lib/checkin';

type EventDetailsCheckinProps = {
  eventId: string;
  eventStartMs: number;
  currentUserId: string;
  currentUserName: string;
  isEventOwner: boolean;
  hasJoined: boolean;
  checkins: CheckinRecord[];
  checkinBusy: boolean;
  ticketScan: string;
  onTicketScanChange: (value: string) => void;
  onSelfCheckin: () => void | Promise<void>;
  onTicketCheckin: (userId: string, name: string, ticketId?: string) => void | Promise<void>;
};

export default function EventDetailsCheckin({
  eventId,
  eventStartMs,
  currentUserId,
  currentUserName,
  isEventOwner,
  hasJoined,
  checkins,
  checkinBusy,
  ticketScan,
  onTicketScanChange,
  onSelfCheckin,
  onTicketCheckin,
}: EventDetailsCheckinProps) {
  return (
    <div className="rounded-2xl glass-card p-4 space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPinned className="h-4 w-4 text-primary" />
        Door check-in
        <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
          {checkins.length} here
        </span>
      </h2>
      {checkins.length > 0 && (
        <ul className="space-y-1.5">
          {checkins.map((c) => (
            <li key={c.userId} className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{c.name}</span> checked in
            </li>
          ))}
        </ul>
      )}
      {hasJoined && isCheckinWindow(eventStartMs) && (
        <button
          type="button"
          disabled={checkinBusy || isCheckedIn(eventId, currentUserId)}
          onClick={onSelfCheckin}
          className="w-full rounded-xl gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          {isCheckedIn(eventId, currentUserId) ? "You're here" : "I'm here"}
        </button>
      )}
      {isEventOwner && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const parsed = parseTicketQr(ticketScan);
            if (!parsed?.ticketId && !parsed?.name) return;
            await onTicketCheckin(
              parsed.ticketId || `guest-${Date.now()}`,
              parsed.name || 'Guest',
              parsed.ticketId,
            );
          }}
        >
          <input
            value={ticketScan}
            onChange={(e) => onTicketScanChange(e.target.value)}
            placeholder="Paste ticket QR or ID"
            aria-label="Ticket QR or ID"
            className="flex-1 rounded-xl border border-border/50 bg-secondary px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="submit"
            disabled={checkinBusy || !ticketScan.trim()}
            className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Check in
          </button>
        </form>
      )}
    </div>
  );
}
