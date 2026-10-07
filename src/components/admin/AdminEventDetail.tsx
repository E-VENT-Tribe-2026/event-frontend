import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Calendar,
  MapPin,
  Users,
  Lock,
  Globe,
  User,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  fetchAdminEventDetail,
  removeEvent,
  type AdminEventDetail,
  type AdminEventParticipant,
} from '@/lib/adminApi';

interface AdminEventDetailProps {
  eventId: string;
  onBack: () => void;
  onNavigateToUser?: (userId: string) => void;
  onErrorToast: (message: string) => void;
  onSuccessToast: (message: string) => void;
}

const CATEGORY_GRADIENT: Record<string, string> = {
  music: 'from-pink-700/60 to-pink-900/30',
  sports: 'from-green-700/60 to-green-900/30',
  tech: 'from-blue-700/60 to-blue-900/30',
  technology: 'from-blue-700/60 to-blue-900/30',
  food: 'from-orange-700/60 to-orange-900/30',
  art: 'from-purple-700/60 to-purple-900/30',
  arts: 'from-purple-700/60 to-purple-900/30',
  gaming: 'from-cyan-700/60 to-cyan-900/30',
  health: 'from-teal-700/60 to-teal-900/30',
  education: 'from-yellow-700/60 to-yellow-900/30',
  social: 'from-rose-700/60 to-rose-900/30',
  business: 'from-indigo-700/60 to-indigo-900/30',
};

