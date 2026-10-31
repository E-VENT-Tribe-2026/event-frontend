import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, ChevronRight, Calendar, MessageSquare, User as UserIcon, Users } from 'lucide-react';
import ReportFlag from '@/components/ReportFlag';
import { UserAvatar } from '@/components/UserAvatar';
import {
  fetchAdminReports,
  formatReportListTime,
  personDisplayName,
  reportedItemLabel,
  reportReasonLabel,
  reportStatusLabel,
  type AdminEventPerson,
  type AdminReportOrigin,
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

const MAGENTA_PILL: React.CSSProperties = {
  background: 'hsl(312 72% 46% / .22)',
  color: 'hsl(312 85% 82%)',
  borderColor: 'hsl(312 70% 55% / .4)',
};

const STATUS_STYLES: Record<AdminReportStatus, React.CSSProperties> = {
  open: MAGENTA_PILL,
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

const ORIGIN_META: Record<AdminReportOrigin, { label: string; Icon: typeof Calendar }> = {
  event_chat: { label: 'From event chat', Icon: MessageSquare },
  event_details: { label: 'From event page', Icon: Calendar },
  profile: { label: 'From profile', Icon: UserIcon },
};

function subjectPerson(report: AdminReportSummary): AdminEventPerson | null {
  if (report.target_type === 'event') return null;
  if (report.target_type === 'message') return report.message?.sender ?? report.reported_user;
  return report.reported_user;
}

function subjectTitle(report: AdminReportSummary): string {
  if (report.target_type === 'event') return report.event?.title || 'Unknown event';
  const person = subjectPerson(report);
  return person ? personDisplayName(person) : report.target_type === 'user' ? 'Unknown user' : 'Unknown user';
}

function typeLabel(report: AdminReportSummary): string {
  if (report.target_type === 'event') return 'Event';
  if (report.target_type === 'message') return 'Message';
  return 'User';
}

function ReportRow({ report, onOpen }: { report: AdminReportSummary; onOpen: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const item = reportedItemLabel(report);
  const title = subjectTitle(report);
  const reporter = report.reporter;
  const reporterName = reporter ? personDisplayName(reporter) : 'Deleted user';
  const origin = ORIGIN_META[report.origin];
  const OriginIcon = origin.Icon;

  return (
    <button
      type="button"
      onClick={() => onOpen(report.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Open report by ${reporterName} about ${item}`}
      className="group flex w-full items-center gap-3 rounded-[14px] border px-4 py-3 text-left transition-all active:scale-[0.99]"
      style={{
        background: hovered ? 'hsl(213 50% 17%)' : 'var(--adm-card)',
        borderColor: hovered ? 'hsl(271 76% 53% / .55)' : 'var(--adm-border)',
      }}
    >
      <UserAvatar
        src={reporter?.avatar_url}
        srcSecondary={reporter?.avatar_url}
        seed={reporter?.id || report.id}
        name={reporterName}
        size="md"
        alt={`Avatar of ${reporterName}`}
      />

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--adm-muted-fg)' }}>
          Reported by
        </p>
        <p className="truncate text-sm font-semibold" style={{ color: 'var(--adm-fg)' }}>
          {reporterName}
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
          {report.target_type === 'event' ? (
            <Users className="h-3 w-3 shrink-0" style={{ color: 'hsl(185 75% 72%)' }} />
          ) : report.target_type === 'message' ? (
            <MessageSquare className="h-3 w-3 shrink-0" style={{ color: 'hsl(185 75% 72%)' }} />
          ) : null}
          <span className="font-semibold uppercase tracking-wider" style={{ color: 'var(--adm-muted-fg)' }}>
            {typeLabel(report)}
          </span>
          <span className="truncate" style={{ color: 'var(--adm-fg)' }}>
            {title}
          </span>
        </p>
        {report.target_type === 'message' && report.message?.content ? (
          <p className="mt-0.5 truncate text-[11px] italic" style={{ color: 'var(--adm-fg)' }}>
            “{report.message.content}”
          </p>
        ) : null}
      </div>

      <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-x-2.5 gap-y-1">
        <span
          className="inline-flex max-w-[11rem] truncate rounded-full border px-2.5 py-0.5 text-[10px] font-semibold"
          style={MAGENTA_PILL}
        >
          {reportReasonLabel(report.reason)}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
          <OriginIcon className="h-3 w-3 shrink-0" />
          {origin.label}
        </span>
        <span className="tabular-nums text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
          {formatReportListTime(report.created_at)}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <ReportStatusPill status={report.status} />
        <ChevronRight
          className="h-4 w-4 transition-colors group-hover:text-[var(--adm-fg)]"
          style={{ color: 'var(--adm-muted-fg)' }}
        />
      </div>
    </button>
  );
}

function ReportSection({
  title,
  hint,
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
  hint?: string;
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
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
        <h2
          className="text-sm font-bold"
          style={{ color: 'var(--adm-fg)' }}
          data-testid={`${label}-count`}
        >
          {title} · {count}
        </h2>
        {hint && (
          <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            {hint}
          </p>
        )}
      </div>

      {loading ? (
        <div
          className="flex flex-col items-center justify-center space-y-3 rounded-2xl border py-10"
          style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
        >
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--adm-primary)' }} />
          <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            Loading...
          </p>
        </div>
      ) : reports.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-dashed p-6 py-8 text-center"
          style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
        >
          <ReportFlag className="h-8 w-8 opacity-70" />
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
          {hasMore && (
            <div className="pt-1 text-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={onLoadMore}
                className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
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
        hint="Reports not handled yet, newest first. Handling one moves it out of this list."
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
