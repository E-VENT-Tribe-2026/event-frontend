import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ClipboardList, Loader2, Flag, Mail, MessageSquare, Calendar, Filter, X } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import {
  auditActionFilterKey,
  fetchAdminAudit,
  matchesAuditFilters,
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

const PILL = {
  muted: {
    background: 'hsl(215 20% 28% / .85)',
    color: 'hsl(210 20% 78%)',
    borderColor: 'transparent',
  },
  warn: {
    background: 'hsl(32 80% 42% / .35)',
    color: 'hsl(32 90% 72%)',
    borderColor: 'transparent',
  },
  danger: {
    background: 'hsl(350 70% 42% / .4)',
    color: 'hsl(350 90% 78%)',
    borderColor: 'transparent',
  },
  ok: {
    background: 'hsl(152 50% 28% / .45)',
    color: 'hsl(152 60% 72%)',
    borderColor: 'transparent',
  },
  accent: {
    background: 'hsl(271 50% 38% / .4)',
    color: 'hsl(271 80% 82%)',
    borderColor: 'transparent',
  },
} as const;

const ACTION_STYLES: Record<string, ActionStyle> = {
  warn: { label: 'Warned', style: PILL.warn },
  warned: { label: 'Warned', style: PILL.warn },
  suspend: { label: 'Suspended', style: PILL.danger },
  suspended: { label: 'Suspended', style: PILL.danger },
  lift: { label: 'Lifted suspension', style: PILL.ok },
  'lift-suspension': { label: 'Lifted suspension', style: PILL.ok },
  'lifted-suspension': { label: 'Lifted suspension', style: PILL.ok },
  remove: { label: 'Removed event', style: PILL.danger },
  dismiss: { label: 'Dismissed report', style: PILL.muted },
  'dismiss-report': { label: 'Dismissed report', style: PILL.muted },
  'dismissed-report': { label: 'Dismissed report', style: PILL.muted },
  'grant-admin': { label: 'Granted admin', style: PILL.accent },
  'withdraw-warning': { label: 'Withdrew warning', style: PILL.warn },
  'invite-user': { label: 'Invited user', style: PILL.accent },
  'registration-invite': { label: 'Invited user', style: PILL.accent },
};

const TABLE_COLS =
  'w-full grid-cols-[8rem_minmax(13rem,1.15fr)_minmax(10.5rem,max-content)_minmax(14rem,1.25fr)_minmax(16rem,1.7fr)] gap-x-10 gap-y-3';

const ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'warn', label: 'Warned' },
  { value: 'suspend', label: 'Suspended' },
  { value: 'lift-suspension', label: 'Lifted suspension' },
  { value: 'remove', label: 'Removed event' },
  { value: 'dismiss-report', label: 'Dismissed report' },
  { value: 'grant-admin', label: 'Granted admin' },
  { value: 'withdraw-warning', label: 'Withdrew warning' },
  { value: 'invite-user', label: 'Invited user' },
] as const;

function getActionStyle(action: string): ActionStyle {
  const key = auditActionFilterKey(action);
  if (ACTION_STYLES[key]) return ACTION_STYLES[key];
  return {
    label: action.replace(/[_-]+/g, ' '),
    style: PILL.muted,
  };
}

function ActionPill({ action }: { action: string }) {
  const s = getActionStyle(action);
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={s.style}
    >
      {s.label}
    </span>
  );
}

function auditDetails(entry: AdminAuditEntry): string | null {
  const reason = entry.reason?.trim() || '';
  const extra = entry.details?.trim() || '';
  if (reason && extra && extra !== reason && !reason.includes(extra)) {
    return `${reason} ${extra}`;
  }
  return reason || extra || null;
}

