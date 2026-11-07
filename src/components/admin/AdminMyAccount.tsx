import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Shield, ShieldCheck, Loader2, AlertCircle, UserPlus } from 'lucide-react';
import ReportFlag from '@/components/ReportFlag';
import {
  fetchAdminAccount,
  fetchAdminAudit,
  fetchAdminUserDetails,
  fetchAdminWorkReports,
  formatReportListTime,
  isOwnAuditEntry,
  reportedItemLabel,
  reportReasonLabel,
  type AdminAuditEntry,
  type AdminReportSummary,
  type AdminUserDetailsFull,
} from '@/lib/adminApi';
import { ActionPill, formatWhen, TargetCell } from '@/components/admin/AdminAuditTab';
import { ReportStatusPill } from '@/components/admin/AdminReportsTab';

interface AdminMyAccountProps {
  adminId: string;
  onClose: () => void;
  onOpenReport?: (reportId: string) => void;
  onOpenUser?: (userId: string) => void;
  onOpenEvent?: (eventId: string) => void;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return isoString;
  }
}

const ACTIVITY_PREVIEW = 5;

function mergeReportLists(primary: AdminReportSummary[], extra: AdminReportSummary[]): AdminReportSummary[] {
  const seen = new Set(primary.map((row) => row.id));
  const merged = [...primary];
  for (const row of extra) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

function AccountReportList({
  title,
  reports,
  onOpenReport,
}: {
  title: string;
  reports: AdminReportSummary[];
  onOpenReport?: (reportId: string) => void;
}) {
  if (reports.length === 0) return null;
  return (
    <div className="space-y-2" aria-label={title}>
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--adm-muted-fg)' }}>
        {title}
        <span className="ml-1.5 font-medium normal-case tracking-normal">· {reports.length}</span>
      </p>
      <ul className="space-y-2">
        {reports.map((report) => (
          <li key={report.id}>
            <button
              type="button"
              onClick={() => onOpenReport?.(report.id)}
              aria-label={`Open report: ${reportReasonLabel(report.reason)}`}
              className="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left"
              style={{ background: 'hsl(213 40% 18% / .55)', borderColor: 'var(--adm-border)' }}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold" style={{ color: 'var(--adm-fg)' }}>
                  {reportReasonLabel(report.reason)}
                </span>
                <span className="block truncate text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
                  {reportedItemLabel(report)}
                  {report.created_at ? ` · ${formatReportListTime(report.created_at)}` : ''}
                </span>
              </span>
              <ReportStatusPill status={report.status} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminMyAccount({
  adminId,
  onClose,
  onOpenReport,
  onOpenUser,
  onOpenEvent,
}: AdminMyAccountProps) {
  const [user, setUser] = useState<AdminUserDetailsFull | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  const [reportsClosed, setReportsClosed] = useState<number | null>(null);
  const [assignedReports, setAssignedReports] = useState<AdminReportSummary[]>([]);
  const [closedReports, setClosedReports] = useState<AdminReportSummary[]>([]);
  const [activity, setActivity] = useState<AdminAuditEntry[]>([]);
  const [activityBefore, setActivityBefore] = useState<string | null>(null);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const account = await fetchAdminAccount();
        let assigned = account.assigned_reports;
        let closed = account.closed_reports;
        if (adminId) {
          try {
            const extra = await fetchAdminWorkReports(adminId);
            assigned = mergeReportLists(assigned, extra.assigned);
            closed = mergeReportLists(closed, extra.closed);
          } catch {
            /* keep whatever /api/admin/account already returned */
          }
        }
        if (cancelled) return;
        setAssignedReports(assigned);
        setClosedReports(closed);
        setReportsClosed(account.reports_closed ?? (closed.length || null));
      } catch {
        if (!cancelled) {
          setReportsClosed(null);
          setAssignedReports([]);
          setClosedReports([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminId]);

  const mine = useCallback(
    (entry: AdminAuditEntry) =>
      isOwnAuditEntry(entry, {
        id: adminId,
        username: user?.username,
        name: user?.full_name,
      }),
    [adminId, user?.username, user?.full_name],
  );

  const loadActivity = useCallback(
    async (before: string | null, append = false) => {
      if (append) setActivityLoadingMore(true);
      else setActivityLoading(true);
      try {
        const page = await fetchAdminAudit(1, 20, before);
        const own = page.items.filter((entry) =>
          isOwnAuditEntry(entry, {
            id: adminId,
            username: user?.username,
            name: user?.full_name,
          }),
        );
        setActivity((prev) => {
          const combined = append ? [...prev, ...own] : own;
          return Array.from(new Map(combined.map((row) => [row.id, row])).values());
        });
        setActivityHasMore(page.has_more);
        setActivityBefore(page.next_before);
      } catch {
        if (!append) setActivity([]);
        setActivityHasMore(false);
        setActivityBefore(null);
      } finally {
        setActivityLoading(false);
        setActivityLoadingMore(false);
      }
    },
    [adminId, user?.username, user?.full_name],
  );

  useEffect(() => {
    void loadActivity(null);
  }, [loadActivity]);

  const myActivity = useMemo(() => activity.filter(mine), [activity, mine]);
  const visibleActivity = activityExpanded ? myActivity : myActivity.slice(0, ACTIVITY_PREVIEW);
  const activityCanSeeMore = myActivity.length > ACTIVITY_PREVIEW || activityHasMore;

  useEffect(() => {
    if (!adminId) {
      setLoading(false);
      setError('No admin ID available.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');

    fetchAdminUserDetails(adminId)
      .then((data) => {
        if (!cancelled) {
          setUser(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load account details');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adminId]);

  const initials = user?.full_name
    ? user.full_name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '';

  const avatarUrl = (user as AdminUserDetailsFull & { avatar_url?: string })?.avatar_url;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
        style={{ color: 'var(--adm-muted-fg)' }}
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
            Loading account details...
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
        <div
          className="rounded-[18px] border p-6 space-y-6"
          style={{
            background: 'var(--adm-card)',
            borderColor: 'var(--adm-border)',
            boxShadow: '0 4px 20px hsl(213 61% 5% / .5)',
          }}
        >
          {/* Top Profile Header */}
          <div className="flex items-center gap-4">
            {avatarUrl && !imgFailed ? (
              <img
                src={avatarUrl}
                alt={user.full_name}
                onError={() => setImgFailed(true)}
                className="shrink-0 rounded-full object-cover"
                style={{
                  width: 72,
                  height: 72,
                  boxShadow: 'var(--adm-shadow-glow)',
                  border: '2px solid var(--adm-border)',
                }}
              />
            ) : (
              <div
                className="flex shrink-0 items-center justify-center text-white"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'var(--adm-grad)',
                  fontSize: 24,
                  fontWeight: 700,
                  boxShadow: 'var(--adm-shadow-glow)',
                }}
              >
                {initials}
              </div>
            )}

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--adm-fg)' }}>
                  {user.full_name}
                </h2>
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: 'hsl(271 76% 53% / .18)',
                    color: 'var(--adm-primary-text)',
                    borderColor: 'hsl(271 76% 53% / .4)',
                  }}
                >
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </span>
              </div>
              {user.username && (
                <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                  @{user.username}
                </p>
              )}
            </div>
          </div>

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Administrator since card */}
            <div
              className="flex items-center gap-4 rounded-xl border p-4"
              style={{
                background: 'hsl(213 50% 15% / .6)',
                borderColor: 'var(--adm-border)',
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: 'hsl(271 76% 53% / .18)',
                  color: 'var(--adm-primary)',
                }}
              >
                <Shield className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold tracking-tight" style={{ color: 'var(--adm-fg)' }}>
                  {formatDate(user.created_at)}
                </p>
                <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                  Administrator since
                </p>
              </div>
            </div>

            {/* Reports closed card */}
            <div
              className="flex items-center gap-4 rounded-xl border p-4"
              style={{
                background: 'hsl(213 50% 15% / .6)',
                borderColor: 'var(--adm-border)',
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: 'hsl(271 76% 53% / .18)',
                  color: 'var(--adm-primary)',
                }}
              >
                <ReportFlag className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p
                  className="text-base font-bold tracking-tight"
                  style={{ color: 'var(--adm-fg)' }}
                  data-testid="reports-closed-count"
                >
                  {reportsClosed ?? '–'}
                </p>
                <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                  Reports closed by you
                </p>
              </div>
            </div>

            <div
              className="flex items-center gap-4 rounded-xl border p-4"
              style={{
                background: 'hsl(213 50% 15% / .6)',
                borderColor: 'var(--adm-border)',
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: 'hsl(191 90% 48% / .18)',
                  color: 'hsl(191 90% 70%)',
                }}
              >
                <UserPlus className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p
                  className="text-base font-bold tracking-tight"
                  style={{ color: 'var(--adm-fg)' }}
                  data-testid="reports-assigned-count"
                >
                  {assignedReports.length}
                </p>
                <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
                  Assigned to you
                </p>
              </div>
            </div>
          </div>

          <AccountReportList
            title="Assigned to you"
            reports={assignedReports}
            onOpenReport={onOpenReport}
          />
          <AccountReportList
            title="Closed by you"
            reports={closedReports}
            onOpenReport={onOpenReport}
          />

          <div className="space-y-2" aria-label="Your activity">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--adm-muted-fg)' }}>
              Activity
              <span className="ml-1.5 font-medium normal-case tracking-normal">· {myActivity.length}</span>
            </p>
            {activityLoading && myActivity.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border px-3 py-4 text-xs" style={{ borderColor: 'var(--adm-border)', color: 'var(--adm-muted-fg)' }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading activity...
              </div>
            ) : myActivity.length === 0 ? (
              <p className="rounded-xl border px-3 py-4 text-xs" style={{ borderColor: 'var(--adm-border)', color: 'var(--adm-muted-fg)' }}>
                No activity recorded for you yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {visibleActivity.map((entry) => {
                  const details = [entry.reason, entry.details].filter((value, index, all) => value && all.indexOf(value) === index).join(' · ');
                  return (
                    <li
                      key={entry.id}
                      className="rounded-xl border px-3 py-2.5 space-y-1.5"
                      style={{ background: 'hsl(213 40% 18% / .55)', borderColor: 'var(--adm-border)' }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] tabular-nums" style={{ color: 'var(--adm-muted-fg)' }}>
                          {formatWhen(entry.created_at)}
                        </span>
                        <ActionPill action={entry.action} />
                      </div>
                      <TargetCell
                        entry={entry}
                        onNavigateToUser={onOpenUser}
                        onNavigateToEvent={onOpenEvent}
                      />
                      {details ? (
                        <p className="break-words text-[12px] leading-snug" style={{ color: 'var(--adm-muted-fg)' }}>
                          {details}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {activityCanSeeMore || (activityExpanded && myActivity.length > ACTIVITY_PREVIEW) ? (
              <button
                type="button"
                disabled={activityLoadingMore}
                onClick={() => {
                  if (!activityExpanded && myActivity.length > ACTIVITY_PREVIEW) {
                    setActivityExpanded(true);
                    return;
                  }
                  if (activityHasMore) {
                    setActivityExpanded(true);
                    void loadActivity(activityBefore, true);
                    return;
                  }
                  setActivityExpanded(false);
                }}
                className="w-full rounded-xl py-2 text-xs font-semibold disabled:opacity-50"
                style={{ color: 'var(--adm-primary-text)' }}
              >
                {activityLoadingMore ? (
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading…
                  </span>
                ) : activityExpanded && !activityHasMore ? (
                  'See less'
                ) : (
                  'See more'
                )}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}