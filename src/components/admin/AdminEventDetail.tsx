import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Calendar,
  Clock,
  MapPin,
  Users,
  Euro,
  CheckCircle2,
  Shield,
  MessageCircle,
  Trash2,
  ChevronRight,
  Gamepad2,
  Trophy,
  Cpu,
  Plane,
  Music,
  Palette,
  Utensils,
  type LucideIcon,
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
  personDisplayName,
  readChatMessages,
  readRemovedState,
  type AdminChatMessage,
  removeEvent,
  type AdminEventDetail,
  type AdminEventParticipant,
} from '@/lib/adminApi';
import AdminEventChat from '@/components/admin/AdminEventChat';

interface AdminEventDetailProps {
  eventId: string;
  onBack: () => void;
  onNavigateToUser?: (userId: string) => void;
  onOpenChat?: (eventId: string) => void;
  onErrorToast: (message: string) => void;
  onSuccessToast: (message: string) => void;
}

type EventExtra = {
  price?: number | null;
  is_free?: boolean;
  currency?: string;
  location_name?: string;
  latitude?: number | null;
  longitude?: number | null;
  cost?: number | null;
  max_capacity?: number | null;
  start_datetime?: string;
  participant_count?: number;
  organizer?: {
    id?: string;
    username?: string;
    full_name?: string;
    display_name?: string;
    avatar_url?: string;
  };
};

type ParticipantExtra = AdminEventParticipant & {
  avatar_url?: string;
  is_pro?: boolean;
};

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
  travel: 222,
  other: 213,
};

const CATEGORY_ICON: Record<string, LucideIcon> = {
  gaming: Gamepad2,
  sports: Trophy,
  sport: Trophy,
  tech: Cpu,
  technology: Cpu,
  travel: Plane,
  music: Music,
  art: Palette,
  arts: Palette,
  food: Utensils,
};

function getCategoryHue(category?: string): number {
  if (!category) return 271;
  return CATEGORY_HUE[category.toLowerCase()] ?? 271;
}

const pad = (n: number) => String(n).padStart(2, '0');

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getStatusLabel(event: AdminEventDetail, startIso: string): 'Cancelled' | 'Upcoming' | 'Past' {
  if (event.is_cancelled || event.status === 'cancelled') return 'Cancelled';
  return new Date(startIso).getTime() > Date.now() ? 'Upcoming' : 'Past';
}

function formatPrice(extra: EventExtra): string | null {
  const value = extra.cost ?? extra.price;
  if (extra.is_free) return 'Free';
  if (typeof value !== 'number') return null;
  if (value === 0) return 'Free';
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: extra.currency || 'EUR',
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `€${value}`;
  }
}

const AVATAR_HUES = [340, 160, 45, 280, 225, 200, 20];

function InitialsAvatar({
  src,
  name,
  seed,
  size = 38,
}: {
  src?: string;
  name: string;
  seed: string;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const key = String(seed || name || '?');
  const safeName = name || '?';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const hue = AVATAR_HUES[h % AVATAR_HUES.length];
  const initials =
    safeName
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgFailed(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `linear-gradient(135deg, hsl(${hue} 60% 48%), hsl(${hue} 62% 32%))`,
        border: `2px solid hsl(${hue} 60% 60% / .45)`,
      }}
    >
      {initials}
    </span>
  );
}

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--adm-grad-card)',
  borderColor: 'var(--adm-border)',
  boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
};