function formatWhen(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} · ${hh}:${mm}`;
  } catch {
    return isoString;
  }
}

function handleOf(username?: string | null): string | null {
  const value = username?.trim().replace(/^@/, '');
  return value || null;
}

function reportLabel(id?: string | null): string {
  if (!id) return 'Report';
  const trimmed = id.trim();
  if (/^r[-_]?\d+$/i.test(trimmed)) {
    return `Report ${trimmed.replace(/_/g, '-').replace(/^r/i, 'R')}`;
  }
  if (/^\d+$/.test(trimmed)) return `Report R-${trimmed}`;
  if (trimmed.length <= 16) return `Report ${trimmed}`;
  return 'Report';
}

function AuditPersonCell({
  id,
  name,
  username,
  avatarUrl,
  onClick,
}: {
  id: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  onClick?: () => void;
}) {
  const handle = handleOf(username);
  const inner = (
    <>
      <UserAvatar
        src={avatarUrl}
        seed={id || name}
        name={name}
        size="xs"
        className="ring-0"
      />
      <span className="min-w-0">
        <span className="block break-words text-[13px] font-semibold leading-tight" style={{ color: 'var(--adm-fg)' }}>
          {name}
        </span>
        {handle && (
          <span className="block break-all text-[11px] leading-tight" style={{ color: 'var(--adm-muted-fg)' }}>
            @{handle}
          </span>
        )}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 items-start gap-2.5 text-left"
      >
        {inner}
      </button>
    );
  }

  return <div className="flex min-w-0 items-start gap-2.5">{inner}</div>;
}

function isRegistrationInvite(action: string): boolean {
  const normalized = action.toLowerCase().replace(/[_]+/g, '-');
  return (
    normalized.includes('registration-invite') ||
    normalized.includes('signup-invite') ||
    normalized === 'invite-user'
  );
}

function looksLikeChat(entry: AdminAuditEntry): boolean {
  const type = (entry.target_type || '').toLowerCase();
  if (type.includes('chat') || type.includes('message')) return true;
  const blob = `${entry.reason ?? ''} ${entry.details ?? ''} ${entry.target_title ?? ''}`.toLowerCase();
  return type.includes('report') && blob.includes('chat');
}

function TargetIconBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'flag' | 'chat' | 'event' | 'mail';
}) {
  const styles = {
    flag: { background: 'hsl(32 80% 42% / .22)', color: 'hsl(32 90% 70%)' },
    chat: { background: 'hsl(199 80% 32% / .28)', color: 'hsl(199 90% 78%)' },
    event: { background: 'hsl(213 50% 32% / .4)', color: 'hsl(210 40% 85%)' },
    mail: { background: 'hsl(271 50% 38% / .28)', color: 'hsl(271 80% 82%)' },
  } as const;
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={styles[tone]}>
      {children}
    </span>
  );
}

function TargetCell({
  entry,
  onNavigateToUser,
  onNavigateToEvent,
}: {
  entry: AdminAuditEntry;
  onNavigateToUser?: (userId: string) => void;
  onNavigateToEvent?: (eventId: string) => void;
}) {
  const type = (entry.target_type || '').toLowerCase();
  const isReport = type.includes('report');
  const isUser = type === 'user';
  const isEvent = type === 'event';
  const chat = looksLikeChat(entry);

  if (isRegistrationInvite(entry.action) && entry.target_email) {
    return (
      <div className="flex min-w-0 items-start gap-2.5">
        <TargetIconBadge tone="mail">
          <Mail className="h-3.5 w-3.5" />
        </TargetIconBadge>
        <span className="min-w-0 break-all text-[13px] font-medium leading-snug" style={{ color: 'var(--adm-fg)' }}>
          {entry.target_email}
        </span>
      </div>
    );
  }

  if (chat) {
    return (
      <div className="flex min-w-0 items-start gap-2.5">
        <TargetIconBadge tone="chat">
          <MessageSquare className="h-3.5 w-3.5" />
        </TargetIconBadge>
        <span className="min-w-0">
          <span className="block break-words text-[13px] font-medium" style={{ color: 'var(--adm-fg)' }}>
            {entry.target_title || (isReport ? 'Reported chat' : 'Chat')}
          </span>
          {isReport && (
            <span className="block break-words text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
              {reportLabel(entry.target_id)}
            </span>
          )}
        </span>
      </div>
    );
  }

  if (isReport) {
    return (
      <div className="flex min-w-0 items-start gap-2.5">
        <TargetIconBadge tone="flag">
          <Flag className="h-3.5 w-3.5" />
        </TargetIconBadge>
        <span className="min-w-0">
          <span className="block break-words text-[13px] font-medium" style={{ color: 'var(--adm-fg)' }}>
            {entry.target_title || entry.target_name || reportLabel(entry.target_id)}
          </span>
          {(entry.target_title || entry.target_name) && (
            <span className="block break-words text-[11px]" style={{ color: 'var(--adm-muted-fg)' }}>
              {reportLabel(entry.target_id)}
            </span>
          )}
        </span>
      </div>
    );
  }

  if (isUser && (entry.target_name || entry.target_id)) {
    const go = onNavigateToUser && entry.target_id ? () => onNavigateToUser(entry.target_id!) : undefined;
    return (
      <AuditPersonCell
        id={entry.target_id || entry.target_name || 'user'}
        name={entry.target_name || 'User'}
        username={entry.target_username}
        avatarUrl={entry.target_avatar_url}
        onClick={go}
      />
    );
  }

  if (isEvent) {
    const label = entry.target_title || entry.target_name || 'Event';
    const inner = (
      <div className="flex min-w-0 items-start gap-2.5">
        <TargetIconBadge tone="event">
          <Calendar className="h-3.5 w-3.5" />
        </TargetIconBadge>
        <span className="break-words text-[13px] font-medium" style={{ color: 'var(--adm-fg)' }}>
          {label}
        </span>
      </div>
    );
    if (entry.target_id && onNavigateToEvent) {
      return (
        <button type="button" onClick={() => onNavigateToEvent(entry.target_id!)} className="min-w-0 text-left">
          {inner}
        </button>
      );
    }
    return inner;
  }

  if (entry.target_name || entry.target_title) {
    return (
      <span className="min-w-0 break-words text-[13px]" style={{ color: 'var(--adm-fg)' }}>
        {entry.target_name || entry.target_title}
      </span>
    );
  }

  return (
    <span className="text-[13px] italic" style={{ color: 'var(--adm-muted-fg)' }}>
      —
    </span>
  );
}

export default function AdminAuditTab({
  onNavigateToUser,
  onNavigateToEvent,
  onErrorToast,
}: AdminAuditTabProps) {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [adminFilter, setAdminFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const onErrorToastRef = useRef(onErrorToast);
  onErrorToastRef.current = onErrorToast;
  const requestIdRef = useRef(0);

  const filters = useMemo(
    () => ({
      admin: adminFilter,
      action: actionFilter,
      date: dateFilter,
    }),
    [adminFilter, actionFilter, dateFilter],
  );
  const filtersActive = Boolean(adminFilter.trim() || actionFilter || dateFilter);

  const filteredEntries = useMemo(
    () => (filtersActive ? entries.filter((entry) => matchesAuditFilters(entry, filters)) : entries),
    [entries, filters, filtersActive],
  );

  const administratorOptions = useMemo(() => {
    const names = new Set<string>();
    for (const entry of entries) {
      if (entry.admin_name.trim()) names.add(entry.admin_name.trim());
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const loadAudit = useCallback(async (before: string | null, append = false) => {
    const reqId = ++requestIdRef.current;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetchAdminAudit(1, PAGE_SIZE, before);
      if (reqId !== requestIdRef.current) return;
      setEntries((prev) => {
        const combined = append ? [...prev, ...res.items] : res.items;
        return Array.from(new Map(combined.map((row) => [row.id, row])).values());
      });
      setHasMore(res.has_more);
      setNextBefore(res.next_before);
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      const msg = err instanceof Error ? err.message : 'Failed to load audit log';
      onErrorToastRef.current(msg);
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadAudit(null);
  }, [loadAudit]);

  useEffect(() => {
    if (!filtersActive || loading || loadingMore || !hasMore || !nextBefore) return;
    if (entries.length >= 1000) return;
    void loadAudit(nextBefore, true);
  }, [filtersActive, loading, loadingMore, hasMore, nextBefore, entries.length, loadAudit]);

  const handleLoadMore = () => {
    if (hasMore && nextBefore && !loadingMore) {
      void loadAudit(nextBefore, true);
    }
  };

  const clearFilters = () => {
    setAdminFilter('');
    setActionFilter('');
    setDateFilter('');
  };

  const fieldCls = 'w-full rounded-xl border px-3 py-2 text-xs outline-none';
  const fieldStyle = {
    background: 'var(--adm-secondary)',
    borderColor: 'var(--adm-border)',
    color: 'var(--adm-fg)',
  } as const;
  const waitingForMatches = filtersActive && filteredEntries.length === 0 && (loading || loadingMore || hasMore);

  const headerCls = 'text-[11px] font-semibold uppercase tracking-wider';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--adm-muted-fg)' }}>
          Audit Log
        </p>
        <span className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
          {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
          {filtersActive && entries.length !== filteredEntries.length ? ` of ${entries.length}` : ''}
        </span>
      </div>

      <div
        className="rounded-[16px] border p-3 sm:p-4"
        style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--adm-muted-fg)' }}>
            <Filter className="h-3.5 w-3.5" />
            Filter
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ color: 'var(--adm-muted-fg)' }}
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--adm-muted-fg)' }}>
              Administrator
            </span>
            <input
              list="audit-admin-options"
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value)}
              placeholder="Name or @username"
              aria-label="Filter by administrator"
              className={fieldCls}
              style={fieldStyle}
            />
            <datalist id="audit-admin-options">
              {administratorOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--adm-muted-fg)' }}>
              Action
            </span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              aria-label="Filter by action"
              className={fieldCls}
              style={fieldStyle}
            >
              {ACTION_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--adm-muted-fg)' }}>
              Date
            </span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter by date"
              className={fieldCls}
              style={fieldStyle}
            />
          </label>
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center space-y-3 rounded-2xl border py-16"
          style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
        >
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--adm-primary)' }} />
          <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            Loading audit log...
          </p>
        </div>
      ) : waitingForMatches ? (
        <div
          className="flex flex-col items-center justify-center space-y-3 rounded-2xl border py-16"
          style={{ background: 'var(--adm-card)', borderColor: 'var(--adm-border)' }}
        >
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--adm-primary)' }} />
          <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            Looking for matching entries...
          </p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-dashed p-6 py-14 text-center"
          style={{ background: 'hsl(213 50% 15% / .5)', borderColor: 'var(--adm-border)' }}
        >
          <ClipboardList className="h-10 w-10 opacity-50" style={{ color: 'var(--adm-muted-fg)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--adm-fg)' }}>
            {filtersActive ? 'No matching audit entries' : 'No audit entries'}
          </p>
          <p className="text-xs" style={{ color: 'var(--adm-muted-fg)' }}>
            {filtersActive
              ? 'Try a different administrator, action, or date.'
              : 'Administrative actions will appear here.'}
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 text-xs font-semibold"
              style={{ color: 'var(--adm-primary)' }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div
          className="w-full overflow-hidden rounded-[16px] border"
          style={{ background: 'var(--adm-grad-card)', borderColor: 'var(--adm-border)' }}
        >
          <div
            className={`hidden ${TABLE_COLS} border-b px-5 py-2.5 md:grid`}
            style={{ background: 'hsl(213 40% 16% / .55)', borderBottomColor: 'var(--adm-border)' }}
          >
            <p className={headerCls} style={{ color: 'var(--adm-muted-fg)' }}>When</p>
            <p className={headerCls} style={{ color: 'var(--adm-muted-fg)' }}>Administrator</p>
            <p className={headerCls} style={{ color: 'var(--adm-muted-fg)' }}>Action</p>
            <p className={headerCls} style={{ color: 'var(--adm-muted-fg)' }}>Target</p>
            <p className={headerCls} style={{ color: 'var(--adm-muted-fg)' }}>Details</p>
          </div>

          <ul className="divide-y" style={{ borderColor: 'var(--adm-border)' }}>
            {filteredEntries.map((entry) => {
              const details = auditDetails(entry);
              return (
                <li key={entry.id} className="px-5 py-3.5" style={{ borderColor: 'var(--adm-border)' }}>
                  <div className="space-y-2 md:hidden">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] tabular-nums" style={{ color: 'var(--adm-muted-fg)' }}>
                        {formatWhen(entry.created_at)}
                      </span>
                      <ActionPill action={entry.action} />
                    </div>
                    <AuditPersonCell
                      id={entry.admin_id || entry.admin_name}
                      name={entry.admin_name}
                      username={entry.admin_username}
                      avatarUrl={entry.admin_avatar_url}
                      onClick={onNavigateToUser && entry.admin_id ? () => onNavigateToUser(entry.admin_id) : undefined}
                    />
                    <TargetCell
                      entry={entry}
                      onNavigateToUser={onNavigateToUser}
                      onNavigateToEvent={onNavigateToEvent}
                    />
                    {details && (
                      <p
                        className="break-words [overflow-wrap:anywhere] text-[12px] leading-snug"
                        data-testid="audit-reason"
                        style={{ color: 'var(--adm-muted-fg)' }}
                      >
                        {details}
                      </p>
                    )}
                  </div>

                  <div className={`hidden min-w-0 ${TABLE_COLS} items-start md:grid`}>
                    <p className="min-w-0 pt-1 text-[12px] tabular-nums leading-snug" style={{ color: 'var(--adm-muted-fg)' }}>
                      {formatWhen(entry.created_at)}
                    </p>
                    <AuditPersonCell
                      id={entry.admin_id || entry.admin_name}
                      name={entry.admin_name}
                      username={entry.admin_username}
                      avatarUrl={entry.admin_avatar_url}
                      onClick={onNavigateToUser && entry.admin_id ? () => onNavigateToUser(entry.admin_id) : undefined}
                    />
                    <div className="min-w-[10.5rem] pt-1">
                      <ActionPill action={entry.action} />
                    </div>
                    <div className="min-w-0">
                    <TargetCell
                      entry={entry}
                      onNavigateToUser={onNavigateToUser}
                      onNavigateToEvent={onNavigateToEvent}
                    />
                    </div>
                    {details ? (
                      <p
                        className="min-w-0 break-words [overflow-wrap:anywhere] pt-0.5 text-[12px] leading-snug"
                        data-testid="audit-reason"
                        style={{ color: 'hsl(210 16% 72%)' }}
                      >
                        {details}
                      </p>
                    ) : (
                      <span />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hasMore && !loading && (!filtersActive || entries.length >= 1000) && (
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
