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
  actionReport,
  type AdminReportDetail,
} from '@/lib/adminApi';

interface AdminReportDetailProps {
  reportId: string;
  onBack: () => void;
  onErrorToast: (message: string) => void;
  onSuccessToast: (message: string) => void;
}

type ActionKind = 'dismiss' | 'warn' | 'remove' | 'suspend';

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

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  dismissed: 'bg-muted text-muted-foreground border-border',
  actioned: 'bg-green-500/15 text-green-400 border-green-500/30',
};

const REASON_STYLES: Record<string, string> = {
  spam: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  harassment: 'bg-red-500/15 text-red-400 border-red-500/30',
  inappropriate: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  misinformation: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  other: 'bg-muted text-muted-foreground border-border',
};

function getStatusStyle(status: string): string {
  return STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground border-border';
}

function getReasonStyle(reason: string): string {
  return REASON_STYLES[reason.toLowerCase()] ?? 'bg-muted text-muted-foreground border-border';
}

const ACTION_CONFIGS: Record<
  ActionKind,
  {
    label: string;
    icon: React.ReactNode;
    btnClass: string;
    title: string;
    description: (targetName: string) => string;
    confirmLabel: string;
    confirmClass: string;
    needsNote: boolean;
  }
> = {
  dismiss: {
    label: 'Dismiss',
    icon: <XCircle className="h-3.5 w-3.5" />,
    btnClass:
      'border-border bg-secondary text-foreground hover:bg-secondary/70',
    title: 'Dismiss Report',
    description: (t) => `Dismiss this report about "${t}" without taking further action.`,
    confirmLabel: 'Dismiss',
    confirmClass: 'rounded-lg text-xs font-semibold',
    needsNote: false,
  },
  warn: {
    label: 'Warn',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
    btnClass:
      'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20',
    title: 'Issue Warning',
    description: (t) => `Issue a warning to the target of this report ("${t}").`,
    confirmLabel: 'Issue Warning',
    confirmClass:
      'rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-500/90',
    needsNote: true,
  },
  remove: {
    label: 'Remove',
    icon: <Trash2 className="h-3.5 w-3.5 text-pink-400" />,
    btnClass:
      'border-pink-500/30 bg-pink-500/10 text-pink-400 hover:bg-pink-500/20',
    title: 'Remove Content',
    description: (t) => `Permanently remove "${t}". This action cannot be undone.`,
    confirmLabel: 'Remove',
    confirmClass:
      'rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90',
    needsNote: false,
  },
  suspend: {
    label: 'Suspend',
    icon: <Ban className="h-3.5 w-3.5 text-red-400" />,
    btnClass:
      'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20',
    title: 'Suspend User',
    description: (t) => `Suspend the account of "${t}". They will lose access until the suspension is lifted.`,
    confirmLabel: 'Suspend',
    confirmClass:
      'rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-500/90',
    needsNote: true,
  },
};

export default function AdminReportDetail({
  reportId,
  onBack,
  onErrorToast,
  onSuccessToast,
}: AdminReportDetailProps) {
  const [report, setReport] = useState<AdminReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeAction, setActiveAction] = useState<ActionKind | null>(null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);
  const [resolved, setResolved] = useState(false);

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

  const openAction = (kind: ActionKind) => {
    setNote('');
    setActiveAction(kind);
  };

  const handleConfirm = async () => {
    if (!report || acting || !activeAction) return;
    setActing(true);
    try {
      let res;
      if (activeAction === 'dismiss') {
        res = await dismissReport(report.id, note.trim() || undefined);
      } else {
        res = await actionReport(report.id, activeAction, note.trim() || undefined);
      }
      onSuccessToast(res.message || 'Action completed.');
      setResolved(true);
      setReport((prev) =>
        prev
          ? {
              ...prev,
              status: activeAction === 'dismiss' ? 'dismissed' : 'actioned',
            }
          : null,
      );
      setActiveAction(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed.';
      onErrorToast(msg);
    } finally {
      setActing(false);
    }
  };

  const config = activeAction ? ACTION_CONFIGS[activeAction] : null;
  const isAlreadyResolved = resolved || (report && report.status !== 'pending');

  return (
    <>
      <div className="space-y-5">
        {/* Back */}
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border border-border/50 bg-card">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading report...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center space-y-2">
            <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
            <p className="text-xs text-destructive font-medium">{error}</p>
          </div>
        ) : report ? (
          <>
            {/* Summary card */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {report.target_type === 'event' ? 'Event' : 'User'} Report
                  </p>
                  <h2 className="text-base font-bold text-foreground leading-tight">
                    {report.target_name}
                  </h2>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getStatusStyle(report.status)}`}
                >
                  {report.status}
                </span>
              </div>

              <dl className="grid grid-cols-1 gap-y-2.5 sm:grid-cols-2 text-xs">
                <div>
                  <dt className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
                    Reason
                  </dt>
                  <dd>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getReasonStyle(report.reason)}`}
                    >
                      {report.reason}
                    </span>
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
                    Reported by
                  </dt>
                  <dd className="font-semibold text-foreground">{report.reporter_name}</dd>
                </div>

                <div>
                  <dt className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
                    Filed
                  </dt>
                  <dd className="font-semibold text-foreground">{formatDate(report.created_at)}</dd>
                </div>

                {report.resolved_at && (
                  <div>
                    <dt className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
                      Resolved
                    </dt>
                    <dd className="font-semibold text-foreground">
                      {formatDate(report.resolved_at)}
                      {report.resolved_by ? ` by ${report.resolved_by}` : ''}
                    </dd>
                  </div>
                )}
              </dl>

              {report.description && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">
                    Description
                  </p>
                  <p className="text-xs text-foreground/90 leading-relaxed rounded-xl bg-secondary/40 border border-border/40 p-3">
                    {report.description}
                  </p>
                </div>
              )}

              {report.admin_note && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">
                    Admin Note
                  </p>
                  <p className="text-xs text-foreground/90 leading-relaxed rounded-xl bg-secondary/40 border border-border/40 p-3">
                    {report.admin_note}
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {!isAlreadyResolved ? (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-foreground">Moderate</h3>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ACTION_CONFIGS) as ActionKind[]).map((kind) => {
                    const c = ACTION_CONFIGS[kind];
                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => openAction(kind)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold active:scale-95 transition-all ${c.btnClass}`}
                      >
                        {c.icon}
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl border border-green-500/30 bg-green-500/5 p-4 text-xs font-medium text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                This report has been resolved.
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={activeAction !== null}
        onOpenChange={(open) => !open && setActiveAction(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              {config?.title ?? ''}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              {config && report ? config.description(report.target_name) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {config?.needsNote && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)..."
              aria-label="Admin note"
              rows={3}
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/50 resize-none placeholder:text-muted-foreground/60"
            />
          )}

          <AlertDialogFooter className="flex-row gap-2 justify-end">
            <AlertDialogCancel disabled={acting} className="rounded-lg text-xs mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={acting}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              className={config?.confirmClass ?? 'rounded-lg text-xs font-semibold'}
            >
              {acting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Working...
                </>
              ) : (
                config?.confirmLabel ?? 'Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
