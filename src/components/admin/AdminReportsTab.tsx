import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, ChevronRight } from 'lucide-react';
import ReportFlag from '@/components/ReportFlag';
import {
  fetchAdminReports,
  formatReportTime,
  personDisplayName,
  reportedItemLabel,
  reportReasonLabel,
  reportStatusLabel,
  type AdminReportStatus,
  type AdminReportSummary,
} from '@/lib/adminApi';

interface AdminReportsTabProps {
  onOpenReport: (reportId: string) => void;
  onErrorToast: (msg: string) => void;
  /** Changes whenever the open reports change (live update); the open list is then fetched again. */
  liveVersion?: number;
}

const PAGE_SIZE = 20;
const OPEN_PAGE_SIZE = 50;

const STATUS_STYLES: Record<AdminReportStatus, React.CSSProperties> = {
  open: {
    background: 'hsl(0 84% 60% / .15)',
    color: 'var(--adm-danger-text)',
    borderColor: 'hsl(0 84% 60% / .35)',
  },
  dismissed: {
    background: 'var(--adm-secondary)',
    color: 'var(--adm-muted-fg)',
    borderColor: 'var(--adm-border)',
  },
  action_taken: {
    background: 'hsl(152 60% 42% / .15)',
    color: 'var(--adm-ok-text)',
    borderColor: 'hsl(152 60% 42% / .35)',
  },
};

export function ReportStatusPill({ status }: { status: AdminReportStatus }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={STATUS_STYLES[status]}
    >
      {reportStatusLabel(status)}
    </span>
  );
}

const TARGET_LABEL = { event: 'Event', user: 'User', message: 'Chat message' } as const;

function ReportRow({ report, onOpen }: { report: AdminReportSummary; onOpen: (id: string) => void }) {
  const item = reportedItemLabel(report);
  const reporter = report.reporter ? personDisplayName(report.reporter) : 'Deleted user';
  return (
    <button
      type="button"
      onClick={() => onOpen(report.id)}
      aria-label={`Open report about ${item}`}
      className="group w-full flex items-center justify-between gap-3 rounded-[12px] border px-3.5 py-2.5 text-left transition-all active:scale-[0.99] bg-[var(--adm-card)] border-[var(--adm-border)] hover:bg-[hsl(213_50%_17%)] hover:border-[hsl(271_76%_53%/.55)]"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--adm-fg)' }}>
            {item}
          </p>
          <span className="text-[10px] font-medium" style={{ color: 'var(--adm-muted-fg)' }}>
            {TARGET_LABEL[report.target_type]}
          </span>
        </div>
        <p className="text-[11px] truncate" style={{ color: 'var(--adm-muted-fg)' }}>
          <span style={{ color: 'var(--adm-fg)' }}>{reportReasonLabel(report.reason)}</span>
          {' · '}by {reporter}
          {' · '}
          {formatReportTime(report.created_at)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ReportStatusPill status={report.status} />
        <ChevronRight className="h-4 w-4 transition-colors group-hover:text-[var(--adm-fg)]" style={{ color: 'var(--adm-muted-fg)' }} />
      </div>
    </button>
  );
}

function ReportSection({
  title,
  count,
  reports,
  loading,
  hasMore,
  onLoadMore,
  loadingMore,
  onOpen,
  emptyMessage,
  label,
}: {
  title: string;
  count: number;
  reports: AdminReportSummary[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore: boolean;
  onOpen: (id: string) => void;
  emptyMessage: string;
  label: string;
}) {
  return (
    <section className="space-y-3" aria-label={label}>
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--adm-muted-fg)' }}>
          {title}
        </p>
        <span className="text-xs" style={{ color: 'var(--adm-muted-fg)' }} data-testid={`${label}-count`}>
          {count} {count === 1 ? 'report' : 'reports'}
        </span>
      </div>

      {loading ? (
        <div
          className="flex flex-col items-center justify-center py-10 space-y-3 rounded-2xl border"
          style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
        >
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--adm-primary)' }} />
          <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            Loading...
          </p>
        </div>
      ) : reports.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-8 text-center rounded-2xl border border-dashed p-6 space-y-2"
          style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
        >
          <ReportFlag className="h-8 w-8 opacity-70" />
          <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            {emptyMessage}
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-1.5">
            {reports.map((r) => (
              <li key={r.id}>
                <ReportRow report={r} onOpen={onOpen} />
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="pt-1 text-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={onLoadMore}
                className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-semibold transition-all disabled:opacity-50 active:scale-95"
                style={{ borderColor: 'var(--adm-border)', background: 'var(--adm-secondary)', color: 'var(--adm-fg)' }}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading more...
                  </>
                ) : (
                  'Load more'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

type ListState = {
  items: AdminReportSummary[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  loadingMore: boolean;
};

const EMPTY_LIST: ListState = { items: [], total: 0, page: 1, totalPages: 1, loading: true, loadingMore: false };

export default function AdminReportsTab({ onOpenReport, onErrorToast, liveVersion = 0 }: AdminReportsTabProps) {
  const [open, setOpen] = useState<ListState>(EMPTY_LIST);
  const [all, setAll] = useState<ListState>(EMPTY_LIST);

  // Inline toast from the parent must not restart the fetch (that looped forever).
  const onErrorToastRef = useRef(onErrorToast);
  onErrorToastRef.current = onErrorToast;

  const load = useCallback(
    async (
      setList: React.Dispatch<React.SetStateAction<ListState>>,
      status: 'open' | undefined,
      targetPage: number,
      append: boolean,
      quiet = false,
    ) => {
      setList((s) => ({ ...s, loading: !append && !quiet ? true : s.loading, loadingMore: append }));
      try {
        const res = await fetchAdminReports(targetPage, status ? OPEN_PAGE_SIZE : PAGE_SIZE, status);
        setList((s) => ({
          items: append ? [...s.items, ...res.items.filter((r) => !s.items.some((x) => x.id === r.id))] : res.items,
          total: res.total,
          page: res.page,
          totalPages: res.total_pages,
          loading: false,
          loadingMore: false,
        }));
      } catch (err) {
        onErrorToastRef.current(err instanceof Error ? err.message : 'Failed to load reports');
        setList((s) => ({ ...s, loading: false, loadingMore: false }));
      }
    },
    [],
  );

  useEffect(() => {
    void load(setOpen, 'open', 1, false);
    void load(setAll, undefined, 1, false);
  }, [load]);

  // Live update: the open reports changed, so fetch them (and the first page of all reports) again.
  const firstLive = useRef(liveVersion);
  useEffect(() => {
    if (liveVersion === firstLive.current) return;
    void load(setOpen, 'open', 1, false, true);
    void load(setAll, undefined, 1, false, true);
  }, [liveVersion, load]);

  return (
    <div className="space-y-8">
      <ReportSection
        label="open-reports"
        title="Open reports"
        count={open.total}
        reports={open.items}
        loading={open.loading}
        hasMore={open.page < open.totalPages}
        onLoadMore={() => void load(setOpen, 'open', open.page + 1, true)}
        loadingMore={open.loadingMore}
        onOpen={onOpenReport}
        emptyMessage="No open reports."
      />

      <ReportSection
        label="all-reports"
        title="All reports"
        count={all.total}
        reports={all.items}
        loading={all.loading}
        hasMore={all.page < all.totalPages}
        onLoadMore={() => void load(setAll, undefined, all.page + 1, true)}
        loadingMore={all.loadingMore}
        onOpen={onOpenReport}
        emptyMessage="No reports yet."
      />
    </div>
  );
}
