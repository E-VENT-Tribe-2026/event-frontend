import { getApiUrl } from './api';
import { API_ENDPOINTS } from './apiUrls';
import { getAuthToken } from './auth';
import { getPendingAdminVerification } from './adminAuth';
import { displayChatContent } from './chatPayload';
import { getCurrentUser } from './storage';

export function isAdministratorRole(role: unknown): boolean {
  if (typeof role !== 'string') return false;
  const normalized = role.trim().toLowerCase();
  return normalized === 'administrator' || normalized === 'admin';
}

/** Backend may send `is_suspended`, `status: "suspended"`, or an open `suspension` object. */
export function isSuspendedAccount(user: {
  is_suspended?: boolean | null;
  status?: string | null;
  account_status?: string | null;
  suspension?: { lifted_at?: string | null } | null;
}): boolean {
  if (user.is_suspended === true) return true;
  const status = String(user.status ?? user.account_status ?? '').trim().toLowerCase();
  if (status === 'suspended') return true;
  return Boolean(user.suspension && !user.suspension.lifted_at);
}

function eventBuckets(
  value: AdminUserDetails['organized_events'] | undefined,
): AdminUserDetails['organized_events'] {
  return {
    upcoming: Array.isArray(value?.upcoming) ? value.upcoming : [],
    past: Array.isArray(value?.past) ? value.past : [],
    cancelled: Array.isArray(value?.cancelled) ? value.cancelled : [],
  };
}

export interface AdminCountsResponse {
  total_users: number;
  events?: {
    total: number;
    upcoming: number;
    past: number;
    cancelled: number;
  };
}

export interface AdminUserSummary {
  id: string;
  username: string | null;
  full_name: string;
  display_name?: string;
  avatar_url?: string | null;
  avatar_kind?: string;
  icon_id?: string | null;
  role: string;
  created_at: string;
  status?: string | null;
  is_suspended?: boolean;
  warnings_count?: number;
  is_pro?: boolean;
}

