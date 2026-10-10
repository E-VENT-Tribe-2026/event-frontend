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

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  pending: {
    background: 'hsl(38 92% 52% / .15)',
    color: 'var(--adm-warn-text)',
    borderColor: 'hsl(38 92% 52% / .35)',
  },
  dismissed: {
    background: 'var(--adm-secondary)',
    color: 'var(--adm-muted-fg)',
    borderColor: 'var(--adm-border)',
  },
  actioned: {
    background: 'hsl(152 60% 42% / .15)',
    color: 'var(--adm-ok-text)',
    borderColor: 'hsl(152 60% 42% / .35)',
  },
};

const REASON_STYLES: Record<string, React.CSSProperties> = {
  spam: {
    background: 'hsl(38 92% 52% / .15)',
    color: 'var(--adm-warn-text)',
    borderColor: 'hsl(38 92% 52% / .35)',
  },
  harassment: {
    background: 'hsl(0 84% 60% / .15)',
    color: 'var(--adm-danger-text)',
    borderColor: 'hsl(0 84% 60% / .35)',
  },
  inappropriate: {
    background: 'hsl(330 100% 59% / .14)',
    color: 'hsl(330 100% 78%)',
    borderColor: 'hsl(330 100% 59% / .35)',
  },
  misinformation: {
    background: 'hsl(55 92% 52% / .15)',
    color: 'hsl(55 95% 70%)',
    borderColor: 'hsl(55 92% 52% / .35)',
  },
  other: {
    background: 'var(--adm-secondary)',
    color: 'var(--adm-muted-fg)',
    borderColor: 'var(--adm-border)',
  },
};

function getStatusStyle(status: string): React.CSSProperties {
  return STATUS_STYLES[status] ?? {
    background: 'var(--adm-secondary)',
    color: 'var(--adm-muted-fg)',
    borderColor: 'var(--adm-border)',
  };
}

function getReasonStyle(reason: string): React.CSSProperties {
  return (
    REASON_STYLES[reason.toLowerCase()] ?? {
      background: 'hsl(330 100% 59% / .14)',
      color: 'hsl(330 100% 78%)',
      borderColor: 'hsl(330 100% 59% / .35)',
    }
  );
}

const ACTION_CONFIGS: Record<
  ActionKind,
  {
    label: string;
    icon: React.ReactNode;
    btnStyle: React.CSSProperties;
    title: string;
    description: (targetName: string) => string;
    confirmLabel: string;
    confirmStyle: React.CSSProperties;
    needsNote: boolean;
  }
