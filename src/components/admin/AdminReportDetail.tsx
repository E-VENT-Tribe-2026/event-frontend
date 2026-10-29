import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  XCircle,
  AlertTriangle,
  Ban,
  Trash2,
  CheckCircle2,
  Calendar,
  User as UserIcon,
  MessageSquare,
  Info,
  ExternalLink,
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
  fetchAdminReportDetail,
  dismissReport,
  actOnReport,
  formatReportTime,
  personDisplayName,
  reportedItemLabel,
  reportOriginLabel,
  reportOutcomeLabel,
  reportReasonLabel,
  type AdminEventPerson,
  type AdminReportDetail as AdminReportDetailData,
} from '@/lib/adminApi';
import { ReportStatusPill } from '@/components/admin/AdminReportsTab';

interface AdminReportDetailProps {
  reportId: string;
  onBack: () => void;
  onOpenEvent?: (eventId: string) => void;
  onOpenUser?: (userId: string) => void;
  /** Called after the report was closed here, so the open count and lists refresh. */
  onReportClosed?: () => void;
  onErrorToast: (message: string) => void;
  onSuccessToast: (message: string) => void;
}

type ActionKind = 'dismiss' | 'warn' | 'remove' | 'suspend';

const CARD_STYLE: React.CSSProperties = { background: 'var(--adm-grad-card)', borderColor: 'var(--adm-border)' };
const LABEL_CLASS = 'text-[11px] uppercase tracking-wider font-medium mb-0.5';

const ACTION_BUTTONS: Record<ActionKind, { label: string; icon: React.ReactNode; style: React.CSSProperties }> = {
  dismiss: {
    label: 'Dismiss',
    icon: <XCircle className="h-3.5 w-3.5" />,
    style: { borderColor: 'var(--adm-border)', background: 'var(--adm-secondary)', color: 'var(--adm-fg)' },
  },
  warn: {
    label: 'Warn the user',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    style: { borderColor: 'hsl(38 92% 52% / .35)', background: 'hsl(38 92% 52% / .12)', color: 'var(--adm-warn-text)' },
  },
  remove: {
    label: 'Remove the reported content',
    icon: <Trash2 className="h-3.5 w-3.5" />,
    style: { borderColor: 'hsl(330 100% 59% / .35)', background: 'hsl(330 100% 59% / .12)', color: 'hsl(330 100% 78%)' },
  },
  suspend: {
    label: 'Suspend the user',
    icon: <Ban className="h-3.5 w-3.5" />,
    style: { borderColor: 'hsl(0 84% 60% / .35)', background: 'hsl(0 84% 60% / .12)', color: 'var(--adm-danger-text)' },
  },
};

function name(person: AdminEventPerson | null, fallback = 'Unknown user'): string {
  return (person && personDisplayName(person)) || fallback;
}

