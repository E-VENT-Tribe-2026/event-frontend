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

const REASON_STYLES: Record<string, string> = {
  spam: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  harassment: 'bg-red-500/15 text-red-400 border-red-500/30',
  inappropriate: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  misinformation: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  other: 'bg-muted text-muted-foreground border-border',
};

function getReasonStyle(reason: string): string {
  const key = reason.toLowerCase();
  return REASON_STYLES[key] ?? 'bg-muted text-muted-foreground border-border';
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  dismissed: 'bg-muted text-muted-foreground border-border',
  actioned: 'bg-green-500/15 text-green-400 border-green-500/30',
};

function getStatusStyle(status: string): string {
  return STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground border-border';
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
  return (
    <button
      type="button"
      onClick={() => onOpen(report.id)}
      aria-label={`View report for ${report.target_name}`}
      className="group w-full flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all hover:bg-secondary/40 hover:border-primary/40 active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{report.target_name}</p>
          <span className="text-[10px] text-muted-foreground font-medium">
            {report.target_type === 'event' ? 'Event' : 'User'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getReasonStyle(report.reason)}`}
          >
            {report.reason}
          </span>
          <span className="text-muted-foreground/40 text-[10px]">·</span>
          <span className="text-[11px] text-muted-foreground">by {report.reporter_name}</span>
          <span className="text-muted-foreground/40 text-[10px]">·</span>
          <span className="text-[11px] text-muted-foreground">{formatDate(report.created_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${getStatusStyle(report.status)}`}
        >
          {report.status}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
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
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
        <span className="text-xs text-muted-foreground">
          {reports.length} {reports.length === 1 ? 'report' : 'reports'}
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3 rounded-2xl border border-border/50 bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed border-border bg-card/50 p-6 space-y-2">
          <Flag className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">{emptyMessage}</p>
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
        </>
      )}
    </div>
  );
}

export default function AdminReportsTab({ onOpenReport, onErrorToast }: AdminReportsTabProps) {
  // Open reports
  const [openReports, setOpenReports] = useState<AdminReportSummary[]>([]);
  const [openPage, setOpenPage] = useState(1);
  const [openTotalPages, setOpenTotalPages] = useState(1);
  const [loadingOpen, setLoadingOpen] = useState(true);
  const [loadingMoreOpen, setLoadingMoreOpen] = useState(false);

  // All reports
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
      {/* Open Reports */}
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

      {/* All Reports */}
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