> = {
  dismiss: {
    label: 'Dismiss',
    icon: <XCircle className="h-3.5 w-3.5" />,
    btnStyle: {
      borderColor: 'var(--adm-border)',
      background: 'var(--adm-secondary)',
      color: 'var(--adm-fg)',
    },
    title: 'Dismiss Report',
    description: (t) => `Dismiss this report about "${t}" without taking further action.`,
    confirmLabel: 'Dismiss',
    confirmStyle: {
      background: 'var(--adm-secondary)',
      color: 'var(--adm-fg)',
      borderColor: 'var(--adm-border)',
    },
    needsNote: false,
  },
  warn: {
    label: 'Warn',
    icon: <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--adm-warn-text)' }} />,
    btnStyle: {
      borderColor: 'hsl(38 92% 52% / .35)',
      background: 'hsl(38 92% 52% / .12)',
      color: 'var(--adm-warn-text)',
    },
    title: 'Issue Warning',
    description: (t) => `Issue a warning to the target of this report ("${t}").`,
    confirmLabel: 'Issue Warning',
    confirmStyle: {
      background: 'hsl(38 92% 52%)',
      color: 'white',
    },
    needsNote: true,
  },
  remove: {
    label: 'Remove',
    icon: <Trash2 className="h-3.5 w-3.5" style={{ color: 'hsl(330 100% 78%)' }} />,
    btnStyle: {
      borderColor: 'hsl(330 100% 59% / .35)',
      background: 'hsl(330 100% 59% / .12)',
      color: 'hsl(330 100% 78%)',
    },
    title: 'Remove Content',
    description: (t) => `Permanently remove "${t}". This action cannot be undone.`,
    confirmLabel: 'Remove',
    confirmStyle: {
      background: 'var(--adm-danger)',
      color: 'white',
    },
    needsNote: false,
  },
  suspend: {
    label: 'Suspend',
    icon: <Ban className="h-3.5 w-3.5" style={{ color: 'var(--adm-danger-text)' }} />,
    btnStyle: {
      borderColor: 'hsl(0 84% 60% / .35)',
      background: 'hsl(0 84% 60% / .12)',
      color: 'var(--adm-danger-text)',
    },
    title: 'Suspend User',
    description: (t) =>
      `Suspend the account of "${t}". They will lose access until the suspension is lifted.`,
    confirmLabel: 'Suspend',
    confirmStyle: {
      background: 'var(--adm-danger)',
      color: 'white',
    },
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
  const [hoveredBack, setHoveredBack] = useState(false);

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
          aria-label="Back to Reports"
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
          Back to Reports
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
        ) : report ? (
          <>
            {/* Summary card */}
            <div
              className="rounded-[16px] border p-5 space-y-4"
              style={{
                background: 'var(--adm-grad-card)',
                borderColor: 'var(--adm-border)',
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--adm-muted-fg)' }}
                  >
                    {report.target_type === 'event' ? 'Event' : 'User'} Report
                  </p>
                  <h2 className="text-base font-bold leading-tight" style={{ color: 'var(--adm-fg)' }}>
                    {report.target_name}
                  </h2>
                </div>
                <span
                  className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize"
                  style={getStatusStyle(report.status)}
                >
                  {report.status}
                </span>
              </div>

              <dl className="grid grid-cols-1 gap-y-2.5 sm:grid-cols-2 text-xs">
                <div>
                  <dt
                    className="text-[11px] uppercase tracking-wider font-medium mb-0.5"
                    style={{ color: 'var(--adm-muted-fg)' }}
                  >
                    Reason
                  </dt>
                  <dd>
                    <span
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                      style={getReasonStyle(report.reason)}
                    >
                      {report.reason}
                    </span>
                  </dd>
                </div>

                <div>
                  <dt
                    className="text-[11px] uppercase tracking-wider font-medium mb-0.5"
                    style={{ color: 'var(--adm-muted-fg)' }}
                  >
                    Reported by
                  </dt>
                  <dd className="font-semibold" style={{ color: 'var(--adm-fg)' }}>
                    {report.reporter_name}
                  </dd>
                </div>

                <div>
                  <dt
                    className="text-[11px] uppercase tracking-wider font-medium mb-0.5"
                    style={{ color: 'var(--adm-muted-fg)' }}
                  >
                    Filed
                  </dt>
                  <dd className="font-semibold" style={{ color: 'var(--adm-fg)' }}>
                    {formatDate(report.created_at)}
                  </dd>
                </div>

                {report.resolved_at && (
                  <div>
                    <dt
                      className="text-[11px] uppercase tracking-wider font-medium mb-0.5"
                      style={{ color: 'var(--adm-muted-fg)' }}
                    >
                      Resolved
                    </dt>
                    <dd className="font-semibold" style={{ color: 'var(--adm-fg)' }}>
                      {formatDate(report.resolved_at)}
                      {report.resolved_by ? ` by ${report.resolved_by}` : ''}
                    </dd>
                  </div>
                )}
              </dl>

              {report.description && (
                <div>
                  <p
                    className="text-[11px] uppercase tracking-wider font-medium mb-1"
                    style={{ color: 'var(--adm-muted-fg)' }}
                  >
                    Description
                  </p>
                  <p
                    className="text-xs leading-relaxed rounded-xl border p-3"
                    style={{
                      color: 'var(--adm-fg)',
                      background: 'hsl(213 40% 18% / .5)',
                      borderColor: 'var(--adm-border)',
                    }}
                  >
                    {report.description}
                  </p>
                </div>
              )}

              {report.admin_note && (
                <div>
                  <p
                    className="text-[11px] uppercase tracking-wider font-medium mb-1"
                    style={{ color: 'var(--adm-muted-fg)' }}
                  >
                    Admin Note
                  </p>
                  <p
                    className="text-xs leading-relaxed rounded-xl border p-3"
                    style={{
                      color: 'var(--adm-fg)',
                      background: 'hsl(213 40% 18% / .5)',
                      borderColor: 'var(--adm-border)',
                    }}
                  >
                    {report.admin_note}
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {!isAlreadyResolved ? (
              <div
                className="rounded-[16px] border p-5 space-y-3"
                style={{
                  background: 'var(--adm-grad-card)',
                  borderColor: 'var(--adm-border)',
                }}
              >
                <h3 className="text-sm font-bold" style={{ color: 'var(--adm-fg)' }}>
                  Moderate
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ACTION_CONFIGS) as ActionKind[]).map((kind) => {
                    const c = ACTION_CONFIGS[kind];
                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => openAction(kind)}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold active:scale-95 transition-all"
                        style={c.btnStyle}
                      >
                        {c.icon}
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 rounded-[16px] border p-4 text-xs font-medium"
                style={{
                  borderColor: 'hsl(152 60% 42% / .35)',
                  background: 'hsl(152 60% 42% / .07)',
                  color: 'var(--adm-ok-text)',
                }}
              >
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
              disabled={acting}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              className="rounded-lg text-xs font-semibold"
              style={config?.confirmStyle ?? {}}
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
