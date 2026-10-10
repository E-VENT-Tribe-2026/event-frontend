import { useEffect, useState, type ReactNode } from 'react';
import {
  ShieldCheck,
  ShieldPlus,
  ShieldOff,
  Calendar,
  Loader2,
  AlertCircle,
  ArrowLeft,
  AlertTriangle,
  Ban,
  ChevronRight,
  Users,
  Lock,
  Flag,
  MessageSquare,
  Undo2,
  User as UserIcon,
  Gamepad2,
  Trophy,
  Cpu,
  Plane,
  type LucideIcon,
} from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
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
  fetchAdminUserDetails,
  grantAdminRole,
  warnUser,
  withdrawWarning,
  suspendUser,
  liftSuspension,
  type AdminUserDetailsFull,
  type AdminEventSummary,
  type AdminUserWarning,
} from '@/lib/adminApi';

interface AdminUserDetailProps {
  userId: string;
  onBack: () => void;
  onOpenEvent?: (eventId: string) => void;
  onOpenUser?: (userId: string) => void;
  onErrorToast: (message: string) => void;
  onSuccessToast: (message: string) => void;
}

/* ---------- Optional fields the new layout can show (safe if the API omits them) ---------- */

type WarningExtra = AdminUserWarning & {
  issued_by_username?: string;
  event_id?: string;
  event_title?: string;
};

type PersonRef = {
  id: string;
  full_name?: string;
  name?: string;
  username?: string;
  avatar_url?: string;
};

type ReportRef = {
  id: string;
  title?: string;
  reason?: string;
  status?: string;
  created_at?: string;
};

type UserExtra = {
  friends?: PersonRef[];
  blocked_by_user?: PersonRef[];
  blocked_this_user?: PersonRef[];
  reports_about?: ReportRef[];
  reports_made?: ReportRef[];
};

/* ---------- Helpers ---------- */

const pad = (n: number) => String(n).padStart(2, '0');