export interface AdminUsersResponse {
  items: AdminUserSummary[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AdminEventSummary {
  location: string;
  id: string;
  title: string;
  date: string;
  status: string;
  is_cancelled?: boolean;
}

export type AdminEventStatusFilter = 'all' | 'upcoming' | 'past' | 'cancelled';

/** Person shown on an event (organizer or participant). Picture, full name and username. */
export interface AdminEventPerson {
  id: string;
  username: string | null;
  full_name: string;
  display_name?: string;
  avatar_url?: string | null;
  avatar_kind?: string;
  icon_id?: string | null;
}

/** One row of GET /api/admin/events (lightweight shape). */
export interface AdminEventListItem {
  id: string;
  title: string;
  date: string;
  status: string;
  is_cancelled?: boolean;
  organizer: AdminEventPerson | null;
}

/**
 * A participant of an event. Declared once here: it covers the fields used by the
 * admin details page (status, created_at) and by the older detail view (joined_at).
 */
export interface AdminEventParticipant extends AdminEventPerson {
  status?: string;
  created_at?: string;
  joined_at?: string;
}

/** GET /api/admin/events/{id}: full event (also cancelled or ended) plus participants. */
export interface AdminEventDetails {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  start_datetime: string;
  end_datetime?: string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  cost?: number | null;
  max_capacity?: number | null;
  status: string;
  is_cancelled?: boolean;
  organizer: AdminEventPerson | null;
  participant_count?: number;
  participants?: AdminEventParticipant[];
}

export interface AdminUserDetails {
  id: string;
  username: string | null;
  full_name: string;
  avatar_url?: string | null;
  avatar_kind?: string;
  icon_id?: string | null;
  created_at: string;
  is_admin: boolean;
  role: string;
  organized_events: {
    upcoming: AdminEventSummary[];
    past: AdminEventSummary[];
    cancelled: AdminEventSummary[];
  };
  joined_events: {
    upcoming: AdminEventSummary[];
    past: AdminEventSummary[];
    cancelled: AdminEventSummary[];
  };
}

export interface GrantAdminResponse {
  message: string;
  user_id: string;
  role: string;
}

export interface AdminVerifyResponse {
  status: string;
  message: string;
  admin_id?: string;
}

// ---- Extended user details ----

export interface AdminUserWarning {
  id: string;
  reason: string;
  issued_at: string;
  issued_by: string;
}

export interface AdminUserSuspension {
  reason: string;
  suspended_at: string;
  suspended_by: string;
  lifted_at?: string | null;
}

export interface AdminUserDetailsFull extends AdminUserDetails {
  email?: string | null;
  status?: string | null;
  account_status?: string | null;
  is_suspended: boolean;
  suspension?: AdminUserSuspension | null;
  warnings: AdminUserWarning[];
}

// ---- Events ----

export interface AdminEventDetail {
  id: string;
  title: string;
  description?: string;
  category?: string;
  date: string;
  time?: string;
  location?: string;
  status: string;
  is_cancelled: boolean;
  is_private: boolean;
  requires_approval: boolean;
  organizer_id: string;
  organizer_name: string;
  organizer_avatar?: string | null;
  participants_limit?: number | null;
  participants: AdminEventParticipant[];
  created_at: string;
  reports_count?: number;
  /** #236: removed events stay visible to administrators, marked. */
  is_removed?: boolean;
  removed_at?: string | null;
  removed_by?: unknown;
  /** The event's chat (backend sends both names). */
  chats?: unknown;
  chat?: unknown;
}

export interface AdminEventSummaryFull {
  id: string;
  title: string;
  date: string;
  status: string;
  is_cancelled: boolean;
  is_private: boolean;
  organizer_id: string;
  organizer_name: string;
  participants_count: number;
  reports_count: number;
  created_at: string;
  category?: string;
}

/** Declared once: the previous duplicate declaration with a different `items` type is removed. */
export interface AdminEventsResponse {
  items: AdminEventSummaryFull[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ---- Audit log ----

export interface AdminAuditEntry {
  id: string;
  action: string;
  admin_id: string;
  admin_name: string;
  admin_username?: string | null;
  admin_avatar_url?: string | null;
  target_id?: string | null;
  target_type?: string | null;
  target_name?: string | null;
  target_username?: string | null;
  target_avatar_url?: string | null;
  target_email?: string | null;
  target_title?: string | null;
  details?: string | null;
  reason?: string | null;
  created_at: string;
}

export interface AdminAuditResponse {
  items: AdminAuditEntry[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_more: boolean;
  next_before: string | null;
}

export type AdminAuditFilters = {
  admin?: string;
  action?: string;
  date?: string;
};

export function localDateFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizeAuditAction(action: string): string {
  return action.trim().toLowerCase().replace(/_/g, '-');
}

export function auditActionFilterKey(action: string): string {
  const n = normalizeAuditAction(action);
  if (n.includes('dismiss')) return 'dismiss-report';
  if (n.includes('withdraw')) return 'withdraw-warning';
  if (n.includes('grant')) return 'grant-admin';
  if (n.includes('invite')) return 'invite-user';
  if (n.includes('remove')) return 'remove';
  if (n.includes('suspend') && !n.includes('lift')) return 'suspend';
  if (n.includes('lift')) return 'lift-suspension';
  if (n.includes('warn')) return 'warn';
  return n;
}

export function matchesAuditFilters(entry: AdminAuditEntry, filters: AdminAuditFilters): boolean {
  const adminQ = filters.admin?.trim().toLowerCase().replace(/^@/, '');
  if (adminQ) {
    const name = entry.admin_name.toLowerCase();
    const username = (entry.admin_username ?? '').toLowerCase().replace(/^@/, '');
    const id = entry.admin_id.toLowerCase();
    if (!name.includes(adminQ) && !username.includes(adminQ) && id !== adminQ) return false;
  }
  if (filters.action) {
    const wanted = auditActionFilterKey(filters.action);
    if (auditActionFilterKey(entry.action) !== wanted) return false;
  }
  if (filters.date && localDateFromIso(entry.created_at) !== filters.date) return false;
  return true;
}

export function isOwnAuditEntry(
  entry: AdminAuditEntry,
  admin: { id?: string; username?: string | null; name?: string | null },
): boolean {
  const keys = [admin.id, admin.username, admin.name]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return keys.some((key) => matchesAuditFilters(entry, { admin: key }));
}

// ---- Reports (#328) ----
//
// Backend contract (administrators only, never cached on the client):
// - GET  /api/admin/reports?status=open&page&limit   newest first; `total` is the number of reports
// - GET  /api/admin/reports/{id}                     AdminReportDetail
// - POST /api/admin/reports/{id}/assign              { admin_id }, caller or another administrator; 409 if taken
// - POST /api/admin/reports/{id}/dismiss             closes it as Dismissed, returns AdminReportDetail
// - POST /api/admin/reports/{id}/action              { action: warn | remove_content | suspend, reason? },
//                                                    closes it as resolved, returns AdminReportDetail
// - Dismiss is the only close that stays dismissed. Warn, suspend and remove_content resolve the report.
// - Detail.content_removed is live target state (event/message gone), not the report status.
// - Live updates: Supabase Realtime on the `reports` table for administrators; the panel only uses
//   the signal and fetches the count and the open list again.

export type AdminReportStatus = 'open' | 'dismissed' | 'resolved';
export type AdminReportTargetType = 'event' | 'user' | 'message';
export type AdminReportOrigin = 'event_details' | 'profile' | 'event_chat';
export type AdminReportOutcome = 'dismissed' | 'warned' | 'content_removed' | 'suspended';
export type AdminReportAction = 'warn' | 'remove' | 'suspend';

export interface AdminReportEventRef {
  id: string;
  title: string;
}

export interface AdminReportMessageRef {
  id: string;
  content: string;
  sender: AdminEventPerson | null;
}

export interface AdminReportSummary {
  id: string;
  status: AdminReportStatus;
  target_type: AdminReportTargetType;
  reason: string;
  origin: AdminReportOrigin;
  created_at: string;
  reporter: AdminEventPerson | null;
  /** The reported event, or the event whose chat the report was opened from. */
  event: AdminReportEventRef | null;
  reported_user: AdminEventPerson | null;
  message: AdminReportMessageRef | null;
  /** Administrator this open report is assigned to, if any. */
  assigned_to: AdminEventPerson | null;
  /** Administrator who dismissed or resolved the report. */
  closed_by: AdminEventPerson | null;
}

export interface AdminReportsResponse {
  items: AdminReportSummary[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AdminReportChatMessage {
  id: string;
  sender_name: string;
  content: string;
  created_at: string;
  reported: boolean;
}

export interface AdminReportDetail extends AdminReportSummary {
  description: string | null;
  chat_context: AdminReportChatMessage[];
  /** Live: the reported event or message is gone. Not the report status. */
  content_removed: boolean;
  /** Who warning and suspending apply to: the reported user, the message's sender or the event's organizer. */
  target_user: AdminEventPerson | null;
  /** That user is now an administrator. */
  target_user_is_admin: boolean;
  outcome: AdminReportOutcome | null;
  closed_at: string | null;
  closed_by: AdminEventPerson | null;
}

/** One report in a user's report history. */
export interface AdminUserReportRef {
  id: string;
  status: AdminReportStatus;
  reason: string;
  target_type: AdminReportTargetType;
  created_at: string;
  /** Set when the report is about an event (or a message in its chat). */
  event: AdminReportEventRef | null;
}

const REPORT_REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  inappropriate_content: 'Inappropriate content',
  harassment_or_hate: 'Harassment or hate',
  scam_or_fraud: 'Scam or fraud',
  misleading_event: 'Misleading event',
  other: 'Other',
};

export function reportReasonLabel(reason: string): string {
  return REPORT_REASON_LABELS[reason] ?? reason;
}

/** Warning text from what was reported, e.g. spam in chat → "User is spamming the group chat." */
export function warningReasonFromReport(report: {
  reason: string;
  target_type: AdminReportTargetType;
}): string {
  const n = normalizeToken(report.reason);
  if (n === 'spam') {
    if (report.target_type === 'message') return 'User is spamming the group chat.';
    if (report.target_type === 'event') return 'User is spamming events.';
    return 'User is spamming.';
  }
  if (n === 'inappropriate_content') return 'Inappropriate content.';
  if (n === 'harassment_or_hate' || n === 'harassment') return 'Harassment.';
  if (n === 'scam_or_fraud') return 'Scam or fraud.';
  if (n === 'misleading_event') return 'Misleading event.';
  return reportReasonLabel(report.reason);
}

export function reportStatusLabel(status: AdminReportStatus): string {
  return status === 'open' ? 'Open' : status === 'dismissed' ? 'Dismissed' : 'Resolved';
}

export function reportOriginLabel(origin: AdminReportOrigin): string {
  return origin === 'event_chat' ? 'Event chat' : origin === 'profile' ? 'User profile' : 'Event details';
}

export function reportOutcomeLabel(outcome: AdminReportOutcome | null): string {
  switch (outcome) {
    case 'dismissed':
      return 'Dismissed';
    case 'warned':
      return 'The user was warned';
    case 'content_removed':
      return 'The reported content was removed';
    case 'suspended':
      return 'The user was suspended';
    default:
      return 'Closed';
  }
}

export function formatReportTime(isoString: string): string {
  const d = new Date(isoString);
  if (!isoString || isNaN(d.getTime())) return isoString;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Compact list timestamp: `2026-10-06 · 09:12`. */
export function formatReportListTime(isoString: string): string {
  const d = new Date(isoString);
  if (!isoString || isNaN(d.getTime())) return isoString;
  const date = d.toLocaleDateString('en-CA');
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} · ${time}`;
}

/** What was reported, in a few words: the event, the user, or a message and its event. */
export function reportedItemLabel(report: AdminReportSummary): string {
  if (report.target_type === 'user') {
    return report.reported_user ? personDisplayName(report.reported_user) : 'Unknown user';
  }
  if (report.target_type === 'message') {
    const sender = report.message?.sender ? personDisplayName(report.message.sender) : 'a user';
    return report.event ? `Message by ${sender} in ${report.event.title}` : `Message by ${sender}`;
  }
  return report.event?.title ?? 'Unknown event';
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function readEventRef(value: unknown): AdminReportEventRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = asText(row.id) || asText(row.event_id);
  const title = asText(row.title) || asText(row.event_title) || asText(row.name);
  if (!id && !title) return null;
  return { id, title: title || 'Untitled event' };
}

/** Event on a report row: nested `event`, or event_id/title, or the target when the report is about an event. */
export function eventRefFromReportRow(
  row: Record<string, unknown>,
  targetType: AdminReportTargetType,
): AdminReportEventRef | null {
  const reported = asObject(row.reported);
  const nested =
    readEventRef(row.event) ??
    readEventRef(reported?.event) ??
    (targetType === 'event' ? readEventRef(row.target) ?? readEventRef(reported) : null);
  if (nested) return nested;
  const id =
    asText(row.event_id) ||
    (targetType === 'event' ? asText(row.target_id) || asText(row.reported_event_id) : '');
  const title =
    asText(row.event_title) ||
    asText(row.target_title) ||
    asText(row.reported_event_title) ||
    (targetType === 'event' ? asText(row.title) : '');
  if (!id && !title) return null;
  return { id, title: title || 'Untitled event' };
}

function unwrapReportPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  for (const key of ['report', 'data', 'item'] as const) {
    const nested = row[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested) && (nested as { id?: unknown }).id != null) {
      return nested as Record<string, unknown>;
    }
  }
  return row;
}

function normalizeToken(value: unknown): string {
  return asText(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function readOutcome(value: unknown): AdminReportOutcome | null {
  const n = normalizeToken(value);
  if (n === 'dismissed' || n === 'dismiss') return 'dismissed';
  if (n === 'warned' || n === 'warn') return 'warned';
  if (n === 'content_removed' || n === 'removed' || n === 'remove') return 'content_removed';
  if (n === 'suspended' || n === 'suspend') return 'suspended';
  return null;
}

function readStatus(value: unknown, row: Record<string, unknown> = {}): AdminReportStatus {
  const outcome = readOutcome(row.outcome ?? row.resolution ?? row.result);
  const n = normalizeToken(value ?? row.state ?? row.report_status ?? row.current_status);
  if (n === 'open' || n === 'pending' || n === 'new') return 'open';
  if (n === 'dismissed' || n === 'dismiss' || n === 'rejected') return 'dismissed';
  if (
    n === 'resolved' ||
    n === 'action_taken' ||
    n === 'actioned' ||
    n === 'handled' ||
    n === 'processed' ||
    n === 'closed' ||
    n === 'complete' ||
    n === 'completed'
  ) {
    return outcome === 'dismissed' ? 'dismissed' : 'resolved';
  }
  if (row.is_open === false || row.closed === true || row.is_closed === true || row.closed_at) {
    return outcome === 'dismissed' ? 'dismissed' : 'resolved';
  }
  if (outcome === 'dismissed') return 'dismissed';
  if (outcome) return 'resolved';
  return 'open';
}

function readTargetType(value: unknown): AdminReportTargetType {
  return value === 'user' || value === 'message' ? value : 'event';
}

function readOrigin(value: unknown): AdminReportOrigin {
  return value === 'profile' || value === 'event_chat' ? value : 'event_details';
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function personFromName(name: string, id = ''): AdminEventPerson | null {
  const full_name = name.trim();
  if (!full_name && !id) return null;
  return { id, username: null, full_name, avatar_url: null, icon_id: null };
}

function readMessageRef(row: Record<string, unknown>): AdminReportMessageRef | null {
  const reported = asObject(row.reported);
  const candidates = [row.message, reported?.message, reported, row.target, row.reported_message];
  for (const candidate of candidates) {
    const msg = asObject(candidate);
    if (!msg) continue;
    const typeHint = asText(msg.type) || asText(msg.target_type);
    const looksLikeMessage =
      typeHint === 'message' ||
      msg.content != null ||
      msg.text != null ||
      msg.body != null ||
      msg.sender != null ||
      msg.sender_name != null ||
      msg.message_id != null ||
      (msg.id != null && msg.event_id != null);
    if (!looksLikeMessage) continue;
    const content = displayChatContent(msg.content ?? msg.text ?? msg.body ?? msg.message);
    const sender =
      readPerson(msg.sender) ??
      readPerson(msg.user) ??
      readPerson(msg.author) ??
      readPerson(reported?.user) ??
      personFromName(asText(msg.sender_name) || asText(msg.sender_full_name), asText(msg.sender_id));
    const id = asText(msg.id) || asText(msg.message_id);
    if (content || sender || id) return { id, content, sender };
  }
  return null;
}

function readChatContext(row: Record<string, unknown>): AdminReportChatMessage[] {
  const reported = asObject(row.reported);
  const raw = [row.chat_context, row.messages, row.context, reported?.chat_context].find(Array.isArray);
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const c = asObject(m) ?? {};
    const sender = readPerson(c.sender) ?? readPerson(c.user);
    return {
      id: asText(c.id) || asText(c.message_id),
      sender_name: asText(c.sender_name) || personDisplayName(sender) || 'Unknown',
      content: displayChatContent(c.content ?? c.text ?? c.body),
      created_at: asText(c.created_at),
      reported: c.reported === true || c.is_reported === true,
    };
  });
}

function readReportSummary(value: unknown): AdminReportSummary {
  const row = unwrapReportPayload(value);
  const reported = asObject(row.reported);
  const targetType = readTargetType(row.target_type ?? reported?.type);
  return {
    id: asText(row.id),
    status: readStatus(row.status ?? row.state, row),
    target_type: targetType,
    reason: asText(row.reason),
    origin: readOrigin(row.origin),
    created_at: asText(row.created_at),
    reporter: readPerson(row.reporter),
    event: eventRefFromReportRow(row, targetType),
    reported_user: readPerson(row.reported_user) ?? readPerson(reported?.user),
    message: readMessageRef(row),
    assigned_to: readAssignee(row),
    closed_by:
      readNestedPerson(row.closed_by) ??
      readNestedPerson(row.resolved_by) ??
      readNestedPerson(row.closed_by_admin) ??
      readNestedPerson(row.handled_by) ??
      readNestedPerson(row.acted_by),
  };
}

function readReportDetail(value: unknown): AdminReportDetail {
  const row = unwrapReportPayload(value);
  const summary = readReportSummary(row);
  const chat_context = readChatContext(row);
  const flagged = chat_context.find((m) => m.reported) ?? chat_context[0];
  let message = summary.message;
  if (summary.target_type === 'message' && flagged) {
    const sender = message?.sender ?? personFromName(flagged.sender_name);
    message = {
      id: message?.id || flagged.id,
      content: message?.content || flagged.content,
      sender,
    };
  }
  const outcome = readOutcome(row.outcome) ?? (readStatus(row.status ?? row.state, row) === 'dismissed' ? 'dismissed' : null);
  return {
    ...summary,
    message,
    description: asText(row.description) || null,
    chat_context,
    content_removed: row.content_removed === true, // live target state, not status
    target_user: readPerson(row.target_user),
    target_user_is_admin: row.target_user_is_admin === true,
    outcome,
    closed_at: asText(row.closed_at) || null,
    closed_by: readPerson(row.closed_by),
  };
}

export function readUserReportRefs(value: unknown): AdminUserReportRef[] {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)
      ? ((value as { items: unknown[] }).items)
      : [];
  return rows
    .map((v) => {
      const row = (v ?? {}) as Record<string, unknown>;
      const target_type = readTargetType(row.target_type);
      return {
        id: asText(row.id),
        status: readStatus(row.status ?? row.state, row),
        reason: asText(row.reason),
        target_type,
        created_at: asText(row.created_at),
        event: eventRefFromReportRow(row, target_type),
      };
    })
    .filter((row) => Boolean(row.id));
}

function reportsMadeFromUserPayload(data: Record<string, unknown>): unknown {
  if (data.reports_made !== undefined) return data.reports_made;
  if (data.reportsMade !== undefined) return data.reportsMade;
  if (data.filed_reports !== undefined) return data.filed_reports;
  const nested = data.reports;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const group = nested as Record<string, unknown>;
    return group.made ?? group.filed ?? group.by_user ?? group.submitted;
  }
  return undefined;
}

function reportsAboutFromUserPayload(data: Record<string, unknown>): unknown {
  if (data.reports_about !== undefined) return data.reports_about;
  if (data.reportsAbout !== undefined) return data.reportsAbout;
  const nested = data.reports;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const group = nested as Record<string, unknown>;
    return group.about ?? group.against ?? group.on_user;
  }
  return undefined;
}

export function userReportListsFromDetails(data: unknown): {
  about: AdminUserReportRef[];
  made: AdminUserReportRef[];
  madeProvided: boolean;
} {
  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const madeRaw = reportsMadeFromUserPayload(row);
  return {
    about: readUserReportRefs(reportsAboutFromUserPayload(row)),
    made: readUserReportRefs(madeRaw),
    madeProvided: madeRaw !== undefined,
  };
}

export function reportSummaryToUserRef(report: AdminReportSummary): AdminUserReportRef {
  return {
    id: report.id,
    status: report.status,
    reason: report.reason,
    target_type: report.target_type,
    created_at: report.created_at,
    event: report.event,
  };
}

// ---- Content removal (#236 backend) ----

/** Who removed an event or a message, and when. */
export interface AdminRemovedState {
  is_removed: boolean;
  removed_at: string | null;
  removed_by: AdminEventPerson | null;
}

export interface AdminRemoveContentResponse {
  removed_at: string;
  removed_by: AdminEventPerson | null;
}

/** One message of an event chat as the panel shows it (removed messages stay, marked). */
export interface AdminChatMessage extends AdminRemovedState {
  id: string;
  sender: AdminEventPerson | null;
  content: string;
  created_at: string;
  is_system_message: boolean;
}

export function readChatMessages(value: unknown): AdminChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => {
    const row = (v ?? {}) as Record<string, unknown>;
    const sender =
      readPerson(row.sender) ??
      readPerson({
        id: row.sender_id,
        username: row.username,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        avatar_kind: row.avatar_kind,
        icon_id: row.icon_id,
      });
    return {
      id: asText(row.id),
      sender,
      content: displayChatContent(row.content ?? row.text ?? row.body ?? row.message),
      created_at: asText(row.created_at) || asText(row.time),
      is_system_message: row.is_system_message === true || row.type === 'notification',
      is_removed: row.is_removed === true,
      removed_at: asText(row.removed_at) || null,
      removed_by: readPerson(row.removed_by),
    };
  });
}

export function readRemovedState(value: unknown): AdminRemovedState {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    is_removed: row.is_removed === true || Boolean(row.removed_at),
    removed_at: asText(row.removed_at) || null,
    removed_by: readPerson(row.removed_by),
  };
}

// ---- Simple message responses ----

export interface AdminActionResponse {
  message: string;
}

export interface AdminWarnResponse {
  message: string;
  warning_id: string;
}

/**
 * Common headers for Admin API requests.
 * Explicitly enforces no-cache using fetch cache: 'no-store' to satisfy security requirement (exception to 11.1),
 * while keeping request headers within server CORS whitelist (Accept, Authorization).
 */
function getAdminHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function handleAdminResponse<T>(res: Response): Promise<T> {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => '');

  if (!res.ok) {
    // FastAPI sends `detail` as text, as { code, message }, or as a list of field errors.
    const detail = typeof body === 'object' && body ? (body as Record<string, unknown>).detail : undefined;
    const fromDetail =
      typeof detail === 'string'
        ? detail
        : detail && typeof detail === 'object' && !Array.isArray(detail)
          ? asText((detail as Record<string, unknown>).message)
          : Array.isArray(detail)
            ? asText((detail[0] as Record<string, unknown> | undefined)?.msg)
            : '';
    const errorMsg =
      fromDetail ||
      (typeof body === 'object' && body && asText((body as Record<string, unknown>).message || (body as Record<string, unknown>).error)) ||
      (typeof body === 'string' && body) ||
      `Request failed with status ${res.status}`;
    throw new Error(String(errorMsg));
  }

  return (body as T) ?? ({} as T);
}

/**
 * Checks whether the current session is an accepted administrator.
 * Calls GET /api/admin/verify or GET /api/auth/mfa/status.
 */
export async function checkAdminVerified(): Promise<{ isVerifiedAdmin: boolean; role?: string; adminId?: string }> {
  if (getPendingAdminVerification()) {
    console.debug('[AdminAuth] Admin status check skipped: pending MFA verification is active');
    return { isVerifiedAdmin: false };
  }
  const token = getAuthToken();
  if (!token) {
    console.debug('[AdminAuth] Admin status check skipped: no session token');
    return { isVerifiedAdmin: false };
  }

  const current = getCurrentUser();
  if (current && !isAdministratorRole(current.role)) {
    console.debug('[AdminAuth] Admin verify skipped: user role is not administrator');
    return { isVerifiedAdmin: false };
  }

  try {
    const res = await fetch(getApiUrl(API_ENDPOINTS.ADMIN_VERIFY), {
      method: 'GET',
      headers: getAdminHeaders(),
      cache: 'no-store',
    });

    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as AdminVerifyResponse;
      console.log('[AdminAuth] Verified administrator status confirmed (200 OK)');
      return { isVerifiedAdmin: true, role: 'administrator', adminId: data.admin_id };
    }

    // If /api/admin/verify returns 404 (endpoint not deployed on legacy backend), fallback to MFA status endpoint
    if (res.status === 404) {
      const mfaRes = await fetch(getApiUrl(API_ENDPOINTS.MFA_STATUS), {
        method: 'GET',
        headers: getAdminHeaders(),
        cache: 'no-store',
      });
      if (mfaRes?.ok) {
        const mfaData = (await mfaRes.json().catch(() => ({}))) as {
          is_admin?: boolean;
          role?: string;
          is_verified?: boolean;
        };
        const isVerifiedAdmin = Boolean(mfaData.is_admin && mfaData.is_verified);
        if (isVerifiedAdmin) {
          console.log('[AdminAuth] Verified administrator confirmed via /api/auth/mfa/status');
          return { isVerifiedAdmin: true, role: mfaData.role || 'administrator' };
        }
      }
    }

    console.debug(`[AdminAuth] User is not a verified administrator (verify endpoint status: ${res.status})`);
    return { isVerifiedAdmin: false };
  } catch (err) {
    console.error('[AdminAuth] Error checking admin status:', err);
    return { isVerifiedAdmin: false };
  }
}

/**
 * Fetches user & event counts for the admin panel.
 * Never cached client-side.
 */
export async function fetchAdminCounts(): Promise<AdminCountsResponse> {
  const res = await fetch(getApiUrl(API_ENDPOINTS.ADMIN_COUNTS), {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminCountsResponse>(res);
}

/**
 * Fetches paginated users with optional case-insensitive search by username.
 * Never cached client-side.
 */
export async function fetchAdminUsers(
  page = 1,
  limit = 20,
  search?: string,
): Promise<AdminUsersResponse> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (search?.trim()) {
    params.set('search', search.trim());
  }

  const url = `${getApiUrl(API_ENDPOINTS.ADMIN_USERS)}?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  const body = await handleAdminResponse<AdminUsersResponse>(res);
  return {
    ...body,
    items: (body.items ?? []).map((item) => ({
      ...item,
      is_suspended: isSuspendedAccount(item),
    })),
  };
}

/**
 * Fetches detailed info for a single user, including creation date and organized/joined events.
 * Never cached client-side.
 */
export async function fetchAdminUserDetails(userId: string): Promise<AdminUserDetailsFull> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_USER_DETAIL(userId));
  const res = await fetch(url, {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  const data = await handleAdminResponse<AdminUserDetailsFull>(res);
  return {
    ...data,
    is_suspended: isSuspendedAccount(data),
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    organized_events: eventBuckets(data.organized_events),
    joined_events: eventBuckets(data.joined_events),
  };
}

function isAdminUserSummary(user: AdminUserSummary): boolean {
  return isAdministratorRole(user.role) || (user.role ?? '').toLowerCase().includes('admin');
}

/** Administrators available to assign a report to. GET /api/admin/users, filtered. */
export async function fetchAdministrators(): Promise<AdminEventPerson[]> {
  const seen = new Set<string>();
  const admins: AdminEventPerson[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await fetchAdminUsers(page, 50);
    totalPages = Math.max(1, res.total_pages || 1);
    for (const user of res.items) {
      if (!isAdminUserSummary(user) || !user.id || seen.has(user.id)) continue;
      seen.add(user.id);
      admins.push({
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        avatar_kind: user.avatar_kind,
        icon_id: user.icon_id,
      });
    }
    page += 1;
  } while (page <= totalPages && page <= 10);
  return admins;
}

/**
 * Promotes a user account to the administrator role.
 * Never cached client-side.
 */
export async function grantAdminRole(userId: string): Promise<GrantAdminResponse> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_GRANT_ROLE(userId));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...getAdminHeaders(),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  return handleAdminResponse<GrantAdminResponse>(res);
}

function warningRowsFromBody(body: unknown): AdminUserWarning[] {
  if (Array.isArray(body)) return body as AdminUserWarning[];
  if (!body || typeof body !== 'object') return [];
  const row = body as Record<string, unknown>;
  const nested = row.warnings ?? row.items ?? row.data;
  return Array.isArray(nested) ? (nested as AdminUserWarning[]) : [];
}

/**
 * GET /api/admin/users/{user_id}/warnings
 */
export async function fetchUserWarnings(userId: string): Promise<AdminUserWarning[]> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_USER_WARNINGS(userId));
  const res = await fetch(url, {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  const body = await handleAdminResponse<unknown>(res);
  return warningRowsFromBody(body);
}

/**
 * POST /api/admin/users/{user_id}/warnings
 */
export async function warnUser(userId: string, reason: string): Promise<AdminWarnResponse> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_USER_WARN(userId));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...getAdminHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminWarnResponse>(res);
}

/**
 * POST /api/admin/warnings/{warning_id}/withdraw
 */
export async function withdrawWarning(_userId: string, warningId: string): Promise<AdminActionResponse> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_WARNING_WITHDRAW(warningId));
  const res = await fetch(url, {
    method: 'POST',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminActionResponse>(res);
}

/**
 * Suspends a user account.
 */
export async function suspendUser(userId: string, reason: string): Promise<AdminActionResponse> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_USER_SUSPEND(userId));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...getAdminHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminActionResponse>(res);
}

