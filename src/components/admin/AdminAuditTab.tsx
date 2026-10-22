import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ClipboardList,
  Loader2,
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

interface ActionStyle {
  label: string;
  style: React.CSSProperties;
}

const ACTION_STYLES: Record<string, ActionStyle> = {
  warn: {
    label: 'Warn',
    style: {
      background: 'hsl(38 92% 52% / .15)',
      color: 'var(--adm-warn-text)',
      borderColor: 'hsl(38 92% 52% / .35)',
    },
  },
  suspend: {
    label: 'Suspend',
    style: {
      background: 'hsl(0 84% 60% / .15)',
      color: 'var(--adm-danger-text)',
      borderColor: 'hsl(0 84% 60% / .35)',
    },
  },
  lift: {
    label: 'Lift Suspension',
    style: {
      background: 'hsl(152 60% 42% / .15)',
      color: 'var(--adm-ok-text)',
      borderColor: 'hsl(152 60% 42% / .35)',
    },
  },
  'lift-suspension': {
    label: 'Lift Suspension',
    style: {
      background: 'hsl(152 60% 42% / .15)',
      color: 'var(--adm-ok-text)',
      borderColor: 'hsl(152 60% 42% / .35)',
    },
  },
  remove: {
    label: 'Remove',
    style: {
      background: 'hsl(330 100% 59% / .15)',
      color: 'hsl(330 100% 78%)',
      borderColor: 'hsl(330 100% 59% / .35)',
    },
  },
  dismiss: {
    label: 'Dismiss',
    style: {
      background: 'var(--adm-secondary)',
      color: 'var(--adm-muted-fg)',
      borderColor: 'var(--adm-border)',
    },
  },
  'grant-admin': {
    label: 'Grant Admin',
    style: {
      background: 'hsl(271 76% 53% / .18)',
      color: 'var(--adm-primary-text)',
      borderColor: 'hsl(271 76% 53% / .4)',
    },
  },
  'withdraw-warning': {
    label: 'Withdraw Warning',
    style: {
      background: 'hsl(38 92% 52% / .1)',
      color: 'var(--adm-warn-text)',
      borderColor: 'hsl(38 92% 52% / .25)',
    },
  },
};

function getActionStyle(action: string): ActionStyle {
  const normalized = action.toLowerCase().replace(/_/g, '-');
  return (
    ACTION_STYLES[normalized] ?? {
      label: action,
      style: {
        background: 'var(--adm-secondary)',
        color: 'var(--adm-muted-fg)',
        borderColor: 'var(--adm-border)',
      },
    }
  );
}

function ActionPill({ action }: { action: string }) {
  const s = getActionStyle(action);
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={s.style}
    >
      {s.label}
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

  const onErrorToastRef = useRef(onErrorToast);
  onErrorToastRef.current = onErrorToast;

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
        onErrorToastRef.current(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
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
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--adm-muted-fg)' }}
        >
          Audit Log
        </p>
        <span className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {loading ? (
        <div
          className="flex flex-col items-center justify-center py-16 space-y-3 rounded-2xl border"
          style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
        >
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--adm-primary)' }} />
          <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            Loading audit log...
          </p>
        </div>
      ) : entries.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-14 text-center rounded-2xl border border-dashed p-6 space-y-2"
          style={{
            background: 'hsl(213 50% 15% / .5)',
            borderColor: 'var(--adm-border)',
          }}
        >
          <ClipboardList
            className="h-10 w-10 opacity-50"
            style={{ color: 'var(--adm-muted-fg)' }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--adm-fg)' }}>
            No audit entries
          </p>
          <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            Administrative actions will appear here.
          </p>
        </div>
      ) : (
        <div
          className="rounded-[16px] border overflow-hidden"
          style={{
            background: 'var(--adm-grad-card)',
            borderColor: 'var(--adm-border)',
          }}
        >
          {/* Table header */}
          <div
            className="hidden sm:grid grid-cols-[1fr_auto_auto_1fr] gap-3 border-b px-4 py-2.5"
            style={{
              background: 'hsl(213 40% 18% / .6)',
              borderBottomColor: 'var(--adm-border)',
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--adm-muted-fg)' }}
            >
              Admin
            </p>
            <p
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--adm-muted-fg)' }}
            >
              Action
            </p>
            <p
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--adm-muted-fg)' }}
            >
              Target
            </p>
            <p
              className="text-[11px] font-semibold uppercase tracking-wider text-right"
              style={{ color: 'var(--adm-muted-fg)' }}
            >
              Date
            </p>
          </div>

          {/* Rows */}
          <ul
            className="divide-y"
            style={{ borderColor: 'var(--adm-border)' }}
          >
            {entries.map((entry) => {
              const hasTarget = Boolean(entry.target_id);
              const isUserTarget = entry.target_type === 'user';
              const isEventTarget = entry.target_type === 'event';
              const canNavigateUser = hasTarget && isUserTarget && onNavigateToUser;
              const canNavigateEvent = hasTarget && isEventTarget && onNavigateToEvent;

              return (
                <li
                  key={entry.id}
                  className="px-4 py-3"
                  style={{ borderColor: 'var(--adm-border)' }}
                >
                  {/* Mobile layout */}
                  <div className="sm:hidden space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-xs font-semibold truncate"
                        style={{ color: 'var(--adm-fg)' }}
                      >
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
                        <span className="text-xs italic" style={{ color: 'var(--adm-muted-fg)' }}>
                          —
                        </span>
                      )}
                      <span
                        className="text-[11px] whitespace-nowrap"
                        style={{ color: 'var(--adm-muted-fg)' }}
                      >
                        {formatDate(entry.created_at)}
                      </span>
                    </div>
                    {entry.details && (
                      <p
                        className="text-[11px] truncate"
                        style={{ color: 'var(--adm-muted-fg)', opacity: 0.8 }}
                      >
                        {entry.details}
                      </p>
                    )}
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid grid-cols-[1fr_auto_auto_1fr] items-center gap-3">
                    <p
                      className="text-xs font-semibold truncate"
                      style={{ color: 'var(--adm-fg)' }}
                    >
                      {entry.admin_name}
                    </p>
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
                      <span className="text-xs italic" style={{ color: 'var(--adm-muted-fg)' }}>
                        —
                      </span>
                    )}
                    <p
                      className="text-[11px] text-right whitespace-nowrap"
                      style={{ color: 'var(--adm-muted-fg)' }}
                    >
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
            className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-semibold transition-all disabled:opacity-50 active:scale-95"
            style={{
              borderColor: 'var(--adm-border)',
              background: 'var(--adm-secondary)',
              color: 'var(--adm-fg)',
            }}
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
        aria-label="View target user"
        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors hover:opacity-80"
        style={{
          borderColor: 'var(--adm-border)',
          background: 'hsl(213 40% 20% / .5)',
          color: 'var(--adm-fg)',
        }}
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
        aria-label="View target event"
        className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors hover:opacity-80"
        style={{
          borderColor: 'var(--adm-border)',
          background: 'hsl(213 40% 20% / .5)',
          color: 'var(--adm-fg)',
        }}
      >
        <span className="truncate max-w-[100px]">{targetLabel}</span>
        <ChevronRight className="h-3 w-3 shrink-0" />
      </button>
    );
  }

  return (
    <span
      className="inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-medium"
      style={{
        borderColor: 'var(--adm-border)',
        background: 'hsl(213 40% 20% / .3)',
        color: 'var(--adm-muted-fg)',
      }}
    >
      <span className="truncate max-w-[100px]">{targetLabel}</span>
    </span>
  );
}
