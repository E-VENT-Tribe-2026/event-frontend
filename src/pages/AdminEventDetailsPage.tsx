import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Tag, Users, Wallet, Loader2, AlertCircle } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import AdminPerson from '@/components/admin/AdminPerson';
import { fetchAdminEventDetails, type AdminEventDetails } from '@/lib/adminApi';
import { formatAdminDateTime, isEventCancelled } from '@/lib/adminFormat';

function formatCost(cost: number | null | undefined): string | null {
  if (cost === null || cost === undefined) return null;
  return cost === 0 ? 'Free' : `€${cost}`;
}

/**
 * The administrator panel's own event details page (/admin/events/:eventId).
 * Works for any event, including cancelled and ended ones. Nothing is cached.
 * All text from users is rendered as plain React text.
 */
export default function AdminEventDetailsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<AdminEventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setEvent(null);
    fetchAdminEventDetails(eventId)
      .then((data) => {
        if (!cancelled) setEvent(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load event');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const goBack = () => {
    // Come back to wherever the admin was (Events tab or a user's details).
    if (window.history.length > 1) navigate(-1);
    else navigate('/admin?tab=events', { replace: true });
  };

  const participants = event?.participants ?? [];
  const cost = formatCost(event?.cost);

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground hover:bg-secondary/80"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Event details</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {loading && (
          <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border border-border/50 bg-card py-16">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading event...</p>
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="flex flex-col items-center space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center"
          >
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">Could not load this event</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && event && (
          <>
            <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-extrabold text-foreground break-words">{event.title}</h2>
                {isEventCancelled(event) && (
                  <span className="shrink-0 rounded-full bg-destructive/15 px-2.5 py-1 text-[11px] font-semibold text-destructive">
                    Cancelled
                  </span>
                )}
              </div>

              {event.description && (
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {event.description}
                </p>
              )}

              <dl className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2.5">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <dt className="sr-only">Date</dt>
                    <dd className="text-foreground">
                      {formatAdminDateTime(event.start_datetime)}
                      {event.end_datetime ? ` – ${formatAdminDateTime(event.end_datetime)}` : ''}
                    </dd>
                  </div>
                </div>
                {event.location_name && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <dt className="sr-only">Location</dt>
                      <dd className="break-words text-foreground">{event.location_name}</dd>
                    </div>
                  </div>
                )}
                {event.category && (
                  <div className="flex items-start gap-2.5">
                    <Tag className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <dt className="sr-only">Category</dt>
                      <dd className="text-foreground">{event.category}</dd>
                    </div>
                  </div>
                )}
                {cost && (
                  <div className="flex items-start gap-2.5">
                    <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <dt className="sr-only">Cost</dt>
                      <dd className="text-foreground">{cost}</dd>
                    </div>
                  </div>
                )}
                {event.max_capacity != null && (
                  <div className="flex items-start gap-2.5">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <dt className="sr-only">Capacity</dt>
                      <dd className="text-foreground">Capacity: {event.max_capacity}</dd>
                    </div>
                  </div>
                )}
              </dl>
            </section>

            {event.organizer && (
              <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Organizer
                </h3>
                <AdminPerson person={event.organizer} size="md" />
              </section>
            )}

            <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Participants ({event.participant_count ?? participants.length})
              </h3>
              {participants.length === 0 ? (
                <p className="text-xs italic text-muted-foreground/70">No participants yet.</p>
              ) : (
                <ul className="space-y-3">
                  {participants.map((p) => (
                    <li key={p.id}>
                      <AdminPerson person={p} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
