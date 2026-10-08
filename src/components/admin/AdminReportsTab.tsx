import { useEffect, useState, useCallback } from 'react';
import { Flag, Loader2, ChevronRight } from 'lucide-react';
import {
  fetchAdminReports,
  type AdminReportSummary,
} from '@/lib/adminApi';

interface AdminReportsTabProps {
  onOpenReport: (reportId: string) => void;
  onErrorToast: (msg: string) => void;
}

const PAGE_SIZE = 20;

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

function getReasonStyle(reason: string): React.CSSProperties {
  const key = reason.toLowerCase();
  return REASON_STYLES[key] ?? {
    background: 'var(--adm-secondary)',
    color: 'var(--adm-muted-fg)',
    borderColor: 'var(--adm-border)',
  };
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

function getStatusStyle(status: string): React.CSSProperties {
  return STATUS_STYLES[status] ?? {
    background: 'var(--adm-secondary)',
    color: 'var(--adm-muted-fg)',
    borderColor: 'var(--adm-border)',
  };
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function ReportRow({
  report,
  onOpen,
}: {
  report: AdminReportSummary;
  onOpen: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onOpen(report.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`View report for ${report.target_name}`}
      className="group w-full flex items-center justify-between gap-3 rounded-[12px] border p-3.5 text-left transition-all active:scale-[0.99]"
      style={{
        background: hovered ? 'hsl(213 50% 17%)' : 'var(--adm-card)',
        borderColor: hovered ? 'hsl(271 76% 53% / .55)' : 'var(--adm-border)',
      }}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--adm-fg)' }}>
            {report.target_name}
          </p>
          <span className="text-[10px] font-medium" style={{ color: 'var(--adm-muted-fg)' }}>
            {report.target_type === 'event' ? 'Event' : 'User'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={getReasonStyle(report.reason)}
          >
            {report.reason}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--adm-muted-fg)', opacity: 0.4 }}>·</span>
          <span className="text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
            by {report.reporter_name}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--adm-muted-fg)', opacity: 0.4 }}>·</span>
          <span className="text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
            {formatDate(report.created_at)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize"
          style={getStatusStyle(report.status)}
        >
          {report.status}
        </span>
        <ChevronRight
          className="h-4 w-4 transition-colors"
          style={{ color: hovered ? 'var(--adm-fg)' : 'var(--adm-muted-fg)' }}
        />
      </div>
    </button>
  );
}

function ReportSection({
  title,
  reports,
  loading,
  page,
  totalPages,
  onLoadMore,
  loadingMore,
  onOpen,
  emptyMessage,
}: {
  title: string;
  reports: AdminReportSummary[];
  loading: boolean;
  page: number;
  totalPages: number;
  onLoadMore: () => void;
  loadingMore: boolean;
  onOpen: (id: string) => void;
  emptyMessage: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--adm-muted-fg)' }}
        >
          {title}
        </p>
        <span className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
          {reports.length} {reports.length === 1 ? 'report' : 'reports'}
        </span>
      </div>

      {loading ? (
        <div
          className="flex flex-col items-center justify-center py-12 space-y-3 rounded-2xl border"
          style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
        >
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--adm-primary)' }} />
          <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            Loading...
          </p>
        </div>
      ) : reports.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed p-6 space-y-2"
          style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
        >
          <Flag className="h-8 w-8 opacity-50" style={{ color: 'var(--adm-muted-fg)' }} />
          <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            {emptyMessage}
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id}>
                <ReportRow report={r} onOpen={onOpen} />
              </li>
            ))}
          </ul>
          {page < totalPages && (
            <div className="pt-1 text-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={onLoadMore}
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
        </>
      )}
    </div>
  );
}

export default function AdminReportsTab({ onOpenReport, onErrorToast }: AdminReportsTabProps) {
  const [openReports, setOpenReports] = useState<AdminReportSummary[]>([]);
  const [openPage, setOpenPage] = useState(1);
  const [openTotalPages, setOpenTotalPages] = useState(1);
  const [loadingOpen, setLoadingOpen] = useState(true);
  const [loadingMoreOpen, setLoadingMoreOpen] = useState(false);

  const [allReports, setAllReports] = useState<AdminReportSummary[]>([]);
  const [allPage, setAllPage] = useState(1);
  const [allTotalPages, setAllTotalPages] = useState(1);
  const [loadingAll, setLoadingAll] = useState(true);
  const [loadingMoreAll, setLoadingMoreAll] = useState(false);

  const loadOpenReports = useCallback(
    async (targetPage: number, append = false) => {
      if (append) setLoadingMoreOpen(true);
      else setLoadingOpen(true);
      try {
        const res = await fetchAdminReports(targetPage, PAGE_SIZE, 'pending');
        setOpenReports((prev) => (append ? [...prev, ...res.items] : res.items));
        setOpenPage(res.page);
        setOpenTotalPages(res.total_pages);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load open reports';
        onErrorToast(msg);
      } finally {
        setLoadingOpen(false);
        setLoadingMoreOpen(false);
      }
    },
    [onErrorToast],
  );

  const loadAllReports = useCallback(
    async (targetPage: number, append = false) => {
      if (append) setLoadingMoreAll(true);
      else setLoadingAll(true);
      try {
        const res = await fetchAdminReports(targetPage, PAGE_SIZE);
        setAllReports((prev) => (append ? [...prev, ...res.items] : res.items));
        setAllPage(res.page);
        setAllTotalPages(res.total_pages);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load reports';
        onErrorToast(msg);
      } finally {
        setLoadingAll(false);
        setLoadingMoreAll(false);
      }
    },
    [onErrorToast],
  );

  useEffect(() => {
    void loadOpenReports(1);
    void loadAllReports(1);
  }, [loadOpenReports, loadAllReports]);

  return (
    <div className="space-y-8">
      <ReportSection
        title="Open Reports"
        reports={openReports}
        loading={loadingOpen}
        page={openPage}
        totalPages={openTotalPages}
        onLoadMore={() => void loadOpenReports(openPage + 1, true)}
        loadingMore={loadingMoreOpen}
        onOpen={onOpenReport}
        emptyMessage="No open reports. All clear!"
      />

      <ReportSection
        title="All Reports"
        reports={allReports}
        loading={loadingAll}
        page={allPage}
        totalPages={allTotalPages}
        onLoadMore={() => void loadAllReports(allPage + 1, true)}
        loadingMore={loadingMoreAll}
        onOpen={onOpenReport}
        emptyMessage="No reports have been filed yet."
      />
    </div>
  );
}