function Fact({
  icon: Icon,
  label,
  value,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0"
        style={{ color: danger ? 'var(--adm-danger)' : 'var(--adm-primary-text)' }}
      />
      <div className="min-w-0">
        <p className="text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
          {label}
        </p>
        <p
          className="text-xs font-normal"
          style={{ color: danger ? 'var(--adm-danger-text)' : 'var(--adm-fg)' }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function ParticipantRow({
  participant,
  isOrganizer,
  onNavigate,
}: {
  participant: ParticipantExtra;
  isOrganizer: boolean;
  onNavigate?: (userId: string) => void;
}) {
  const Wrapper = onNavigate ? 'button' : 'div';
  return (
    <Wrapper
      type={onNavigate ? 'button' : undefined}
      onClick={onNavigate ? () => onNavigate(participant.id) : undefined}
      aria-label={onNavigate ? `View user ${participant.full_name}` : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${
        onNavigate ? 'cursor-pointer transition-opacity hover:opacity-80' : ''
      }`}
      style={{ background: 'hsl(213 40% 18% / .55)' }}
    >
      <InitialsAvatar
        src={participant.avatar_url}
        seed={participant.id}
        name={participant.full_name}
        size={38}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--adm-fg)' }}>
            {participant.full_name}
          </p>
        </div>
        {participant.username && (
          <p className="truncate text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
            @{participant.username}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isOrganizer && (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: 'hsl(271 76% 53% / .22)',
              color: 'var(--adm-primary-text)',
            }}
          >
            Organizer
          </span>
        )}
        {onNavigate && (
          <ChevronRight className="h-4 w-4" style={{ color: 'var(--adm-muted-fg)' }} />
        )}
      </div>
    </Wrapper>
  );
}

function MapPlaceholder() {
  return (
    <div
      className="relative h-40 overflow-hidden rounded-xl border"
      style={{
        borderColor: 'var(--adm-border)',
        background: 'hsl(213 40% 17%)',
        backgroundImage:
          'linear-gradient(hsl(213 30% 26% / .5) 1px, transparent 1px), linear-gradient(90deg, hsl(213 30% 26% / .5) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 160"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polygon points="0,170 0,158 1000,40 1000,58 90,170" fill="hsl(213 25% 32% / .85)" />
        <polygon points="375,0 405,0 380,160 350,160" fill="hsl(213 25% 32% / .85)" />
      </svg>
      <MapPin
        className="absolute h-9 w-9"
        style={{
          left: '52%',
          top: '28%',
          transform: 'translateX(-50%)',
          color: 'hsl(330 85% 55%)',
        }}
        strokeWidth={2.5}
      />
      <span
        className="absolute bottom-2 right-3 text-[10px]"
        style={{ color: 'var(--adm-muted-fg)' }}
      >
        Map (placeholder)
      </span>
    </div>
  );
}

export default function AdminEventDetailPage({
  eventId,
  onBack,
  onNavigateToUser,
  onOpenChat,
  onErrorToast,
  onSuccessToast,
}: AdminEventDetailProps) {
  const [event, setEvent] = useState<AdminEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<AdminChatMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchAdminEventDetail(eventId)
      .then((data) => {
        if (!cancelled) {
          setEvent(data);
          setChatMessages(readChatMessages(data.chats ?? data.chat));
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
      const removal = await removeEvent(event.id);
      // Stay on the details: the event is marked as removed, not deleted.
      setEvent((prev) =>
        prev ? { ...prev, is_removed: true, removed_at: removal.removed_at, removed_by: removal.removed_by } : prev,
      );
      onSuccessToast('Event removed. It is marked as removed, not deleted.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove event.';
      onErrorToast(msg);
    } finally {
      setRemoving(false);
      setShowRemoveDialog(false);
    }
  };

  if (showChat && event) {
    return (
      <AdminEventChat
        eventId={eventId}
        eventTitle={event.title}
        messages={chatMessages}
        onMessageRemoved={(messageId, removal) =>
          setChatMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, is_removed: true, removed_at: removal.removed_at, removed_by: removal.removed_by }
                : m,
            ),
          )
        }
        onBack={() => setShowChat(false)}
        onErrorToast={onErrorToast}
        onSuccessToast={onSuccessToast}
      />
    );
  }

  const extra = (event ?? {}) as EventExtra;
  const org = extra.organizer;
  const participants = (event?.participants ?? []) as ParticipantExtra[];
  const organizerId = org?.id ?? event?.organizer_id ?? '';
  const organizerEntry = organizerId
    ? participants.find((p) => p.id === organizerId)
    : undefined;
  const organizerName =
    org?.display_name || org?.full_name || event?.organizer_name || organizerEntry?.full_name || 'Unknown organizer';
  const organizerUsername = org?.username ?? organizerEntry?.username;
  const organizerAvatar = org?.avatar_url ?? organizerEntry?.avatar_url;

  const startIso = extra.start_datetime || event?.date || '';
  const locationName = extra.location_name || event?.location || '';
  const capacity = extra.max_capacity ?? event?.participants_limit;
  const participantCount = extra.participant_count ?? participants.length;
  const priceLabel = event ? formatPrice(extra) : null;
  const status = event ? getStatusLabel(event, startIso) : null;
  const removed = readRemovedState(event);

  return (
    <>
      <div className="space-y-4">
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
            {removed.is_removed && (
              <div
                role="status"
                className="rounded-[14px] border px-4 py-3 text-xs space-y-0.5"
                style={{ borderColor: 'hsl(0 84% 60% / .45)', background: 'hsl(0 84% 60% / .1)', color: 'var(--adm-danger-text)' }}
              >
                <p className="flex items-center gap-2 font-semibold">
                  <Trash2 className="h-4 w-4 shrink-0" />
                  Removed by an administrator
                  {removed.removed_by ? ` (${personDisplayName(removed.removed_by)})` : ''}
                  {removed.removed_at ? ` on ${formatDateTime(removed.removed_at)}` : ''}.
                </p>
                <p style={{ color: 'var(--adm-muted-fg)' }}>
                  The event is marked as removed, not deleted. Users no longer see it.
                </p>
              </div>
            )}

            {/* ===== Main card: hero + details ===== */}
            {(() => {
              const H = getCategoryHue(event.category);
              const HeroIcon = CATEGORY_ICON[(event.category ?? '').toLowerCase()] ?? Calendar;
              const categoryLabel = event.category
                ? event.category.charAt(0).toUpperCase() + event.category.slice(1)
                : '';
              return (
                <div className="overflow-hidden rounded-[16px] border" style={CARD_STYLE}>
                  {/* Hero band */}
                  <div
                    className="relative h-[120px]"
                    style={{
                      background: `linear-gradient(135deg, hsl(${H} 70% 42%), hsl(${(H + 45) % 360} 70% 26%))`,
                    }}
                  >
                    <HeroIcon
                      className="pointer-events-none absolute right-8 top-1/2 h-24 w-24 -translate-y-1/2 text-white"
                      style={{ opacity: 0.3 }}
                      strokeWidth={1.4}
                    />
                  </div>

                  <div className="space-y-4 p-5">
                    {/* Title + category */}
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-[22px] font-bold leading-tight" style={{ color: 'var(--adm-fg)' }}>
                        {event.title}
                      </h2>
                      {categoryLabel && (
                        <span
                          className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold"
                          style={{
                            background: 'hsl(271 76% 53% / .22)',
                            color: 'var(--adm-primary-text)',
                          }}
                        >
                          {categoryLabel}
                        </span>
                      )}
                    </div>

                    {/* Organizer */}
                    {(() => {
                      const Wrapper = onNavigateToUser ? 'button' : 'div';
                      return (
                        <Wrapper
                          type={onNavigateToUser ? 'button' : undefined}
                          onClick={
                            onNavigateToUser && organizerId ? () => onNavigateToUser(organizerId) : undefined
                          }
                          aria-label={
                            onNavigateToUser ? `View organizer ${organizerName}` : undefined
                          }
                          className={`flex items-center gap-3 text-left ${
                            onNavigateToUser ? 'cursor-pointer transition-opacity hover:opacity-80' : ''
                          }`}
                        >
                          <InitialsAvatar
                            src={organizerAvatar}
                            seed={organizerId}
                            name={organizerName}
                            size={46}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold" style={{ color: 'var(--adm-fg)' }}>
                              {organizerName}
                            </p>
                            {organizerUsername && (
                              <p className="truncate text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
                                @{organizerUsername}
                              </p>
                            )}
                            <p className="text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
                              Organizer
                            </p>
                          </div>
                        </Wrapper>
                      );
                    })()}

                    {/* Description */}
                    {event.description && (
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--adm-fg)' }}>
                        {event.description}
                      </p>
                    )}

                    {/* Facts */}
                    <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                      <Fact icon={Clock} label="Date and time" value={formatDateTime(startIso)} />
                      {locationName && (
                        <Fact icon={MapPin} label="Location" value={locationName} />
                      )}
                      <Fact
                        icon={Users}
                        label="Participants"
                        value={
                          capacity
                            ? `${participantCount}/${capacity}`
                            : String(participantCount)
                        }
                      />
                      {priceLabel && <Fact icon={Euro} label="Price" value={priceLabel} />}
                      {status && <Fact icon={CheckCircle2} label="Status" value={status} />}
                      {typeof event.reports_count === 'number' && event.reports_count > 0 && (
                        <Fact
                          icon={AlertCircle}
                          label="Reports"
                          value={String(event.reports_count)}
                          danger
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ===== Moderation ===== */}
            <div className="rounded-[16px] border p-5 space-y-3" style={CARD_STYLE}>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" style={{ color: 'var(--adm-primary-text)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--adm-fg)' }}>
                  Moderation
                </h3>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowChat(true);
                    onOpenChat?.(event.id);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all active:scale-95"
                  style={{
                    background: 'var(--adm-secondary)',
                    borderColor: 'var(--adm-border)',
                    color: 'var(--adm-fg)',
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Open event chat
                </button>
                {!removed.is_removed && (
                  <button
                    type="button"
                    onClick={() => setShowRemoveDialog(true)}
                    className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all active:scale-95"
                    style={{
                      borderColor: 'hsl(0 84% 60% / .4)',
                      background: 'hsl(0 84% 60% / .1)',
                      color: 'var(--adm-danger-text)',
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove event
                  </button>
                )}
              </div>
            </div>

            {/* ===== Participants ===== */}
            <div className="rounded-[16px] border p-5 space-y-3" style={CARD_STYLE}>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: 'var(--adm-primary-text)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--adm-fg)' }}>
                  Participants
                </h3>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: 'var(--adm-secondary)', color: 'var(--adm-muted-fg)' }}
                >
                  {participantCount}
                </span>
              </div>
              {participants.length === 0 ? (
                <div
                  className="rounded-xl border border-dashed px-3 py-5 text-center text-xs"
                  style={{ borderColor: 'var(--adm-border)', color: 'var(--adm-muted-fg)' }}
                >
                  {participantCount > 0
                    ? 'Participant details are not included in this response.'
                    : 'No participants yet.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {participants.map((p) => (
                    <ParticipantRow
                      key={p.id}
                      participant={p}
                      isOrganizer={p.id === organizerId}
                      onNavigate={onNavigateToUser}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ===== Location ===== */}
            {locationName && (
              <div className="rounded-[16px] border p-5 space-y-3" style={CARD_STYLE}>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" style={{ color: 'var(--adm-primary-text)' }} />
                  <h3 className="text-sm font-bold" style={{ color: 'var(--adm-fg)' }}>
                    Location
                  </h3>
                </div>
                <MapPlaceholder />
                <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                  {locationName}
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Remove Event AlertDialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={(open) => !open && setShowRemoveDialog(false)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">Remove this event?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              &ldquo;{event?.title}&rdquo; is marked as removed, not deleted. Users no longer see it, and
              administrators still see it, marked as removed. The organizer is notified and receives a warning.
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
                'Remove event'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}