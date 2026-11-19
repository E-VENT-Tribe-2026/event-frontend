import { ArrowLeft, UserMinus } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

type EventDetailsRemovedProps = {
  title: string;
  onBack: () => void;
  onBrowse: () => void;
};

export default function EventDetailsRemoved({ title, onBack, onBrowse }: EventDetailsRemovedProps) {
  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
        <button type="button" onClick={onBack} className="rounded-full glass-card p-2.5" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Event</h1>
      </header>
      <div className="mx-auto max-w-lg space-y-4 px-4 pt-8">
        <div className="rounded-2xl glass-card p-6 space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
            <UserMinus className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">You no longer have access</h2>
          <p className="text-sm text-muted-foreground">
            The organizer removed you from <span className="font-medium text-foreground">{title}</span>. You
            can't rejoin this event from the app.
          </p>
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