/**
 * Lifts a suspension from a user account. A reason is required for the audit log.
 */
export async function liftSuspension(userId: string, reason: string): Promise<AdminActionResponse> {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error('A reason is required to lift a suspension.');
  }
  const url = getApiUrl(API_ENDPOINTS.ADMIN_USER_LIFT(userId));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...getAdminHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: trimmed }),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminActionResponse>(res);
}

/**
 * Fetches paginated events for the admin panel.
 * GET /api/admin/events?status_filter=&page=&limit=&search=
 */
export async function fetchAdminEvents(
  statusFilter: AdminEventStatusFilter = 'all',
  page = 1,
  limit = 20,
  search?: string,
  catParam?: string,
): Promise<AdminEventsResponse> {
  const params = new URLSearchParams();
  params.set('status_filter', statusFilter);
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (typeof search === 'string' && search.trim()) {
    params.set('search', search.trim());
  }
  if (typeof catParam === 'string' && catParam.trim()) {
    params.set('category', catParam.trim());
  }
  const url = `${getApiUrl(API_ENDPOINTS.ADMIN_EVENTS)}?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminEventsResponse>(res);
}

/**
 * Fetches detailed info for a single event, including participants.
 * (Older shape. The admin details page uses fetchAdminEventDetails below.)
 */
export async function fetchAdminEventDetail(eventId: string): Promise<AdminEventDetail> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_EVENT_DETAIL(eventId));
  const res = await fetch(url, {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminEventDetail>(res);
}

/**
 * Fetches the full event for the admin details page: the event itself
 * (also cancelled or ended), its organizer and its participants.
 * GET /api/admin/events/{id}
 */
export async function fetchAdminEventDetails(eventId: string): Promise<AdminEventDetails> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_EVENT_DETAIL(eventId));
  const res = await fetch(url, {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminEventDetails>(res);
}

async function postRemoval(url: string): Promise<AdminRemoveContentResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  const body = await handleAdminResponse<Record<string, unknown>>(res);
  return { removed_at: asText(body.removed_at), removed_by: readPerson(body.removed_by) };
}

/**
 * Marks an event as removed. It is never deleted: administrators still see it, marked.
 * POST /api/admin/events/{id}/remove
 */
export function removeEvent(eventId: string): Promise<AdminRemoveContentResponse> {
  return postRemoval(getApiUrl(API_ENDPOINTS.ADMIN_EVENT_REMOVE(eventId)));
}

/**
 * Marks a chat message as removed. Administrators still see its text, marked as removed.
 * POST /api/admin/events/{eventId}/messages/{messageId}/remove
 */
export function removeChatMessage(eventId: string, messageId: string): Promise<AdminRemoveContentResponse> {
  return postRemoval(getApiUrl(API_ENDPOINTS.ADMIN_MESSAGE_REMOVE(eventId, messageId)));
}

function readAccountReportList(value: unknown): AdminReportSummary[] {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { items?: unknown[] }).items)
      ? ((value as { items: unknown[] }).items)
      : [];
  return rows.map(readReportSummary).filter((row) => Boolean(row.id));
}

export interface AdminAccount {
  reports_closed: number | null;
  assigned_reports: AdminReportSummary[];
  closed_reports: AdminReportSummary[];
}

function sameAdmin(person: AdminEventPerson | null | undefined, adminId: string): boolean {
  if (!person || !adminId.trim()) return false;
  const wanted = adminId.trim().toLowerCase().replace(/^@/, '');
  return [person.id, person.username, person.full_name, person.display_name]
    .map((value) => value?.trim().toLowerCase().replace(/^@/, ''))
    .some((value) => value === wanted);
}

export function reportAssignedToCaller(
  report: { assigned_to?: AdminEventPerson | null },
  adminId?: string,
): boolean {
  const id = (adminId ?? getCurrentUser()?.id ?? '').trim();
  return sameAdmin(report.assigned_to, id);
}

export function reportActionAssignmentError(
  report: { assigned_to?: AdminEventPerson | null },
  adminId?: string,
): string | null {
  if (reportAssignedToCaller(report, adminId)) return null;
  return report.assigned_to
    ? 'This report is already assigned to someone else.'
    : 'Assign this report to yourself before taking action.';
}

async function collectAllReportsForTab(tab: AdminReportTab, maxPages = 20): Promise<AdminReportSummary[]> {
  const first = await fetchAdminReportsList(1, 50, tab);
  const items = [...first.items];
  const pages = Math.min(Math.max(1, first.total_pages || 1), maxPages);
  for (let page = 2; page <= pages; page++) {
    const next = await fetchAdminReportsList(page, 50, tab);
    for (const row of next.items) {
      if (!items.some((item) => item.id === row.id)) items.push(row);
    }
  }
  return items;
}

/** Open reports assigned to this administrator, and every report they closed. */
export async function fetchAdminWorkReports(adminId: string): Promise<{
  assigned: AdminReportSummary[];
  closed: AdminReportSummary[];
}> {
  const id = adminId.trim();
  if (!id) return { assigned: [], closed: [] };
  const tabs = await Promise.all(
    (['open', 'dismissed', 'closed'] as AdminReportTab[]).map(async (tab) => {
      try {
        return await collectAllReportsForTab(tab);
      } catch {
        return [] as AdminReportSummary[];
      }
    }),
  );
  const seenAssigned = new Set<string>();
  const seenClosed = new Set<string>();
  const assigned: AdminReportSummary[] = [];
  const closed: AdminReportSummary[] = [];
  for (const row of tabs.flat()) {
    if (row.status === 'open' && sameAdmin(row.assigned_to, id) && !seenAssigned.has(row.id)) {
      seenAssigned.add(row.id);
      assigned.push(row);
    }
    const closedBySelf = sameAdmin(row.closed_by, id) || (!row.closed_by && sameAdmin(row.assigned_to, id));
    if (row.status !== 'open' && closedBySelf && !seenClosed.has(row.id)) {
      seenClosed.add(row.id);
      closed.push(row);
    }
  }
  return { assigned, closed };
}

/** GET /api/admin/account: the signed-in administrator, closed count, and report lists when present. */
export async function fetchAdminAccount(): Promise<AdminAccount> {
  const res = await fetch(getApiUrl(API_ENDPOINTS.ADMIN_ACCOUNT), {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  const body = await handleAdminResponse<Record<string, unknown>>(res);
  const assigned_reports = readAccountReportList(
    body.assigned_reports ?? body.reports_assigned ?? body.assigned,
  );
  const closedFromBody = readAccountReportList(
    body.closed_reports ?? (Array.isArray(body.reports_closed) ? body.reports_closed : body.reports_closed_list),
  );
  const reports_closed =
    typeof body.reports_closed === 'number'
      ? body.reports_closed
      : closedFromBody.length
        ? closedFromBody.length
        : null;
  return { reports_closed, assigned_reports, closed_reports: closedFromBody };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_COMPACT_RE = /^[0-9a-f]{32}$/i;

export function looksLikeUuid(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return UUID_RE.test(text) || UUID_COMPACT_RE.test(text);
}

/** Visible audit label: never a raw guid. */
export function humanAuditLabel(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || looksLikeUuid(text)) return null;
  return text;
}

function readNestedPerson(value: unknown): AdminEventPerson | null {
  const direct = readPerson(value);
  if (direct) return direct;
  const row = asObject(value);
  if (!row) return null;
  return (
    readPerson(row.administrator) ??
    readPerson(row.admin) ??
    readPerson(row.user) ??
    readPerson(row.person) ??
    readPerson(row.profile)
  );
}

function readPerson(value: unknown): AdminEventPerson | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const id = asId(row.id) || asId(row.user_id) || asId(row.admin_id) || '';
  const username = humanAuditLabel(row.username);
  const full_name = humanAuditLabel(row.full_name) || humanAuditLabel(row.name) || '';
  const display_name = humanAuditLabel(row.display_name) || undefined;
  if (!id && !full_name && !username && !display_name) return null;
  return {
    id,
    username,
    full_name,
    display_name,
    avatar_url:
      typeof row.avatar_url === 'string'
        ? row.avatar_url
        : typeof row.avatar === 'string'
          ? row.avatar
          : null,
    avatar_kind: typeof row.avatar_kind === 'string' ? row.avatar_kind : undefined,
    icon_id: typeof row.icon_id === 'string' ? row.icon_id : null,
  };
}

function readAssignee(row: Record<string, unknown>): AdminEventPerson | null {
  const nested =
    readNestedPerson(row.assigned_to) ??
    readNestedPerson(row.assignee) ??
    readNestedPerson(row.assigned_admin) ??
    readNestedPerson(row.assigned_to_admin);
  if (nested) return nested;
  const id =
    asText(row.assigned_to_id) ||
    asText(row.assigned_admin_id) ||
    asText(row.assignee_id) ||
    (typeof row.assigned_to === 'string' ? row.assigned_to : '');
  if (!id) return null;
  return { id, full_name: asText(row.assigned_to_name), username: asText(row.assigned_to_username) || null };
}

export function personDisplayName(
  person: { full_name?: string | null; display_name?: string | null; username?: string | null } | null | undefined,
): string {
  if (!person) return '';
  const full = person.full_name?.trim();
  if (full) return full;
  const display = person.display_name?.trim();
  if (display) return display;
  const username = person.username?.trim().replace(/^@/, '');
  return username || '';
}

function asId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function readTitle(value: unknown): string | null {
  if (typeof value === 'string') return humanAuditLabel(value);
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return (
      readTitle(row.title) ||
      readTitle(row.event_title) ||
      readTitle(row.name) ||
      readTitle(row.event)
    );
  }
  return null;
}

function firstEmail(...chunks: unknown[]): string | null {
  const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  for (const chunk of chunks) {
    if (typeof chunk === 'string') {
      const prefixed = chunk.match(/email\s*[:=]\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
      if (prefixed?.[1]) return prefixed[1];
      const match = chunk.match(EMAIL);
      if (match) return match[0];
      continue;
    }
    if (Array.isArray(chunk)) {
      const nested = firstEmail(...chunk);
      if (nested) return nested;
      continue;
    }
    if (chunk && typeof chunk === 'object') {
      const row = chunk as Record<string, unknown>;
      if (typeof row.email === 'string' && row.email.includes('@')) return row.email.trim();
    }
  }
  return null;
}

function scrubAuditGuids(text: string): string {
  if (!text) return '';
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  return text
    .replace(new RegExp(`\\b[\\w-]+\\s*[:=]\\s*${uuid}`, 'gi'), ' ')
    .replace(UUID_RE, ' ')
    .replace(/\s*[·,;:]\s*$/g, '')
    .replace(/^\s*[·,;:]\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function labeledDetail(details: string[], keys: string[]): string | null {
  for (const item of details) {
    for (const key of keys) {
      const match = item.match(new RegExp(`(?:^|[\\s,;])${key}\\s*[:=]\\s*(.+)$`, 'i'));
      const value = humanAuditLabel(match?.[1]);
      if (value) return value;
    }
  }
  return null;
}

function mapAuditEntry(raw: unknown, index: number): AdminAuditEntry {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const admin = readPerson(row.administrator ?? row.admin ?? row.actor);
  const targetObj = row.target && typeof row.target === 'object' ? (row.target as Record<string, unknown>) : null;
  const eventObj =
    (targetObj?.event && typeof targetObj.event === 'object' ? (targetObj.event as Record<string, unknown>) : null) ||
    (row.event && typeof row.event === 'object' ? (row.event as Record<string, unknown>) : null);
  const targetUser =
    readPerson(targetObj?.user) ??
    readPerson(row.target_user) ??
    readPerson(row.user) ??
    readPerson(targetObj?.type === 'user' || !targetObj?.type ? targetObj : null);

  const admin_id = admin?.id || asId(row.admin_id) || '';
  const admin_username =
    humanAuditLabel(admin?.username) || humanAuditLabel(row.admin_username) || null;
  const admin_name =
    humanAuditLabel(personDisplayName(admin)) ||
    humanAuditLabel(row.admin_name) ||
    admin_username ||
    'Unknown administrator';

  const target_id =
    asId(targetObj?.id) ||
    asId(targetUser?.id) ||
    asId(eventObj?.id) ||
    asId(row.target_id) ||
    asId(row.event_id) ||
    asId(row.user_id);
  const target_type =
    (typeof targetObj?.type === 'string' ? targetObj.type : null) ||
    (typeof row.target_type === 'string' ? row.target_type : null);
  const description = typeof row.description === 'string' ? row.description.trim() : '';
  const reasonFlat = typeof row.reason === 'string' ? row.reason.trim() : '';
  const detailsList = Array.isArray(row.details)
    ? row.details.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : typeof row.details === 'string' && row.details.trim()
      ? [row.details.trim()]
      : [];

  const target_name =
    humanAuditLabel(personDisplayName(targetUser)) ||
    humanAuditLabel(row.target_name) ||
    humanAuditLabel(row.user_name) ||
    labeledDetail(detailsList, ['user', 'username', 'name']) ||
    null;
  const target_title =
    readTitle(eventObj) ||
    readTitle(targetObj?.chat) ||
    readTitle(row.event) ||
    humanAuditLabel(row.target_title) ||
    humanAuditLabel(row.event_title) ||
    labeledDetail(detailsList, ['title', 'event', 'event_title']) ||
    (target_type === 'event' ? readTitle(targetObj) : null) ||
    null;

  const detailsJoined = scrubAuditGuids(detailsList.join(' · '));
  const reasonText = scrubAuditGuids(reasonFlat || description);
  const target_email =
    firstEmail(
      targetObj,
      targetUser,
      row.target_email,
      row.email,
      description,
      reasonFlat,
      ...detailsList,
    ) || null;

  return {
    id: typeof row.id === 'string' && row.id ? row.id : `audit-${index}`,
    action: typeof row.action === 'string' ? row.action : '',
    admin_id,
    admin_name,
    admin_username,
    admin_avatar_url: admin?.avatar_url ?? null,
    target_id,
    target_type,
    target_name,
    target_username: humanAuditLabel(targetUser?.username) || humanAuditLabel(row.target_username) || null,
    target_avatar_url: targetUser?.avatar_url ?? null,
    target_email,
    target_title,
    reason: reasonText || null,
    details: detailsJoined || null,
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
  };
}

/**
 * GET /api/admin/audit-log — cursor-paginated (`before` / `next_before`).
 */
export async function fetchAdminAudit(
  page = 1,
  limit = 20,
  before?: string | null,
): Promise<AdminAuditResponse> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (before) params.set('before', before);
  const url = `${getApiUrl(API_ENDPOINTS.ADMIN_AUDIT)}?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  const body = await handleAdminResponse<
    AdminAuditResponse & { entries?: unknown[]; data?: unknown[]; items?: unknown[] }
  >(res);
  const rawItems = Array.isArray(body.items)
    ? body.items
    : Array.isArray(body.entries)
      ? body.entries
      : Array.isArray(body.data)
        ? body.data
        : [];
  const items = rawItems.map((entry, index) => mapAuditEntry(entry, index));
  const hasMore = body.has_more === true;
  const nextBefore = typeof body.next_before === 'string' ? body.next_before : null;
  return {
    items,
    total: Number(body.total ?? items.length),
    page: Number(body.page ?? page),
    limit: Number(body.limit ?? limit),
    total_pages: Number(body.total_pages ?? (hasMore ? page + 1 : Math.max(page, 1))),
    has_more: hasMore,
    next_before: nextBefore,
  };
}

