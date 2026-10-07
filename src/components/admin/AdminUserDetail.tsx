import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Calendar,
  UserCheck,
  Loader2,
  AlertCircle,
  ArrowLeft,
  AlertTriangle,
  Ban,
  ShieldOff,
  ChevronRight,
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
  onErrorToast: (message: string) => void;
  onSuccessToast: (message: string) => void;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function formatEventDateTime(isoString: string): string {
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

function EventSubList({
  title,
  events,
  emptyMessage,
  onClickEvent,
}: {
  title: string;
  events?: AdminEventSummary[];
  emptyMessage: string;
  onClickEvent?: (eventId: string) => void;
}) {
  const items = events || [];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <span>{title}</span>
        <span className="text-[11px] font-normal">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 italic py-1">{emptyMessage}</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {items.map((event) => {
            const isCancelled = event.is_cancelled || event.status === 'cancelled';
            const Wrapper = onClickEvent ? 'button' : 'div';
            return (
              <Wrapper
                key={event.id}
                type={onClickEvent ? 'button' : undefined}
                onClick={onClickEvent ? () => onClickEvent(event.id) : undefined}
                aria-label={onClickEvent ? `View event ${event.title}` : undefined}
                className={`w-full flex items-center justify-between rounded-lg bg-secondary/50 p-2 text-xs border border-border/40 text-left ${onClickEvent ? 'hover:bg-secondary/80 hover:border-primary/30 transition-colors cursor-pointer group' : ''}`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-medium text-foreground truncate">{event.title}</p>
                  <p className="text-[11px] text-muted-foreground">{formatEventDateTime(event.date)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isCancelled ? (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                      Cancelled
                    </span>
                  ) : (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">
                      {event.status || 'Active'}
                    </span>
                  )}
                  {onClickEvent && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  )}
                </div>
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}

type DialogKind = 'warn' | 'suspend' | 'lift' | 'makeAdmin' | null;

export default function AdminUserDetail({
  userId,
  onBack,
  onOpenEvent,
  onErrorToast,
  onSuccessToast,
}: AdminUserDetailProps) {
  const [user, setUser] = useState<AdminUserDetailsFull | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Dialog state
  const [dialogKind, setDialogKind] = useState<DialogKind>(null);
  const [reason, setReason] = useState<string>('');
  const [acting, setActing] = useState<boolean>(false);

  // Withdraw warning
  const [withdrawWarningId, setWithdrawWarningId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<boolean>(false);

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
        setUser((prev) =>
          prev ? { ...prev, is_admin: true, role: 'administrator' } : null,
        );
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
      <div className="space-y-5">
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border border-border/50 bg-card">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading user details...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center space-y-2">
            <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
            <p className="text-xs text-destructive font-medium">{error}</p>
          </div>
        ) : user ? (
          <>
            {/* Identity block */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <UserAvatar
                  src={user.avatar_url}
                  srcSecondary={user.avatar_url}
                  seed={user.id}
                  name={user.full_name}
                  size="lg"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-foreground truncate">{user.full_name}</h2>
                    {isAdmin ? (
                      <span
                        data-testid="admin-role-badge"
                        className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/30"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Admin
                      </span>
                    ) : (
                      <span
                        data-testid="user-role-badge"
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground border border-border"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        User
                      </span>
                    )}
                    {isSuspended && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-400 border border-red-500/30">
                        <Ban className="h-3.5 w-3.5" />
                        Suspended
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {user.username ? `@${user.username}` : <span className="italic">No username chosen</span>}
                  </p>

                  {user.email && (
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Member since {formatDate(user.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openDialog('warn')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary/70 active:scale-95 transition-all"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-warn-text" />
                  Warn
                </button>

                {isSuspended ? (
                  <button
                    type="button"
                    onClick={() => openDialog('lift')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary/70 active:scale-95 transition-all"
                  >
                    <ShieldOff className="h-3.5 w-3.5 text-ok-text" />
                    Lift Suspension
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openDialog('suspend')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 active:scale-95 transition-all"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Suspend
                  </button>
                )}

                {!isAdmin && (
                  <button
                    type="button"
                    onClick={() => openDialog('makeAdmin')}
                    className="inline-flex items-center gap-1.5 rounded-lg gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow hover:opacity-90 active:scale-95 transition-all"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Make Admin
                  </button>
                )}
              </div>
            </div>

            {/* Organized Events */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-foreground">Organized Events</h3>
              <EventSubList
                title="Upcoming"
                events={user.organized_events?.upcoming}
                emptyMessage="No upcoming organized events."
                onClickEvent={onOpenEvent}
              />
              <EventSubList
                title="Past"
                events={user.organized_events?.past}
                emptyMessage="No past organized events."
                onClickEvent={onOpenEvent}
              />
              <EventSubList
                title="Cancelled"
                events={user.organized_events?.cancelled}
                emptyMessage="No cancelled organized events."
                onClickEvent={onOpenEvent}
              />
            </div>

            {/* Joined Events */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-foreground">Joined Events</h3>
              <EventSubList
                title="Upcoming"
                events={user.joined_events?.upcoming}
                emptyMessage="No upcoming joined events."
                onClickEvent={onOpenEvent}
              />
              <EventSubList
                title="Past"
                events={user.joined_events?.past}
                emptyMessage="No past joined events."
                onClickEvent={onOpenEvent}
              />
              <EventSubList
                title="Cancelled"
                events={user.joined_events?.cancelled}
                emptyMessage="No cancelled joined events."
                onClickEvent={onOpenEvent}
              />
            </div>

            {/* Warning History */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                Warning History
                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {user.warnings?.length ?? 0}
                </span>
              </h3>
              {!user.warnings || user.warnings.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 italic">No warnings issued.</p>
              ) : (
                <div className="space-y-2">
                  {user.warnings.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-secondary/40 p-3"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs font-medium text-foreground">{w.reason}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDate(w.issued_at)} {w.issued_by ? `· by ${w.issued_by}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={withdrawing && withdrawWarningId === w.id}
                        onClick={() => void handleWithdrawWarning(w)}
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/70 disabled:opacity-50 transition-all"
                      >
                        {withdrawing && withdrawWarningId === w.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : null}
                        Withdraw
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/50 resize-none placeholder:text-muted-foreground/60"
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
              className="rounded-lg gradient-primary text-xs font-semibold text-white"
            >
              {acting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Working...
                </>
              ) : (
                dialogKind ? dialogAction[dialogKind] : 'Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Withdraw warning confirmation */}
      <AlertDialog
        open={withdrawWarningId !== null && !withdrawing}
        onOpenChange={(open) => !open && setWithdrawWarningId(null)}
      >
        {/* Intentionally empty – withdraw runs immediately on button click, no extra dialog needed */}
      </AlertDialog>
    </>
  );
}
