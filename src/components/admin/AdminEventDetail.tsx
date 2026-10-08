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

const CATEGORY_HUE: Record<string, number> = {
  music: 290,
  tech: 200,
  technology: 200,
  food: 18,
  sports: 150,
  sport: 150,
  art: 330,
  arts: 330,
  gaming: 255,
  health: 160,
  education: 55,
  social: 340,
  business: 220,
  other: 213,
};

function getCategoryHue(category?: string): number {
  if (!category) return 271;
  return CATEGORY_HUE[category.toLowerCase()] ?? 271;
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
      className={`w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left text-xs ${
        onNavigate
          ? 'hover:opacity-80 cursor-pointer group transition-all'
          : ''
      }`}
      style={{
        background: 'hsl(213 40% 18% / .5)',
        borderColor: 'var(--adm-border)',
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate" style={{ color: 'var(--adm-fg)' }}>
          {participant.full_name}
        </p>
        {participant.username && (
          <p className="text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
            @{participant.username}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {participant.joined_at && (
          <p className="text-[11px] hidden sm:block" style={{ color: 'var(--adm-muted-fg)' }}>
            Joined {formatDateShort(participant.joined_at)}
          </p>
        )}
        {onNavigate && (
          <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--adm-muted-fg)' }} />
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
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
          style={{ color: 'var(--adm-muted-fg)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Events
        </button>

        {loading ? (
          <div
            className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border"
            style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
          >
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--adm-primary)' }} />
            <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              Loading event details...
            </p>
          </div>
        ) : error ? (
          <div
            className="rounded-xl border p-6 text-center space-y-2"
            style={{
              borderColor: 'hsl(0 84% 60% / .3)',
              background: 'hsl(0 84% 60% / .07)',
            }}
          >
            <AlertCircle className="mx-auto h-6 w-6" style={{ color: 'var(--adm-danger)' }} />
            <p className="text-xs font-medium" style={{ color: 'var(--adm-danger-text)' }}>
              {error}
            </p>
          </div>
        ) : event ? (
          <>
            {/* Hero Band */}
            {(() => {
              const H = getCategoryHue(event.category);
              return (
                <div
                  className="relative overflow-hidden"
                  style={{
                    height: 120,
                    borderRadius: '16px 16px 0 0',
                    background: `linear-gradient(135deg, hsl(${H} 70% 40%), hsl(${(H + 45) % 360} 70% 25%))`,
                  }}
                >
                  {/* Faded calendar icon bottom-right */}
                  <Calendar
                    className="absolute bottom-2 right-3 h-20 w-20 pointer-events-none text-white"
                    style={{ opacity: 0.28 }}
                  />
                  {/* Top content */}
                  <div className="relative z-10 p-5 flex items-start justify-between gap-3">
                    <div className="flex gap-2 flex-wrap">
                      {event.category && (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: 'hsl(271 76% 53% / .35)',
                            color: 'var(--adm-primary-text)',
                          }}
                        >
                          {event.category}
                        </span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getStatusLabel(event).className}`}
                    >
                      {getStatusLabel(event).label}
                    </span>
                  </div>
                  <div className="relative z-10 px-5 pb-4">
                    <h2 className="text-lg font-bold text-white leading-tight">{event.title}</h2>
                    {event.description && (
                      <p className="mt-1 text-sm text-white/80 leading-relaxed line-clamp-2">
                        {event.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Facts Grid */}
            <div
              className="rounded-b-2xl border p-5 space-y-4"
              style={{
                background: 'var(--adm-grad-card)',
                borderColor: 'var(--adm-border)',
                boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
                borderRadius: '0 0 16px 16px',
              }}
            >
              <h3 className="text-sm font-bold" style={{ color: 'var(--adm-fg)' }}>
                Event Details
              </h3>
              <dl className="grid grid-cols-1 gap-y-3 sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <Calendar
                    className="h-4 w-4 mt-0.5 shrink-0"
                    style={{ color: 'var(--adm-muted-fg)' }}
                  />
                  <div>
                    <dt
                      className="text-[11px] uppercase tracking-wider font-medium"
                      style={{ color: 'var(--adm-muted-fg)' }}
                    >
                      Date &amp; Time
                    </dt>
                    <dd className="text-xs font-semibold mt-0.5" style={{ color: 'var(--adm-fg)' }}>
                      {formatDate(event.date)}
                    </dd>
                  </div>
                </div>

                {event.location && (
                  <div className="flex items-start gap-2">
                    <MapPin
                      className="h-4 w-4 mt-0.5 shrink-0"
                      style={{ color: 'var(--adm-muted-fg)' }}
                    />
                    <div>
                      <dt
                        className="text-[11px] uppercase tracking-wider font-medium"
                        style={{ color: 'var(--adm-muted-fg)' }}
                      >
                        Location
                      </dt>
                      <dd
                        className="text-xs font-semibold mt-0.5"
                        style={{ color: 'var(--adm-fg)' }}
                      >
                        {event.location}
                      </dd>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <Users
                    className="h-4 w-4 mt-0.5 shrink-0"
                    style={{ color: 'var(--adm-muted-fg)' }}
                  />
                  <div>
                    <dt
                      className="text-[11px] uppercase tracking-wider font-medium"
                      style={{ color: 'var(--adm-muted-fg)' }}
                    >
                      Participants
                    </dt>
                    <dd className="text-xs font-semibold mt-0.5" style={{ color: 'var(--adm-fg)' }}>
                      {event.participants.length}
                      {event.participants_limit ? ` / ${event.participants_limit}` : ''}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {event.is_private ? (
                    <Lock
                      className="h-4 w-4 mt-0.5 shrink-0"
                      style={{ color: 'var(--adm-muted-fg)' }}
                    />
                  ) : (
                    <Globe
                      className="h-4 w-4 mt-0.5 shrink-0"
                      style={{ color: 'var(--adm-muted-fg)' }}
                    />
                  )}
                  <div>
                    <dt
                      className="text-[11px] uppercase tracking-wider font-medium"
                      style={{ color: 'var(--adm-muted-fg)' }}
                    >
                      Visibility
                    </dt>
                    <dd className="text-xs font-semibold mt-0.5" style={{ color: 'var(--adm-fg)' }}>
                      {event.is_private ? 'Private' : 'Public'}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {event.requires_approval ? (
                    <CheckCircle2
                      className="h-4 w-4 mt-0.5 shrink-0"
                      style={{ color: 'var(--adm-muted-fg)' }}
                    />
                  ) : (
                    <XCircle
                      className="h-4 w-4 mt-0.5 shrink-0"
                      style={{ color: 'var(--adm-muted-fg)' }}
                    />
                  )}
                  <div>
                    <dt
                      className="text-[11px] uppercase tracking-wider font-medium"
                      style={{ color: 'var(--adm-muted-fg)' }}
                    >
                      Approval
                    </dt>
                    <dd className="text-xs font-semibold mt-0.5" style={{ color: 'var(--adm-fg)' }}>
                      {event.requires_approval ? 'Required' : 'Open'}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Clock
                    className="h-4 w-4 mt-0.5 shrink-0"
                    style={{ color: 'var(--adm-muted-fg)' }}
                  />
                  <div>
                    <dt
                      className="text-[11px] uppercase tracking-wider font-medium"
                      style={{ color: 'var(--adm-muted-fg)' }}
                    >
                      Created
                    </dt>
                    <dd className="text-xs font-semibold mt-0.5" style={{ color: 'var(--adm-fg)' }}>
                      {formatDateShort(event.created_at)}
                    </dd>
                  </div>
                </div>

                {typeof event.reports_count === 'number' && event.reports_count > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertCircle
                      className="h-4 w-4 mt-0.5 shrink-0"
                      style={{ color: 'var(--adm-danger)' }}
                    />
                    <div>
                      <dt
                        className="text-[11px] uppercase tracking-wider font-medium"
                        style={{ color: 'var(--adm-muted-fg)' }}
                      >
                        Reports
                      </dt>
                      <dd
                        className="text-xs font-semibold mt-0.5"
                        style={{ color: 'var(--adm-danger-text)' }}
                      >
                        {event.reports_count}
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>

            {/* Organizer */}
            <div
              className="rounded-[16px] border p-5 space-y-3"
              style={{
                background: 'var(--adm-grad-card)',
                borderColor: 'var(--adm-border)',
                boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
              }}
            >
              <h3 className="text-sm font-bold" style={{ color: 'var(--adm-fg)' }}>
                Organizer
              </h3>
              {onNavigateToUser ? (
                <button
                  type="button"
                  onClick={() => onNavigateToUser(event.organizer_id)}
                  aria-label={`View organizer ${event.organizer_name}`}
                  className="group w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left hover:opacity-80 transition-all"
                  style={{
                    background: 'hsl(213 40% 20% / .5)',
                    borderColor: 'var(--adm-border)',
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        background: 'var(--adm-secondary)',
                        borderColor: 'var(--adm-border)',
                      }}
                    >
                      <User className="h-4 w-4" style={{ color: 'var(--adm-muted-fg)' }} />
                    </div>
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--adm-fg)' }}>
                      {event.organizer_name}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--adm-muted-fg)' }} />
                </button>
              ) : (
                <div
                  className="flex items-center gap-2.5 rounded-xl border p-3"
                  style={{
                    background: 'hsl(213 40% 20% / .5)',
                    borderColor: 'var(--adm-border)',
                  }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                    style={{ background: 'var(--adm-secondary)', borderColor: 'var(--adm-border)' }}
                  >
                    <User className="h-4 w-4" style={{ color: 'var(--adm-muted-fg)' }} />
                  </div>
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--adm-fg)' }}>
                    {event.organizer_name}
                  </p>
                </div>
              )}
            </div>

            {/* Participants */}
            <div
              className="rounded-[16px] border p-5 space-y-3"
              style={{
                background: 'var(--adm-grad-card)',
                borderColor: 'var(--adm-border)',
                boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
              }}
            >
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--adm-fg)' }}>
                Participants
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    background: 'var(--adm-secondary)',
                    color: 'var(--adm-muted-fg)',
                  }}
                >
                  {event.participants.length}
                </span>
              </h3>
              {event.participants.length === 0 ? (
                <p className="text-xs italic" style={{ color: 'var(--adm-muted-fg)' }}>
                  No participants yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {event.participants.map((p) => (
                    <ParticipantRow key={p.id} participant={p} onNavigate={onNavigateToUser} />
                  ))}
                </div>
              )}
            </div>

            {/* Remove Event */}
            <div
              className="rounded-[16px] border p-5 space-y-3"
              style={{
                borderColor: 'hsl(0 84% 60% / .3)',
                background: 'hsl(0 84% 60% / .07)',
              }}
            >
              <h3 className="text-sm font-bold" style={{ color: 'var(--adm-danger-text)' }}>
                Danger Zone
              </h3>
              <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                Permanently remove this event. This action cannot be undone.
              </p>
              <button
                type="button"
                onClick={() => setShowRemoveDialog(true)}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold active:scale-95 transition-all"
                style={{
                  borderColor: 'hsl(0 84% 60% / .4)',
                  background: 'hsl(0 84% 60% / .12)',
                  color: 'var(--adm-danger-text)',
                }}
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
              className="rounded-lg text-xs font-semibold text-white"
              style={{ background: 'var(--adm-danger)' }}
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
