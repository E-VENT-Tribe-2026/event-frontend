import { ArrowLeft, Ban } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { REMOVED_EVENT_NOTE } from '@/pages/chat/chatModel';

type EventDetailsAdminRemovedProps = {
  onBack: () => void;
  onBrowse: () => void;
};

/** Shown when an event an administrator removed is opened, for example from a notification. */
export default function EventDetailsAdminRemoved({ onBack, onBrowse }: EventDetailsAdminRemovedProps) {
  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
        <button type="button" onClick={onBack} className="rounded-full glass-card p-2.5" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Event</h1>
      </header>
      <div className="mx-auto max-w-lg space-y-4 px-4 pt-8">
        <div
          role="alert"
          data-testid="event-removed-note"
          className="space-y-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
            <Ban className="h-6 w-6 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{REMOVED_EVENT_NOTE}</h2>
          <button
            type="button"
            onClick={onBrowse}
            className="mt-2 w-full rounded-xl gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            Browse events
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