function OpenButton({ label, onClick, icon }: { label: string; onClick?: () => void; icon: React.ReactNode }) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95"
      style={{ borderColor: 'var(--adm-border)', background: 'var(--adm-secondary)', color: 'var(--adm-fg)' }}
    >
      {icon}
      {label}
      <ExternalLink className="h-3 w-3 opacity-60" />
    </button>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--adm-muted-fg)' }}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export default function AdminReportDetail({
  reportId,
  onBack,
  onOpenEvent,
  onOpenUser,
  onReportClosed,
  onErrorToast,
  onSuccessToast,
}: AdminReportDetailProps) {
  const [report, setReport] = useState<AdminReportDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeAction, setActiveAction] = useState<ActionKind | null>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchAdminReportDetail(reportId)
      .then((data) => {
        if (!cancelled) {
          setReport(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load report');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const needsReason = activeAction === 'warn' || activeAction === 'suspend';

  const handleConfirm = async () => {
    if (!report || acting || !activeAction) return;
    if (needsReason && !reason.trim()) return;
    setActing(true);
    try {
      const updated =
        activeAction === 'dismiss'
          ? await dismissReport(report.id)
          : await actOnReport(report.id, activeAction, needsReason ? reason.trim() : undefined);
      setReport(updated);
      setActiveAction(null);
      onSuccessToast(activeAction === 'dismiss' ? 'Report dismissed.' : 'Action taken. The report is closed.');
      onReportClosed?.();
    } catch (err) {
      onErrorToast(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActing(false);
    }
  };

  const openAction = (kind: ActionKind) => {
    setReason('');
    setActiveAction(kind);
  };

  // What the actions apply to, and why some are not offered.
  const targetName = report ? name(report.target_user) : '';
  const isEventReport = report?.target_type === 'event';
  const removeBlocked = report
    ? report.target_type === 'user'
      ? 'There is no content to remove: this report is about a user and was made from their profile.'
      : report.content_removed
        ? `The reported ${report.target_type === 'event' ? 'event' : 'message'} is already removed.`
        : null
    : null;
  const userActionsBlocked = report
    ? !report.target_user
      ? 'The user this report applies to no longer exists, so they cannot be warned or suspended.'
      : report.target_user_is_admin
        ? `${targetName} is now an administrator, so they cannot be warned or suspended.`
        : null
    : null;

  const dialogText: Record<ActionKind, { title: string; body: string; confirm: string }> = {
    dismiss: {
      title: 'Dismiss this report?',
      body: 'The report is closed without any action.',
      confirm: 'Dismiss',
    },
    warn: {
      title: `Warn ${targetName}?`,
      body: isEventReport
        ? `The event's organizer, ${targetName}, receives a warning. The report is then closed.`
        : `${targetName} receives a warning. The report is then closed.`,
      confirm: 'Warn',
    },
    remove: {
      title: isEventReport ? 'Remove the event?' : 'Remove the message?',
      body: isEventReport
        ? 'The event is marked as removed, not deleted. Users no longer see it. The report is then closed.'
        : 'The message is marked as removed, not deleted. The chat shows it as removed. The report is then closed.',
      confirm: 'Remove',
    },
    suspend: {
      title: `Suspend ${targetName}?`,
      body: isEventReport
        ? `The event's organizer, ${targetName}, is suspended and loses access to the app. The report is then closed.`
        : `${targetName} is suspended and loses access to the app. The report is then closed.`,
      confirm: 'Suspend',
    },
  };

  return (
    <>
      <div className="space-y-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="inline-flex items-center gap-2 text-[13px] font-medium transition-colors text-[var(--adm-muted-fg)] hover:text-[var(--adm-fg)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {loading ? (
          <div
            className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border"
            style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
          >
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--adm-primary)' }} />
            <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
              Loading report...
            </p>
          </div>
        ) : error ? (
          <div
            className="rounded-xl border p-6 text-center space-y-2"
            style={{ borderColor: 'hsl(0 84% 60% / .3)', background: 'hsl(0 84% 60% / .07)' }}
            role="alert"
          >
            <AlertCircle className="mx-auto h-6 w-6" style={{ color: 'var(--adm-danger)' }} />
            <p className="text-xs font-medium" style={{ color: 'var(--adm-danger-text)' }}>
              {error}
            </p>
          </div>
        ) : report ? (
          <>
            {/* ===== Summary ===== */}
            <div className="rounded-[16px] border p-5 space-y-4" style={CARD_STYLE}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--adm-muted-fg)' }}>
                    {report.target_type === 'event' ? 'Event' : report.target_type === 'user' ? 'User' : 'Chat message'} report
                  </p>
                  <h2 className="text-base font-bold leading-tight" style={{ color: 'var(--adm-fg)' }}>
                    {reportedItemLabel(report)}
                  </h2>
                </div>
                <ReportStatusPill status={report.status} />
              </div>

              <dl className="grid grid-cols-1 gap-y-3 gap-x-6 sm:grid-cols-2 text-xs">
                <div>
                  <dt className={LABEL_CLASS} style={{ color: 'var(--adm-muted-fg)' }}>Reporter</dt>
                  <dd className="flex flex-wrap items-center gap-2 font-semibold" style={{ color: 'var(--adm-fg)' }}>
                    {name(report.reporter, 'Deleted user')}
                    {report.reporter?.username && (
                      <span className="font-normal" style={{ color: 'var(--adm-muted-fg)' }}>@{report.reporter.username}</span>
                    )}
                    {report.reporter?.id && (
                      <OpenButton
                        label="Open user"
                        icon={<UserIcon className="h-3 w-3" />}
                        onClick={onOpenUser ? () => onOpenUser(report.reporter!.id) : undefined}
                      />
                    )}
                  </dd>
                </div>
                <div>
                  <dt className={LABEL_CLASS} style={{ color: 'var(--adm-muted-fg)' }}>Reason</dt>
                  <dd className="font-semibold" style={{ color: 'var(--adm-fg)' }}>{reportReasonLabel(report.reason)}</dd>
                </div>
                <div>
                  <dt className={LABEL_CLASS} style={{ color: 'var(--adm-muted-fg)' }}>Time</dt>
                  <dd className="font-semibold" style={{ color: 'var(--adm-fg)' }}>{formatReportTime(report.created_at)}</dd>
                </div>
                <div>
                  <dt className={LABEL_CLASS} style={{ color: 'var(--adm-muted-fg)' }}>Opened from</dt>
                  <dd className="flex flex-wrap items-center gap-2 font-semibold" style={{ color: 'var(--adm-fg)' }}>
                    {reportOriginLabel(report.origin)}
                    {report.origin === 'event_chat' && report.event && (
                      <OpenButton
                        label="Open event details"
                        icon={<Calendar className="h-3 w-3" />}
                        onClick={onOpenEvent ? () => onOpenEvent(report.event!.id) : undefined}
                      />
                    )}
                  </dd>
                </div>
              </dl>

              <div>
                <p className={LABEL_CLASS} style={{ color: 'var(--adm-muted-fg)' }}>Description</p>
                <p
                  className="text-xs leading-relaxed rounded-xl border p-3 whitespace-pre-line"
                  style={{ color: 'var(--adm-fg)', background: 'hsl(213 40% 18% / .5)', borderColor: 'var(--adm-border)' }}
                >
                  {report.description || 'No description.'}
                </p>
              </div>
            </div>

            {/* ===== Reported item ===== */}
            <div className="rounded-[16px] border p-5 space-y-3" style={CARD_STYLE} aria-label="Reported item">
              <h3 className="text-sm font-bold" style={{ color: 'var(--adm-fg)' }}>Reported item</h3>
              {report.target_type === 'event' ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--adm-fg)' }}>
                    <Calendar className="h-4 w-4" style={{ color: 'var(--adm-primary-text)' }} />
                    {report.event?.title ?? 'Unknown event'}
                  </p>
                  {report.event && (
                    <OpenButton
                      label="Open event"
                      icon={<Calendar className="h-3 w-3" />}
                      onClick={onOpenEvent ? () => onOpenEvent(report.event!.id) : undefined}
                    />
                  )}
                </div>
              ) : report.target_type === 'user' ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--adm-fg)' }}>
                    <UserIcon className="h-4 w-4" style={{ color: 'var(--adm-primary-text)' }} />
                    {name(report.reported_user)}
                    {report.reported_user?.username && (
                      <span className="text-xs font-normal" style={{ color: 'var(--adm-muted-fg)' }}>
                        @{report.reported_user.username}
                      </span>
                    )}
                  </p>
                  {report.reported_user?.id && (
                    <OpenButton
                      label="Open user"
                      icon={<UserIcon className="h-3 w-3" />}
                      onClick={onOpenUser ? () => onOpenUser(report.reported_user!.id) : undefined}
                    />
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--adm-fg)' }}>
                      <MessageSquare className="h-4 w-4" style={{ color: 'var(--adm-primary-text)' }} />
                      Message by {name(report.message?.sender ?? report.reported_user)}
                    </p>
                    {(report.message?.sender?.id || report.reported_user?.id) && (
                      <OpenButton
                        label="Open user"
                        icon={<UserIcon className="h-3 w-3" />}
                        onClick={
                          onOpenUser
                            ? () => onOpenUser((report.message?.sender?.id || report.reported_user?.id) as string)
                            : undefined
                        }
                      />
                    )}
                  </div>
                  {report.message?.content && (
                    <p
                      className="text-xs leading-relaxed rounded-xl border p-3"
                      style={{ color: 'var(--adm-fg)', background: 'hsl(213 40% 18% / .5)', borderColor: 'var(--adm-border)' }}
                    >
                      {report.message.content}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ===== Chat context ===== */}
            {report.origin === 'event_chat' && report.chat_context.length > 0 && (
              <div className="rounded-[16px] border p-5 space-y-3" style={CARD_STYLE}>
                <h3 className="text-sm font-bold" style={{ color: 'var(--adm-fg)' }}>Chat context</h3>
                <ol className="space-y-2" aria-label="Chat context">
                  {report.chat_context.map((m) => (
                    <li
                      key={m.id}
                      aria-current={m.reported ? 'true' : undefined}
                      data-reported={m.reported ? 'true' : undefined}
                      className="rounded-xl border px-3 py-2"
                      style={
                        m.reported
                          ? { borderColor: 'hsl(0 84% 60% / .6)', background: 'hsl(0 84% 60% / .12)' }
                          : { borderColor: 'var(--adm-border)', background: 'hsl(213 40% 18% / .4)' }
                      }
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="font-semibold" style={{ color: 'var(--adm-fg)' }}>{m.sender_name}</span>
                        <span style={{ color: 'var(--adm-muted-fg)' }}>{formatReportTime(m.created_at)}</span>
                        {m.reported && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: 'var(--adm-danger)', color: 'white' }}
                          >
                            Reported message
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--adm-fg)' }}>{m.content}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* ===== Actions or outcome ===== */}
            {report.status === 'open' ? (
              <div className="rounded-[16px] border p-5 space-y-3" style={CARD_STYLE}>
                <h3 className="text-sm font-bold" style={{ color: 'var(--adm-fg)' }}>Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {(['dismiss', 'warn', 'remove', 'suspend'] as ActionKind[])
                    .filter((kind) => {
                      if (kind === 'remove') return !removeBlocked;
                      if (kind === 'warn' || kind === 'suspend') return !userActionsBlocked;
                      return true;
                    })
                    .map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => openAction(kind)}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold active:scale-95 transition-all"
                        style={ACTION_BUTTONS[kind].style}
                      >
                        {ACTION_BUTTONS[kind].icon}
                        {ACTION_BUTTONS[kind].label}
                      </button>
                    ))}
                </div>
                {isEventReport && !userActionsBlocked && (
                  <Note>Warning and suspending apply to the event&apos;s organizer, {targetName}.</Note>
                )}
                {userActionsBlocked && <Note>{userActionsBlocked}</Note>}
                {removeBlocked && <Note>{removeBlocked}</Note>}
              </div>
            ) : (
              <div
                className="rounded-[16px] border p-4 space-y-1 text-xs"
                style={{ borderColor: 'hsl(152 60% 42% / .35)', background: 'hsl(152 60% 42% / .07)' }}
                aria-label="Outcome"
              >
                <p className="flex items-center gap-2 font-semibold" style={{ color: 'var(--adm-ok-text)' }}>
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Outcome: {reportOutcomeLabel(report.outcome)}
                </p>
                {(report.closed_at || report.closed_by) && (
                  <p style={{ color: 'var(--adm-muted-fg)' }}>
                    Closed
                    {report.closed_by ? ` by ${name(report.closed_by, 'an administrator')}` : ''}
                    {report.closed_at ? ` on ${formatReportTime(report.closed_at)}` : ''}.
                  </p>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>

      <AlertDialog open={activeAction !== null} onOpenChange={(open) => !open && !acting && setActiveAction(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              {activeAction ? dialogText[activeAction].title : ''}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              {activeAction ? dialogText[activeAction].body : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {needsReason && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required)"
              aria-label="Reason"
              maxLength={1000}
              rows={3}
              className="w-full rounded-xl border px-3 py-2.5 text-xs outline-none resize-none placeholder:opacity-60"
              style={{ borderColor: 'var(--adm-border)', background: 'var(--adm-secondary)', color: 'var(--adm-fg)' }}
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
              style={{ background: activeAction === 'dismiss' ? 'var(--adm-primary)' : 'var(--adm-danger)' }}
            >
              {acting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Working...
                </>
              ) : activeAction ? (
                dialogText[activeAction].confirm
              ) : (
                'Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