function formatYmd(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatYmdHm(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return `${formatYmd(isoString)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

const CATEGORY_STYLE: Record<string, { icon: LucideIcon; hue: number }> = {
  gaming: { icon: Gamepad2, hue: 271 },
  sports: { icon: Trophy, hue: 155 },
  sport: { icon: Trophy, hue: 155 },
  tech: { icon: Cpu, hue: 210 },
  technology: { icon: Cpu, hue: 210 },
  travel: { icon: Plane, hue: 222 },
};

const CARD_STYLE = {
  background: 'var(--adm-grad-card)',
  borderColor: 'var(--adm-border)',
  boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
} as const;

/* ---------- Small building blocks ---------- */

function CountPill({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: 'var(--adm-secondary)', color: 'var(--adm-muted-fg)' }}
    >
      {value}
    </span>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  count,
  size = 'md',
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  size?: 'md' | 'sm';
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon
        className={size === 'md' ? 'h-4.5 w-4.5' : 'h-4 w-4'}
        style={{ color: 'var(--adm-primary-text)' }}
      />
      <h3
        className={size === 'md' ? 'text-sm font-bold' : 'text-xs font-semibold'}
        style={{ color: 'var(--adm-fg)' }}
      >
        {title}
      </h3>
      <CountPill value={count} />
    </div>
  );
}

function EmptyBox({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl border border-dashed px-3 py-5 text-center text-xs"
      style={{ borderColor: 'var(--adm-border)', color: 'var(--adm-muted-fg)' }}
    >
      {children}
    </div>
  );
}

type EventBucket = 'upcoming' | 'past' | 'cancelled';

const BUCKET_STYLE: Record<EventBucket, { label: string; style: React.CSSProperties }> = {
  upcoming: {
    label: 'Upcoming',
    style: {
      background: 'hsl(200 80% 50% / .15)',
      color: 'hsl(200 90% 68%)',
      borderColor: 'hsl(200 80% 50% / .35)',
    },
  },
  past: {
    label: 'Past',
    style: {
      background: 'var(--adm-secondary)',
      color: 'var(--adm-muted-fg)',
      borderColor: 'var(--adm-border)',
    },
  },
  cancelled: {
    label: 'Cancelled',
    style: {
      background: 'hsl(0 84% 60% / .15)',
      color: 'var(--adm-danger-text)',
      borderColor: 'hsl(0 84% 60% / .35)',
    },
  },
};

function EventColumn({
  icon,
  title,
  groups,
  emptyMessage,
  onClickEvent,
}: {
  icon: LucideIcon;
  title: string;
  groups?: { upcoming?: AdminEventSummary[]; past?: AdminEventSummary[]; cancelled?: AdminEventSummary[] };
  emptyMessage: string;
  onClickEvent?: (eventId: string) => void;
}) {
  const items: { event: AdminEventSummary; bucket: EventBucket }[] = [
    ...(groups?.upcoming ?? []).map((event) => ({ event, bucket: 'upcoming' as const })),
    ...(groups?.past ?? []).map((event) => ({ event, bucket: 'past' as const })),
    ...(groups?.cancelled ?? []).map((event) => ({ event, bucket: 'cancelled' as const })),
  ];

  return (
    <div className="rounded-[16px] border p-5 space-y-3" style={CARD_STYLE}>
      <SectionTitle icon={icon} title={title} count={items.length} />

      {items.length === 0 ? (
        <EmptyBox>{emptyMessage}</EmptyBox>
      ) : (
        <div className="space-y-2">
          {items.map(({ event, bucket }) => {
            const category = (event as AdminEventSummary & { category?: string }).category;
            const cat = CATEGORY_STYLE[(category ?? '').toLowerCase()];
            const Icon = cat?.icon ?? Calendar;
            const hue = cat?.hue ?? 271;
            const isCancelled = event.is_cancelled || event.status === 'cancelled';
            const pill = BUCKET_STYLE[isCancelled ? 'cancelled' : bucket];
            const Wrapper = onClickEvent ? 'button' : 'div';

            return (
              <Wrapper
                key={event.id}
                type={onClickEvent ? 'button' : undefined}
                onClick={onClickEvent ? () => onClickEvent(event.id) : undefined}
                aria-label={onClickEvent ? `View event ${event.title}` : undefined}
                className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left ${
                  onClickEvent ? 'cursor-pointer transition-opacity hover:opacity-80' : ''
                }`}
                style={{ background: 'hsl(213 40% 18% / .55)' }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white"
                  style={{
                    background: `linear-gradient(135deg, hsl(${hue} 65% 45%), hsl(${(hue + 40) % 360} 65% 30%))`,
                  }}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--adm-fg)' }}>
                    {event.title}
                  </p>
                  <p
                    className="mt-0.5 flex items-center gap-1 text-[11px]"
                    style={{ color: 'var(--adm-muted-fg)' }}
                  >
                    <Calendar className="h-3 w-3" />
                    {formatYmdHm(event.date)}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                  style={pill.style}
                >
                  {pill.label}
                </span>
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PersonColumn({
  icon,
  title,
  people,
  emptyMessage,
  onOpenUser,
}: {
  icon: LucideIcon;
  title: string;
  people?: PersonRef[];
  emptyMessage: string;
  onOpenUser?: (id: string) => void;
}) {
  const list = people ?? [];
  return (
    <div className="space-y-2 min-w-0">
      <SectionTitle icon={icon} title={title} count={list.length} size="sm" />
      {list.length === 0 ? (
        <EmptyBox>{emptyMessage}</EmptyBox>
      ) : (
        <div className="space-y-2">
          {list.map((p) => {
            const name = p.full_name || p.name || p.username || 'Unknown user';
            return (
              <button
                key={p.id}
                type="button"
                onClick={onOpenUser ? () => onOpenUser(p.id) : undefined}
                disabled={!onOpenUser}
                aria-label={`View details for ${name}`}
                className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-opacity hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100"
                style={{ background: 'hsl(213 40% 18% / .55)' }}
              >
                <UserAvatar
                  src={p.avatar_url}
                  srcSecondary={p.avatar_url}
                  seed={p.id}
                  name={name}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--adm-fg)' }}>
                    {name}
                  </p>
                  {p.username && (
                    <p className="truncate text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
                      @{p.username}
                    </p>
                  )}
                </div>
                {onOpenUser && (
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--adm-muted-fg)' }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportList({
  icon,
  title,
  reports,
  emptyMessage,
}: {
  icon: LucideIcon;
  title: string;
  reports?: ReportRef[];
  emptyMessage: string;
}) {
  const list = reports ?? [];
  return (
    <div className="space-y-2">
      <SectionTitle icon={icon} title={title} count={list.length} size="sm" />
      {list.length === 0 ? (
        <EmptyBox>{emptyMessage}</EmptyBox>
      ) : (
        <div className="space-y-2">
          {list.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl p-2.5"
              style={{ background: 'hsl(213 40% 18% / .55)' }}
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--adm-fg)' }}>
                  {r.title || r.reason || 'Report'}
                </p>
                {r.created_at && (
                  <p className="text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
                    {formatYmd(r.created_at)}
                  </p>
                )}
              </div>
              {r.status && (
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize"
                  style={{ background: 'var(--adm-secondary)', color: 'var(--adm-muted-fg)' }}
                >
                  {r.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type DialogKind = 'warn' | 'suspend' | 'lift' | 'makeAdmin' | null;

/* ---------- Page ---------- */

export default function AdminUserDetail({
  userId,
  onBack,
  onOpenEvent,
  onOpenUser,
  onErrorToast,
  onSuccessToast,
}: AdminUserDetailProps) {
  const [user, setUser] = useState<AdminUserDetailsFull | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [dialogKind, setDialogKind] = useState<DialogKind>(null);
  const [reason, setReason] = useState<string>('');
  const [acting, setActing] = useState<boolean>(false);
  const [hoveredBack, setHoveredBack] = useState(false);

  const [withdrawWarningId, setWithdrawWarningId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<boolean>(false);
  const [pendingWithdrawWarning, setPendingWithdrawWarning] = useState<AdminUserWarning | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    fetchAdminUserDetails(userId)
      .then((data) => {
        if (!cancelled) {
          setUser(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load user details');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const openDialog = (kind: DialogKind) => {
    setReason('');
    setDialogKind(kind);
  };

  const handleConfirm = async () => {
    if (!user || acting) return;
    setActing(true);
    try {
      if (dialogKind === 'warn') {
        const res = await warnUser(user.id, reason.trim());
        setUser((prev) =>
          prev
            ? {
                ...prev,
                warnings: [
                  ...prev.warnings,
                  {
                    id: res.warning_id,
                    reason: reason.trim(),
                    issued_at: new Date().toISOString(),
                    issued_by: 'You',
                  },
                ],
              }
            : null,
        );
        onSuccessToast(res.message || 'Warning issued.');
      } else if (dialogKind === 'suspend') {
        const res = await suspendUser(user.id, reason.trim());
        setUser((prev) => (prev ? { ...prev, is_suspended: true } : null));
        onSuccessToast(res.message || 'User suspended.');
      } else if (dialogKind === 'lift') {
        const res = await liftSuspension(user.id);
        setUser((prev) => (prev ? { ...prev, is_suspended: false, suspension: null } : null));
        onSuccessToast(res.message || 'Suspension lifted.');
      } else if (dialogKind === 'makeAdmin') {
        const res = await grantAdminRole(user.id);
        setUser((prev) => (prev ? { ...prev, is_admin: true, role: 'administrator' } : null));
        onSuccessToast(res.message || 'Administrator role granted.');
      }
      setDialogKind(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed.';
      onErrorToast(msg);
    } finally {
      setActing(false);
    }
  };

  const handleWithdrawWarning = async (warning: AdminUserWarning) => {
    if (!user || withdrawing) return;
    setWithdrawWarningId(warning.id);
    setWithdrawing(true);
    try {
      const res = await withdrawWarning(user.id, warning.id);
      setUser((prev) =>
        prev ? { ...prev, warnings: prev.warnings.filter((w) => w.id !== warning.id) } : null,
      );
      onSuccessToast(res.message || 'Warning withdrawn.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to withdraw warning.';
      onErrorToast(msg);
    } finally {
      setWithdrawing(false);
      setWithdrawWarningId(null);
    }
  };

  const isAdmin = Boolean(user?.is_admin || user?.role === 'administrator');
  const isSuspended = Boolean(user?.is_suspended);
  const needsReason = dialogKind === 'warn' || dialogKind === 'suspend';

  const extra = (user ?? {}) as UserExtra;
  const warnings = (user?.warnings ?? []) as WarningExtra[];
  const warningCount = warnings.length;
  const sortedWarnings = [...warnings].sort(
    (a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime(),
  );

  const dialogTitle: Record<NonNullable<DialogKind>, string> = {
    warn: 'Issue Warning',
    suspend: 'Suspend User',
    lift: 'Lift Suspension',
    makeAdmin: 'Grant Administrator Role?',
  };

  const dialogDescription: Record<NonNullable<DialogKind>, string> = {
    warn: `Provide a reason for warning ${user?.full_name ?? 'this user'}.`,
    suspend: `Provide a reason for suspending ${user?.full_name ?? 'this user'}.`,
    lift: `Lift the suspension on ${user?.full_name ?? 'this user'}. They will regain access immediately.`,
    makeAdmin: `Promote ${user?.full_name ?? 'this user'} to administrator? They will receive full administrative access.`,
  };

  const dialogAction: Record<NonNullable<DialogKind>, string> = {
    warn: 'Issue Warning',
    suspend: 'Suspend User',
    lift: 'Lift Suspension',
    makeAdmin: 'Grant Admin',
  };

  return (
    <>
      <div className="space-y-4">
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Users"
          className="inline-flex items-center gap-2 transition-colors"
          style={{
            background: 'transparent',
            border: 'none',
            color: hoveredBack ? 'var(--adm-fg)' : 'var(--adm-muted-fg)',
            fontWeight: 500,
            fontSize: 13,
            padding: '6px 8px 6px 0',
            cursor: 'pointer',
          }}
          onMouseEnter={() => setHoveredBack(true)}
          onMouseLeave={() => setHoveredBack(false)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </button>

        {loading ? (
          <div
            className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border"
            style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
          >
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--adm-primary)' }} />
            <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              Loading user details...
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
        ) : user ? (
          <>
            {/* ===== Identity card ===== */}
            <div className="rounded-[16px] border p-5" style={CARD_STYLE}>
              <div className="flex items-start gap-4">
                <UserAvatar
                  src={user.avatar_url}
                  srcSecondary={user.avatar_url}
                  seed={user.id}
                  name={user.full_name}
                  size="lg"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-bold" style={{ color: 'var(--adm-fg)' }}>
                      {user.full_name}
                    </h2>
                    {isAdmin ? (
                      <span
                        data-testid="admin-role-badge"
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{
                          background: 'hsl(271 76% 53% / .2)',
                          color: 'var(--adm-primary-text)',
                          borderColor: 'hsl(271 76% 53% / .4)',
                        }}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        Admin
                      </span>
                    ) : (
                      <span
                        data-testid="user-role-badge"
                        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{
                          background: 'var(--adm-secondary)',
                          color: 'hsl(213 20% 78%)',
                          borderColor: 'var(--adm-border)',
                        }}
                      >
                        User
                      </span>
                    )}
                  </div>

                  <p className="text-[13px]" style={{ color: 'var(--adm-muted-fg)' }}>
                    {user.username ? (
                      `@${user.username}`
                    ) : (
                      <span className="italic">No username chosen</span>
                    )}
                  </p>

                  <div
                    className="flex items-center gap-1.5 text-[13px]"
                    style={{ color: 'var(--adm-muted-fg)' }}
                  >
                    <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--adm-primary-text)' }} />
                    <span>Member since {formatYmd(user.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="my-4 border-t" style={{ borderColor: 'var(--adm-border)' }} />

              {/* Status row */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--adm-muted-fg)' }}>Account status</span>
                  {isSuspended ? (
                    <span
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: 'hsl(0 84% 60% / .15)',
                        color: 'var(--adm-danger-text)',
                        borderColor: 'hsl(0 84% 60% / .35)',
                      }}
                    >
                      Suspended
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: 'hsl(152 60% 42% / .15)',
                        color: 'var(--adm-ok-text)',
                        borderColor: 'hsl(152 60% 42% / .35)',
                      }}
                    >
                      Active
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--adm-muted-fg)' }}>Warnings</span>
                  {warningCount > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: 'hsl(38 92% 52% / .15)',
                        color: 'var(--adm-warn-text)',
                        borderColor: 'hsl(38 92% 52% / .4)',
                      }}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: 'var(--adm-secondary)',
                        color: 'var(--adm-muted-fg)',
                        borderColor: 'var(--adm-border)',
                      }}
                    >
                      None
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                {!isAdmin && (
                  <button
                    type="button"
                    onClick={() => openDialog('makeAdmin')}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-95"
                    style={{ background: 'var(--adm-grad)', boxShadow: 'var(--adm-shadow-glow)' }}
                  >
                    <ShieldPlus className="h-3.5 w-3.5" />
                    Make admin
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openDialog('warn')}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95"
                  style={{
                    borderColor: 'hsl(38 92% 52% / .4)',
                    background: 'hsl(38 92% 52% / .1)',
                    color: 'var(--adm-warn-text)',
                  }}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Warn
                </button>

                {isSuspended ? (
                  <button
                    type="button"
                    onClick={() => openDialog('lift')}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95"
                    style={{
                      borderColor: 'hsl(152 60% 42% / .4)',
                      background: 'hsl(152 60% 42% / .1)',
                      color: 'var(--adm-ok-text)',
                    }}
                  >
                    <ShieldOff className="h-3.5 w-3.5" />
                    Lift suspension
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openDialog('suspend')}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95"
                    style={{
                      borderColor: 'hsl(0 84% 60% / .4)',
                      background: 'hsl(0 84% 60% / .1)',
                      color: 'var(--adm-danger-text)',
                    }}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Suspend
                  </button>
                )}
              </div>

              {/* Warning banner */}
              {warningCount > 0 && !isSuspended && (
                <div
                  className="mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px]"
                  style={{
                    background: 'hsl(38 92% 52% / .08)',
                    borderColor: 'hsl(38 92% 52% / .3)',
                    color: 'var(--adm-fg)',
                  }}
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: 'var(--adm-warn-text)' }}
                  />
                  <p>
                    <strong>
                      This account has {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
                    </strong>{' '}
                    and is not suspended automatically. Suspending is the administrator&apos;s decision,
                    using the Suspend button.
                  </p>
                </div>
              )}
            </div>

            {/* ===== Organizes / Joined ===== */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <EventColumn
                icon={Calendar}
                title="Organizes"
                groups={user.organized_events}
                emptyMessage="This user does not organize any events."
                onClickEvent={onOpenEvent}
              />
              <EventColumn
                icon={Users}
                title="Joined"
                groups={user.joined_events}
                emptyMessage="This user has not joined any events."
                onClickEvent={onOpenEvent}
              />
            </div>

            {/* ===== Friends and blocks ===== */}
            <div className="rounded-[16px] border p-5 space-y-4" style={CARD_STYLE}>
              <div className="flex items-center gap-2">
                <Users className="h-4.5 w-4.5" style={{ color: 'var(--adm-primary-text)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--adm-fg)' }}>
                  Friends and blocks
                </h3>
              </div>
              <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                Visible only to administrators, also when the profile is set to friends only.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <PersonColumn
                  icon={Users}
                  title="Friends"
                  people={extra.friends}
                  emptyMessage="No friends yet."
                  onOpenUser={onOpenUser}
                />
                <PersonColumn
                  icon={Ban}
                  title="Blocked by this user"
                  people={extra.blocked_by_user}
                  emptyMessage="Has not blocked anyone."
                  onOpenUser={onOpenUser}
                />
                <PersonColumn
                  icon={Lock}
                  title="Blocked this user"
                  people={extra.blocked_this_user}
                  emptyMessage="Nobody has blocked this user."
                  onOpenUser={onOpenUser}
                />
              </div>
            </div>

            {/* ===== Warning history ===== */}
            <div className="rounded-[16px] border p-5 space-y-3" style={CARD_STYLE}>
              <SectionTitle icon={AlertTriangle} title="Warning history" count={warningCount} />
              <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                Newest first. Warnings do not expire. A warning given by mistake can be withdrawn.
              </p>

              {sortedWarnings.length === 0 ? (
                <EmptyBox>No warnings issued.</EmptyBox>
              ) : (
                <div className="space-y-2.5">
                  {sortedWarnings.map((w) => {
                    const issuer = w.issued_by || 'Unknown';
                    const hue = hueOf(issuer);
                    const isWithdrawingThis = withdrawing && withdrawWarningId === w.id;
                    return (
                      <div
                        key={w.id}
                        className="space-y-2.5"
                        style={{
                          background: 'hsl(213 40% 20% / .45)',
                          border: '1px solid var(--adm-border)',
                          borderLeft: '3px solid var(--adm-warn)',
                          borderRadius: 12,
                          padding: '12px 14px',
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                            <span
                              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                              style={{
                                background: 'hsl(38 92% 52% / .15)',
                                color: 'var(--adm-warn-text)',
                                borderColor: 'hsl(38 92% 52% / .4)',
                              }}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Warning
                            </span>
                            <span style={{ color: 'var(--adm-muted-fg)' }}>
                              Issued {formatYmd(w.issued_at)} by
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white"
                                style={{ background: `hsl(${hue} 55% 42%)` }}
                              >
                                {initialsOf(issuer)}
                              </span>
                              <span className="font-semibold" style={{ color: 'var(--adm-fg)' }}>
                                {issuer}
                              </span>
                              {w.issued_by_username && (
                                <span style={{ color: 'var(--adm-muted-fg)' }}>
                                  @{w.issued_by_username}
                                </span>
                              )}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={isWithdrawingThis}
                            onClick={() => setPendingWithdrawWarning(w)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50"
                            style={{
                              background: 'var(--adm-card)',
                              borderColor: 'var(--adm-border)',
                              color: 'var(--adm-fg)',
                            }}
                          >
                            {isWithdrawingThis ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Undo2 className="h-3.5 w-3.5" />
                            )}
                            Withdraw
                          </button>
                        </div>

                        <p className="text-[13px]" style={{ color: 'var(--adm-fg)' }}>
                          {w.reason}
                        </p>

                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-medium uppercase tracking-wider"
                            style={{ color: 'var(--adm-muted-fg)' }}
                          >
                            About
                          </span>
                          {w.event_title ? (
                            <button
                              type="button"
                              disabled={!onOpenEvent || !w.event_id}
                              onClick={() => w.event_id && onOpenEvent?.(w.event_id)}
                              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs disabled:cursor-default"
                              style={{
                                background: 'var(--adm-secondary)',
                                borderColor: 'var(--adm-border)',
                                color: 'var(--adm-fg)',
                              }}
                            >
                              <Calendar className="h-3 w-3" style={{ color: 'var(--adm-primary-text)' }} />
                              Event: {w.event_title}
                            </button>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs"
                              style={{ borderColor: 'var(--adm-border)', color: 'var(--adm-muted-fg)' }}
                            >
                              <UserIcon className="h-3 w-3" style={{ color: 'var(--adm-primary-text)' }} />
                              Given directly from the user&apos;s details
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ===== Report history ===== */}
            <div className="rounded-[16px] border p-5 space-y-4" style={CARD_STYLE}>
              <SectionTitle
                icon={Flag}
                title="Report history"
                count={(extra.reports_about?.length ?? 0) + (extra.reports_made?.length ?? 0)}
              />
              <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                Newest first. Reports about events this user organizes count as reports about them.
              </p>

              <ReportList
                icon={AlertTriangle}
                title="Reports about this user"
                reports={extra.reports_about}
                emptyMessage="No reports about this user."
              />

              <div className="border-t" style={{ borderColor: 'var(--adm-border)' }} />

              <ReportList
                icon={MessageSquare}
                title="Reports made by this user"
                reports={extra.reports_made}
                emptyMessage="This user has not reported anything."
              />
            </div>
          </>
        ) : null}
      </div>

      {/* Action AlertDialog */}
      <AlertDialog open={dialogKind !== null} onOpenChange={(open) => !open && setDialogKind(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              {dialogKind ? dialogTitle[dialogKind] : ''}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              {dialogKind ? dialogDescription[dialogKind] : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {needsReason && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason..."
              aria-label="Reason"
              rows={3}
              className="w-full rounded-xl border px-3 py-2.5 text-xs outline-none resize-none placeholder:opacity-60"
              style={{
                borderColor: 'var(--adm-border)',
                background: 'var(--adm-secondary)',
                color: 'var(--adm-fg)',
              }}
            />
          )}

          <AlertDialogFooter className="flex-row gap-2 justify-end">
            <AlertDialogCancel disabled={acting} className="rounded-lg text-xs mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={acting || (needsReason && !reason.trim())}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              className="rounded-lg text-xs font-semibold text-white"
              style={{ background: 'var(--adm-grad)' }}
            >
              {acting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Working...
                </>
              ) : dialogKind ? (
                dialogAction[dialogKind]
              ) : (
                'Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Withdraw warning confirmation */}
      <AlertDialog
        open={pendingWithdrawWarning !== null}
        onOpenChange={(open) => !open && setPendingWithdrawWarning(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">Withdraw Warning</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to withdraw this warning? This action cannot be undone.
              {pendingWithdrawWarning && (
                <span
                  className="mt-1.5 block rounded-lg px-3 py-2 text-xs"
                  style={{ background: 'var(--adm-secondary)', color: 'var(--adm-fg)' }}
                >
                  &ldquo;{pendingWithdrawWarning.reason}&rdquo;
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 justify-end">
            <AlertDialogCancel disabled={withdrawing} className="rounded-lg text-xs mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={withdrawing}
              onClick={(e) => {
                e.preventDefault();
                if (pendingWithdrawWarning) {
                  const w = pendingWithdrawWarning;
                  setPendingWithdrawWarning(null);
                  void handleWithdrawWarning(w);
                }
              }}
              className="rounded-lg text-xs font-semibold text-white"
              style={{ background: 'var(--adm-grad)' }}
            >
              {withdrawing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Withdrawing...
                </>
              ) : (
                'Withdraw Warning'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}