import { useEffect, useState, useCallback } from 'react';
import {
  ClipboardList,
  Loader2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import {
  fetchAdminAudit,
  type AdminAuditEntry,
} from '@/lib/adminApi';

interface AdminAuditTabProps {
  onNavigateToUser?: (userId: string) => void;
  onNavigateToEvent?: (eventId: string) => void;
  onErrorToast: (msg: string) => void;
}

const PAGE_SIZE = 20;

type ActionKey =
  | 'warn'
  | 'suspend'
  | 'lift'
  | 'remove'
  | 'dismiss'
  | 'grant-admin'
  | (string & Record<never, never>);

interface ActionStyle {
  label: string;
  className: string;
}

const ACTION_STYLES: Record<string, ActionStyle> = {
  warn: {
    label: 'Warn',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  suspend: {
    label: 'Suspend',
    className: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  lift: {
    label: 'Lift Suspension',
    className: 'bg-green-500/15 text-green-400 border-green-500/30',
  },
  'lift-suspension': {
    label: 'Lift Suspension',
    className: 'bg-green-500/15 text-green-400 border-green-500/30',
  },
  remove: {
    label: 'Remove',
    className: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  },
  dismiss: {
    label: 'Dismiss',
    className: 'bg-muted text-muted-foreground border-border',
  },
  'grant-admin': {
    label: 'Grant Admin',
    className: 'bg-primary/15 text-primary border-primary/30',
  },
  'withdraw-warning': {
    label: 'Withdraw Warning',
    className: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  },
};

function getActionStyle(action: string): ActionStyle {
  const normalized = action.toLowerCase().replace(/_/g, '-');
  return (
    ACTION_STYLES[normalized] ?? {
      label: action,
      className: 'bg-muted text-muted-foreground border-border',
    }
  );
}

function ActionPill({ action }: { action: string }) {
  const style = getActionStyle(action);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  );
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

export default function AdminAuditTab({
  onNavigateToUser,
  onNavigateToEvent,
  onErrorToast,
}: AdminAuditTabProps) {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadAudit = useCallback(
    async (targetPage: number, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const res = await fetchAdminAudit(targetPage, PAGE_SIZE);
        setEntries((prev) => (append ? [...prev, ...res.items] : res.items));
        setPage(res.page);
        setTotalPages(res.total_pages);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load audit log';
        onErrorToast(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [onErrorToast],
  );

  useEffect(() => {
    void loadAudit(1);
  }, [loadAudit]);

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      void loadAudit(page + 1, true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Audit Log
        </p>
        <span className="text-xs text-muted-foreground">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border border-border/50 bg-card">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading audit log...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center rounded-2xl border border-dashed border-border bg-card/50 p-6 space-y-2">
          <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No audit entries</p>
          <p className="text-xs text-muted-foreground">Administrative actions will appear here.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_1fr] gap-3 border-b border-border/60 px-4 py-2.5 bg-secondary/30">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Admin
            </p>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Action
            </p>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Target
            </p>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
              Date
            </p>
          </div>

          {/* Rows */}
          <ul className="divide-y divide-border/40">
            {entries.map((entry) => {
              const hasTarget = Boolean(entry.target_id);
              const isUserTarget = entry.target_type === 'user';
              const isEventTarget = entry.target_type === 'event';
              const canNavigateUser = hasTarget && isUserTarget && onNavigateToUser;
              const canNavigateEvent = hasTarget && isEventTarget && onNavigateToEvent;

              return (
                <li key={entry.id} className="px-4 py-3">
                  {/* Mobile layout */}
                  <div className="sm:hidden space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {entry.admin_name}
                      </span>
                      <ActionPill action={entry.action} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {hasTarget ? (
                        <TargetButton
                          entry={entry}
                          canNavigateUser={!!canNavigateUser}
                          canNavigateEvent={!!canNavigateEvent}
                          onNavigateToUser={onNavigateToUser}
                          onNavigateToEvent={onNavigateToEvent}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      )}
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </span>
                    </div>
                    {entry.details && (
                      <p className="text-[11px] text-muted-foreground/80 truncate">{entry.details}</p>
                    )}
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid grid-cols-[1fr_auto_auto_1fr] items-center gap-3">
                    <p className="text-xs font-semibold text-foreground truncate">{entry.admin_name}</p>
                    <ActionPill action={entry.action} />
                    {hasTarget ? (
                      <TargetButton
                        entry={entry}
                        canNavigateUser={!!canNavigateUser}
                        canNavigateEvent={!!canNavigateEvent}
                        onNavigateToUser={onNavigateToUser}
                        onNavigateToEvent={onNavigateToEvent}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                    <p className="text-[11px] text-muted-foreground text-right whitespace-nowrap">
                      {formatDate(entry.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Load More */}
      {page < totalPages && !loading && (
        <div className="pt-2 text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={handleLoadMore}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary/80 active:scale-95 transition-all disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading more...
              </>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function TargetButton({
  entry,
  canNavigateUser,
  canNavigateEvent,
  onNavigateToUser,
  onNavigateToEvent,
}: {
  entry: AdminAuditEntry;
  canNavigateUser: boolean;
  canNavigateEvent: boolean;
  onNavigateToUser?: (userId: string) => void;
  onNavigateToEvent?: (eventId: string) => void;
}) {
  const targetLabel =
    entry.details
      ? entry.details.length > 28
        ? `${entry.details.slice(0, 28)}…`
        : entry.details
      : entry.target_type === 'user'
        ? 'User'
        : entry.target_type === 'event'
          ? 'Event'
          : entry.target_id ?? '—';

  if (canNavigateUser && onNavigateToUser && entry.target_id) {
    return (
      <button
        type="button"
        onClick={() => onNavigateToUser(entry.target_id!)}
        aria-label={`View target user`}
        className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/50 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-secondary hover:border-primary/30 transition-colors"
      >
        <span className="truncate max-w-[100px]">{targetLabel}</span>
        <ChevronRight className="h-3 w-3 shrink-0" />
      </button>
    );
  }

  if (canNavigateEvent && onNavigateToEvent && entry.target_id) {
    return (
      <button
        type="button"
        onClick={() => onNavigateToEvent(entry.target_id!)}
        aria-label={`View target event`}
        className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/50 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-secondary hover:border-primary/30 transition-colors"
      >
        <span className="truncate max-w-[100px]">{targetLabel}</span>
        <ChevronRight className="h-3 w-3 shrink-0" />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center rounded-lg border border-border/40 bg-secondary/30 px-2 py-1 text-[11px] font-medium text-muted-foreground">
      <span className="truncate max-w-[100px]">{targetLabel}</span>
    </span>
  );
}
