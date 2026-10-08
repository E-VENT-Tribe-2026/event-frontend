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
      <div
        className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--adm-muted-fg)' }}
      >
        <span>{title}</span>
        <span className="text-[11px] font-normal">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs italic py-1" style={{ color: 'var(--adm-muted-fg)', opacity: 0.7 }}>
          {emptyMessage}
        </p>
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
                className={`w-full flex items-center justify-between rounded-lg p-2 text-xs border text-left ${onClickEvent ? 'hover:opacity-80 transition-all cursor-pointer group' : ''}`}
                style={{
                  background: 'hsl(213 40% 18% / .5)',
                  borderColor: 'var(--adm-border)',
                }}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-medium truncate" style={{ color: 'var(--adm-fg)' }}>
                    {event.title}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
                    {formatEventDateTime(event.date)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isCancelled ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: 'hsl(0 84% 60% / .15)',
                        color: 'var(--adm-danger-text)',
                      }}
                    >
                      Cancelled
                    </span>
                  ) : (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                      style={{
                        background: 'hsl(271 76% 53% / .15)',
                        color: 'var(--adm-primary-text)',
                      }}
                    >
                      {event.status || 'Active'}
                    </span>
                  )}
                  {onClickEvent && (
                    <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--adm-muted-fg)' }} />
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

  const [dialogKind, setDialogKind] = useState<DialogKind>(null);
  const [reason, setReason] = useState<string>('');
  const [acting, setActing] = useState<boolean>(false);

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
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
          style={{ color: 'var(--adm-muted-fg)' }}
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
            {/* Identity block */}
            <div
              className="rounded-[16px] border p-5"
              style={{
                background: 'var(--adm-grad-card)',
                borderColor: 'var(--adm-border)',
                boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
              }}
            >
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
                    <h2 className="text-base font-bold truncate" style={{ color: 'var(--adm-fg)' }}>
                      {user.full_name}
                    </h2>
                    {isAdmin ? (
                      <span
                        data-testid="admin-role-badge"
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          background: 'hsl(271 76% 53% / .2)',
                          color: 'var(--adm-primary-text)',
                          borderColor: 'hsl(271 76% 53% / .4)',
                        }}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Admin
                      </span>
                    ) : (
                      <span
                        data-testid="user-role-badge"
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          background: 'var(--adm-secondary)',
                          color: 'hsl(213 20% 78%)',
                          borderColor: 'var(--adm-border)',
                        }}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        User
                      </span>
                    )}
                    {isSuspended && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          background: 'hsl(0 84% 60% / .15)',
                          color: 'var(--adm-danger-text)',
                          borderColor: 'hsl(0 84% 60% / .35)',
                        }}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Suspended
                      </span>
                    )}
                  </div>

                  <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                    {user.username ? (
                      `@${user.username}`
                    ) : (
                      <span className="italic">No username chosen</span>
                    )}
                  </p>

                  {user.email && (
                    <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                      {user.email}
                    </p>
                  )}

                  <div
                    className="flex items-center gap-1.5 text-xs pt-0.5"
                    style={{ color: 'var(--adm-muted-fg)' }}
                  >
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
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold active:scale-95 transition-all"
                  style={{
                    borderColor: 'hsl(38 92% 52% / .4)',
                    background: 'hsl(38 92% 52% / .12)',
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
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold active:scale-95 transition-all"
                    style={{
                      borderColor: 'hsl(152 60% 42% / .4)',
                      background: 'hsl(152 60% 42% / .12)',
                      color: 'var(--adm-ok-text)',
                    }}
                  >
                    <ShieldOff className="h-3.5 w-3.5" />
                    Lift Suspension
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openDialog('suspend')}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold active:scale-95 transition-all"
                    style={{
                      borderColor: 'hsl(0 84% 60% / .4)',
                      background: 'hsl(0 84% 60% / .12)',
                      color: 'var(--adm-danger-text)',
                    }}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Suspend
                  </button>
                )}

                {!isAdmin && (
                  <button
                    type="button"
                    onClick={() => openDialog('makeAdmin')}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold active:scale-95 transition-all"
                    style={{
                      background: 'var(--adm-grad)',
                      boxShadow: 'var(--adm-shadow-glow)',
                      color: 'white',
                    }}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Make Admin
                  </button>
                )}
              </div>
            </div>

            {/* Organized Events */}
            <div
              className="rounded-[16px] border p-5 space-y-4"
              style={{
                background: 'var(--adm-grad-card)',
                borderColor: 'var(--adm-border)',
                boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
              }}
            >
              <h3 className="text-sm font-bold" style={{ color: 'var(--adm-fg)' }}>
                Organized Events
              </h3>
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
            <div
              className="rounded-[16px] border p-5 space-y-4"
              style={{
                background: 'var(--adm-grad-card)',
                borderColor: 'var(--adm-border)',
                boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
              }}
            >
              <h3 className="text-sm font-bold" style={{ color: 'var(--adm-fg)' }}>
                Joined Events
              </h3>
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
            <div
              className="rounded-[16px] border p-5 space-y-3"
              style={{
                background: 'var(--adm-grad-card)',
                borderColor: 'var(--adm-border)',
                boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
              }}
            >
              <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--adm-fg)' }}>
                Warning History
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: 'var(--adm-secondary)', color: 'var(--adm-muted-fg)' }}
                >
                  {user.warnings?.length ?? 0}
                </span>
              </h3>
              {!user.warnings || user.warnings.length === 0 ? (
                <p className="text-xs italic" style={{ color: 'var(--adm-muted-fg)', opacity: 0.7 }}>
                  No warnings issued.
                </p>
              ) : (
                <div className="space-y-2">
                  {user.warnings.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-start justify-between gap-3 rounded-xl p-3"
                      style={{
                        background: 'hsl(213 40% 20% / .45)',
                        border: '1px solid var(--adm-border)',
                        borderLeft: '3px solid var(--adm-warn)',
                      }}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs font-medium" style={{ color: 'var(--adm-fg)' }}>
                          {w.reason}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
                          {formatDate(w.issued_at)}{w.issued_by ? ` · by ${w.issued_by}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={withdrawing && withdrawWarningId === w.id}
                        onClick={() => setPendingWithdrawWarning(w)}
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50 transition-all"
                        style={{
                          background: 'var(--adm-secondary)',
                          borderColor: 'var(--adm-border)',
                          color: 'var(--adm-muted-fg)',
                        }}
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
              ) : (
                dialogKind ? dialogAction[dialogKind] : 'Confirm'
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