export type AdminReportListStatus = 'open' | 'dismissed' | 'closed' | 'resolved';

/**
 * One page of reports, newest first. `status` keeps open, dismissed and closed lists apart;
 * the response's `total` is the number of reports in that list.
 * GET /api/admin/reports?status=&page=&limit=
 */
export async function fetchAdminReports(
  page = 1,
  limit = 20,
  status?: AdminReportListStatus,
  filters?: { reporterId?: string },
): Promise<AdminReportsResponse> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (status) params.set('status', status);
  if (filters?.reporterId) params.set('reporter_id', filters.reporterId);
  const url = `${getApiUrl(API_ENDPOINTS.ADMIN_REPORTS)}?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  const body = await handleAdminResponse<Record<string, unknown>>(res);
  const items = Array.isArray(body.items) ? body.items.map(readReportSummary) : [];
  const total = typeof body.total === 'number' ? body.total : items.length;
  const pageNo = typeof body.page === 'number' ? body.page : page;
  return {
    items,
    total,
    page: pageNo,
    limit: typeof body.limit === 'number' ? body.limit : limit,
    total_pages: typeof body.total_pages === 'number' ? body.total_pages : pageNo,
  };
}

function mergeReportPages(pages: AdminReportsResponse[], page: number, limit: number): AdminReportsResponse {
  const seen = new Set<string>();
  const items: AdminReportSummary[] = [];
  for (const part of pages) {
    for (const row of part.items) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      items.push(row);
    }
  }
  const total = pages.reduce((sum, part) => sum + part.total, 0);
  const totalPages = Math.max(1, ...pages.map((part) => part.total_pages), page);
  return { items, total, page, limit, total_pages: totalPages };
}

/** Closed tab: action taken (`closed`) and backend `resolved` reports. */
export async function fetchClosedAdminReports(page = 1, limit = 20): Promise<AdminReportsResponse> {
  const [closed, resolved] = await Promise.all([
    fetchAdminReports(page, limit, 'closed'),
    fetchAdminReports(page, limit, 'resolved'),
  ]);
  return mergeReportPages([closed, resolved], page, limit);
}

export type AdminReportTab = 'open' | 'dismissed' | 'closed';

export function reportMatchesTab(status: AdminReportStatus, tab: AdminReportTab): boolean {
  if (tab === 'open') return status === 'open';
  if (tab === 'dismissed') return status === 'dismissed';
  return status === 'resolved';
}

function paginateReportItems(
  items: AdminReportSummary[],
  page: number,
  limit: number,
): AdminReportsResponse {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const start = Math.max(0, (page - 1) * limit);
  return {
    items: items.slice(start, start + limit),
    total,
    page,
    limit,
    total_pages: totalPages,
  };
}

async function collectRemainingReportPages(
  first: AdminReportsResponse,
  status?: AdminReportListStatus,
): Promise<AdminReportSummary[]> {
  const items = [...first.items];
  const seen = new Set(items.map((row) => row.id));
  for (let p = 2; p <= first.total_pages; p++) {
    const next = await fetchAdminReports(p, first.limit, status);
    for (const row of next.items) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      items.push(row);
    }
  }
  return items;
}

/**
 * One tab of the reports list. If GET ignores `status` and returns a mixed page,
 * remaining pages are loaded and the tab is applied on the client.
 */
export async function fetchAdminReportsList(
  page = 1,
  limit = 20,
  tab: AdminReportTab = 'open',
): Promise<AdminReportsResponse> {
  const first =
    tab === 'closed' ? await fetchClosedAdminReports(page, limit) : await fetchAdminReports(page, limit, tab);
  const mixed = first.items.some((row) => !reportMatchesTab(row.status, tab));
  if (!mixed) {
    const items = first.items.filter((row) => reportMatchesTab(row.status, tab));
    return { ...first, items, page };
  }
  const seed =
    page === 1
      ? first
      : tab === 'closed'
        ? await fetchClosedAdminReports(1, limit)
        : await fetchAdminReports(1, limit, tab);
  const catalog = await collectRemainingReportPages(seed, tab === 'closed' ? 'closed' : tab);
  return paginateReportItems(
    catalog.filter((row) => reportMatchesTab(row.status, tab)),
    page,
    limit,
  );
}

/** Reports this user filed. Uses GET /api/admin/reports?reporter_id= when user details omit reports_made. */
export async function fetchReportsFiledByUser(userId: string): Promise<AdminUserReportRef[]> {
  const id = userId.trim().toLowerCase();
  if (!id) return [];
  try {
    const page = await fetchAdminReports(1, 50, undefined, { reporterId: userId });
    return page.items
      .filter((row) => (row.reporter?.id || '').trim().toLowerCase() === id || !row.reporter)
      .map(reportSummaryToUserRef);
  } catch {
    return [];
  }
}

/** The number of open reports. Uses GET /api/admin/reports, counting only `open`. */
export async function fetchOpenReportCount(): Promise<number> {
  const page = await fetchAdminReportsList(1, 20, 'open');
  return page.total;
}

/** A report's details. GET /api/admin/reports/{id} */
export async function fetchAdminReportDetail(reportId: string): Promise<AdminReportDetail> {
  const res = await fetch(getApiUrl(API_ENDPOINTS.ADMIN_REPORT_DETAIL(reportId)), {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  return readReportDetail(await handleAdminResponse<unknown>(res));
}

async function postAdminReport(url: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(getApiUrl(url), {
    method: 'POST',
    headers: { ...getAdminHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}

/** Closes an open report as Dismissed. POST /api/admin/reports/{id}/dismiss — path only, no body. */
export async function dismissReport(reportId: string): Promise<AdminReportDetail> {
  const id = reportId.trim();
  let res = await fetch(getApiUrl(API_ENDPOINTS.ADMIN_REPORT_DISMISS(id)), {
    method: 'POST',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  if (res.status === 404 || res.status === 405 || res.status === 422 || res.status >= 500) {
    res = await postAdminReport(API_ENDPOINTS.ADMIN_REPORT_ACTION(id), { action: 'dismiss' });
  }
  const body = await handleAdminResponse<unknown>(res);
  let detail = readReportDetail(body);
  if (!detail.id) detail = { ...detail, id };
  if (detail.status !== 'open') return detail;
  return { ...detail, id, status: 'dismissed', outcome: detail.outcome ?? 'dismissed' };
}

function closedReportFromAction(
  id: string,
  action: AdminReportAction,
  detail: AdminReportDetail,
): AdminReportDetail {
  const outcome =
    action === 'remove' ? 'content_removed' : action === 'warn' ? 'warned' : 'suspended';
  return {
    ...detail,
    id: detail.id || id,
    status: 'resolved',
    outcome: detail.outcome ?? outcome,
    content_removed: action === 'remove' ? true : detail.content_removed,
  };
}

async function readClosedReportAction(
  id: string,
  action: AdminReportAction,
  res: Response,
): Promise<AdminReportDetail> {
  const body = await handleAdminResponse<unknown>(res);
  let detail = readReportDetail(body);
  if (!detail.id) detail = { ...detail, id };
  if (detail.status !== 'open') return detail;
  return closedReportFromAction(id, action, detail);
}

/**
 * Acts on an open report and closes it as resolved: warn or suspend the user it applies to,
 * or remove the reported content. Warning and suspending need a reason.
 * POST /api/admin/reports/{id}/action  { action: warn | remove_content | suspend, reason? }
 * Removing reported content then resolves with { action: "warn", reason }.
 */
export async function actOnReport(
  reportId: string,
  action: AdminReportAction,
  reason?: string,
): Promise<AdminReportDetail> {
  const id = reportId.trim();
  const apiAction = action === 'remove' ? 'remove_content' : action;
  const payload = reason ? { action: apiAction, reason } : { action: apiAction };
  const res = await postAdminReport(API_ENDPOINTS.ADMIN_REPORT_ACTION(id), payload);
  return readClosedReportAction(id, action, res);
}

/**
 * Assigns an open report to an administrator (the caller or another admin).
 * POST /api/admin/reports/{id}/assign  { admin_id }
 * 409 when the report is already assigned to someone else.
 */
export async function assignReport(reportId: string, adminId: string): Promise<AdminReportDetail> {
  const id = reportId.trim();
  const admin_id = adminId.trim();
  if (!admin_id) throw new Error('Choose an administrator to assign this report to.');
  const res = await postAdminReport(API_ENDPOINTS.ADMIN_REPORT_ASSIGN(id), { admin_id });
  const body = await handleAdminResponse<unknown>(res);
  const detail = readReportDetail(body);
  if (!detail.id) {
    return {
      ...detail,
      id,
      assigned_to: detail.assigned_to ?? { id: admin_id, full_name: '', username: null },
    };
  }
  if (!detail.assigned_to) {
    return { ...detail, assigned_to: { id: admin_id, full_name: '', username: null } };
  }
  return detail;
}

function isAlreadyRemovedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /already removed|already_removed|content_removed/i.test(message);
}

/**
 * Removes the reported event or message, then resolves the report by warning
 * the user about that removed content.
 * POST /api/admin/reports/{id}/action  { action: "warn", reason }
 */
export async function removeReportedContent(
  report: AdminReportDetail,
  reason?: string,
): Promise<AdminReportDetail> {
  const assignmentError = reportActionAssignmentError(report);
  if (assignmentError) throw new Error(assignmentError);
  const warning = (reason ?? '').trim() || warningReasonFromReport(report);
  const id = report.id.trim();
  let removed = false;
  if (report.target_type === 'event') {
    if (!report.event?.id) throw new Error('This report has no event to remove.');
    try {
      await removeEvent(report.event.id);
      removed = true;
    } catch (err) {
      if (isAlreadyRemovedError(err)) removed = true;
    }
  } else if (report.target_type === 'message') {
    if (!report.event?.id || !report.message?.id) {
      throw new Error('This report has no message to remove.');
    }
    try {
      await removeChatMessage(report.event.id, report.message.id);
      removed = true;
    } catch (err) {
      if (isAlreadyRemovedError(err)) removed = true;
    }
  } else {
    throw new Error('There is no content to remove.');
  }

  try {
    const closed = await actOnReport(id, 'warn', warning);
    return {
      ...closed,
      content_removed: true,
      status: closed.status === 'open' ? 'resolved' : closed.status,
      outcome: closed.outcome ?? 'warned',
    };
  } catch (err) {
    if (!removed) throw err;
    try {
      const fresh = await fetchAdminReportDetail(id);
      if (fresh.status !== 'open') {
        return {
          ...fresh,
          content_removed: true,
          outcome: fresh.outcome ?? (fresh.status === 'dismissed' ? 'dismissed' : 'warned'),
        };
      }
    } catch {
      /* content is gone; still need to warn to resolve */
    }
    throw err;
  }
}

export interface SignupInviteSendResult {
  email: string;
  code?: string | null;
  message?: string;
  expires_at?: string | null;
}

/** POST /api/admin/invite_user/{email} — email a registration code (admin MFA session). */
export async function sendSignupInvite(email: string): Promise<SignupInviteSendResult> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_INVITE_USER(email));
  const res = await fetch(url, {
    method: 'POST',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  const body = await handleAdminResponse<Record<string, unknown>>(res);
  const nested =
    body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : body;
  const codeRaw = nested.code ?? nested.invite_code;
  return {
    email: typeof nested.email === 'string' ? nested.email : email,
    code: typeof codeRaw === 'string' ? codeRaw : null,
    message: typeof nested.message === 'string' ? nested.message : undefined,
    expires_at: typeof nested.expires_at === 'string' ? nested.expires_at : null,
  };
}