function getCategoryGradient(category?: string): string {
  if (!category) return 'from-primary/40 to-primary/10';
  return CATEGORY_GRADIENT[category.toLowerCase()] ?? 'from-primary/40 to-primary/10';
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function formatDateShort(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function getStatusLabel(event: AdminEventDetail): { label: string; className: string } {
  if (event.is_cancelled || event.status === 'cancelled') {
    return {
      label: 'Cancelled',
      className: 'bg-destructive/15 text-destructive',
    };
  }
  const now = Date.now();
  const eventDate = new Date(event.date).getTime();
  if (eventDate > now) {
    return {
      label: 'Upcoming',
      className: 'bg-blue-500/15 text-blue-400',
    };
  }
  return {
    label: 'Past',
    className: 'bg-muted text-muted-foreground',
  };
}

function ParticipantRow({
  participant,
  onNavigate,
}: {
  participant: AdminEventParticipant;
  onNavigate?: (userId: string) => void;
}) {
  const Wrapper = onNavigate ? 'button' : 'div';
  return (
    <Wrapper
      type={onNavigate ? 'button' : undefined}
      onClick={onNavigate ? () => onNavigate(participant.id) : undefined}
      aria-label={onNavigate ? `View user ${participant.full_name}` : undefined}
      className={`w-full flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/30 p-3 text-left text-xs ${
        onNavigate
          ? 'hover:bg-secondary/60 hover:border-primary/30 cursor-pointer group transition-colors'
          : ''
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground truncate">{participant.full_name}</p>
        {participant.username && (
          <p className="text-[11px] text-muted-foreground">@{participant.username}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {participant.joined_at && (
          <p className="text-[11px] text-muted-foreground hidden sm:block">
            Joined {formatDateShort(participant.joined_at)}
          </p>
        )}
        {onNavigate && (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </div>
    </Wrapper>
  );
}

export default function AdminEventDetail({
  eventId,
  onBack,
  onNavigateToUser,
  onErrorToast,
  onSuccessToast,
}: AdminEventDetailProps) {
  const [event, setEvent] = useState<AdminEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchAdminEventDetail(eventId)
      .then((data) => {
        if (!cancelled) {
          setEvent(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load event');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const handleRemove = async () => {
    if (!event || removing) return;
    setRemoving(true);
    try {
      const res = await removeEvent(event.id);
      onSuccessToast(res.message || 'Event removed.');
      onBack();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove event.';
      onErrorToast(msg);
    } finally {
      setRemoving(false);
      setShowRemoveDialog(false);
    }
  };

  return (
    <>
      <div className="space-y-5">
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Events
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border border-border/50 bg-card">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading event details...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center space-y-2">
            <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
            <p className="text-xs text-destructive font-medium">{error}</p>
          </div>
        ) : event ? (
          <>
            {/* Hero Band */}
            <div
              className={`rounded-2xl border border-border bg-gradient-to-br ${getCategoryGradient(event.category)} overflow-hidden shadow-sm`}
            >
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {event.category && (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70 mb-1">
                        {event.category}
                      </p>
                    )}
                    <h2 className="text-lg font-bold text-white leading-tight">{event.title}</h2>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getStatusLabel(event).className}`}
                  >
                    {getStatusLabel(event).label}
                  </span>
                </div>

                {event.description && (
                  <p className="text-sm text-white/80 leading-relaxed line-clamp-3">
                    {event.description}
                  </p>
                )}
              </div>
            </div>

            {/* Facts Grid */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-3">Event Details</h3>
              <dl className="grid grid-cols-1 gap-y-3 sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                      Date &amp; Time
                    </dt>
                    <dd className="text-xs font-semibold text-foreground mt-0.5">{formatDate(event.date)}</dd>
                  </div>
                </div>

                {event.location && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <dt className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                        Location
                      </dt>
                      <dd className="text-xs font-semibold text-foreground mt-0.5">{event.location}</dd>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                      Participants
                    </dt>
                    <dd className="text-xs font-semibold text-foreground mt-0.5">
                      {event.participants.length}
                      {event.participants_limit ? ` / ${event.participants_limit}` : ''}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {event.is_private ? (
                    <Lock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  ) : (
                    <Globe className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  )}
                  <div>
                    <dt className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                      Visibility
                    </dt>
                    <dd className="text-xs font-semibold text-foreground mt-0.5">
                      {event.is_private ? 'Private' : 'Public'}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {event.requires_approval ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  )}
                  <div>
                    <dt className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                      Approval
                    </dt>
                    <dd className="text-xs font-semibold text-foreground mt-0.5">
                      {event.requires_approval ? 'Required' : 'Open'}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                      Created
                    </dt>
                    <dd className="text-xs font-semibold text-foreground mt-0.5">
                      {formatDateShort(event.created_at)}
                    </dd>
                  </div>
                </div>

                {typeof event.reports_count === 'number' && event.reports_count > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                    <div>
                      <dt className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                        Reports
                      </dt>
                      <dd className="text-xs font-semibold text-destructive mt-0.5">
                        {event.reports_count}
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>

            {/* Organizer */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-foreground">Organizer</h3>
              {onNavigateToUser ? (
                <button
                  type="button"
                  onClick={() => onNavigateToUser(event.organizer_id)}
                  aria-label={`View organizer ${event.organizer_name}`}
                  className="group w-full flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/30 p-3 text-left hover:bg-secondary/60 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary border border-border">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">{event.organizer_name}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </button>
              ) : (
                <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-secondary/30 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary border border-border">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{event.organizer_name}</p>
                </div>
              )}
            </div>

            {/* Participants */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                Participants
                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {event.participants.length}
                </span>
              </h3>
              {event.participants.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 italic">No participants yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {event.participants.map((p) => (
                    <ParticipantRow
                      key={p.id}
                      participant={p}
                      onNavigate={onNavigateToUser}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Remove Event */}
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-destructive">Danger Zone</h3>
              <p className="text-xs text-muted-foreground">
                Permanently remove this event. This action cannot be undone.
              </p>
              <button
                type="button"
                onClick={() => setShowRemoveDialog(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 active:scale-95 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove Event
              </button>
            </div>
          </>
        ) : null}
      </div>

      {/* Remove Event AlertDialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={(open) => !open && setShowRemoveDialog(false)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">Remove Event?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will permanently delete &ldquo;{event?.title}&rdquo; and all its data. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 justify-end">
            <AlertDialogCancel disabled={removing} className="rounded-lg text-xs mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(e) => {
                e.preventDefault();
                void handleRemove();
              }}
              className="rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90"
            >
              {removing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Event'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
