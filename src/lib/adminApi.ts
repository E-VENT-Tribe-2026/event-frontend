import { getApiUrl } from './api';
import { API_ENDPOINTS } from './apiUrls';
import { getAuthToken } from './auth';
import { getPendingAdminVerification } from './adminAuth';
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

// ---- Reports ----

export interface AdminReportSummary {
  id: string;
  reporter_id: string;
  reporter_name: string;
  target_id: string;
  target_type: 'event' | 'user';
  target_name: string;
  reason: string;
  status: 'pending' | 'dismissed' | 'actioned';
  created_at: string;
}

export interface AdminReportsResponse {
  items: AdminReportSummary[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AdminReportDetail extends AdminReportSummary {
  description?: string | null;
  admin_note?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
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
    const errorMsg =
      (typeof body === 'object' && body && (body.detail || body.message || body.error)) ||
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

/**
 * Removes (hard-deletes) an event.
 */
export async function removeEvent(eventId: string): Promise<AdminActionResponse> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_EVENT_REMOVE(eventId));
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminActionResponse>(res);
}

function readPerson(value: unknown): AdminEventPerson | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : '';
  const username = typeof row.username === 'string' ? row.username : null;
  const full_name = typeof row.full_name === 'string' ? row.full_name : '';
  const display_name = typeof row.display_name === 'string' ? row.display_name : undefined;
  if (!id && !full_name && !username && !display_name) return null;
  return {
    id,
    username,
    full_name,
    display_name,
    avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    avatar_kind: typeof row.avatar_kind === 'string' ? row.avatar_kind : undefined,
    icon_id: typeof row.icon_id === 'string' ? row.icon_id : null,
  };
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
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    return readTitle(row.title) || readTitle(row.name);
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

function mapAuditEntry(raw: unknown, index: number): AdminAuditEntry {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const admin = readPerson(row.administrator ?? row.admin);
  const targetObj = row.target && typeof row.target === 'object' ? (row.target as Record<string, unknown>) : null;
  const targetUser = readPerson(targetObj?.user);

  const admin_id =
    admin?.id || (typeof row.admin_id === 'string' ? row.admin_id : '');
  const admin_name =
    personDisplayName(admin) ||
    (typeof row.admin_name === 'string' ? row.admin_name.trim() : '') ||
    'Unknown administrator';
  const admin_username =
    admin?.username?.trim() ||
    (typeof row.admin_username === 'string' ? row.admin_username : null) ||
    null;

  const target_id = asId(targetObj?.id) || asId(row.target_id);
  const target_type =
    (typeof targetObj?.type === 'string' ? targetObj.type : null) ||
    (typeof row.target_type === 'string' ? row.target_type : null);
  const target_name =
    personDisplayName(targetUser) ||
    (typeof row.target_name === 'string' ? row.target_name.trim() : '') ||
    null;
  const target_title =
    readTitle(targetObj?.event) ||
    readTitle(targetObj?.title) ||
    readTitle(targetObj?.chat) ||
    readTitle(row.target_title) ||
    null;

  const description = typeof row.description === 'string' ? row.description.trim() : '';
  const reasonFlat = typeof row.reason === 'string' ? row.reason.trim() : '';
  const detailsList = Array.isArray(row.details)
    ? row.details.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : typeof row.details === 'string' && row.details.trim()
      ? [row.details.trim()]
      : [];
  const detailsJoined = detailsList.join(' · ');
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
    target_username: targetUser?.username ?? null,
    target_avatar_url: targetUser?.avatar_url ?? null,
    target_email,
    target_title,
    reason: reasonFlat || description || null,
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

/**
 * Fetches paginated reports for the admin panel.
 */
export async function fetchAdminReports(
  page = 1,
  limit = 20,
  status?: string,
): Promise<AdminReportsResponse> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (status) {
    params.set('status', status);
  }
  const url = `${getApiUrl(API_ENDPOINTS.ADMIN_REPORTS)}?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminReportsResponse>(res);
}

/**
 * Fetches the full details for a single report.
 */
export async function fetchAdminReportDetail(reportId: string): Promise<AdminReportDetail> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_REPORT_DETAIL(reportId));
  const res = await fetch(url, {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminReportDetail>(res);
}

/**
 * Dismisses a report without taking further action.
 */
export async function dismissReport(reportId: string, note?: string): Promise<AdminActionResponse> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_REPORT_DISMISS(reportId));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...getAdminHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ note: note ?? null }),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminActionResponse>(res);
}

/**
 * Takes an action on a report (e.g. warn/suspend the target).
 */
export async function actionReport(
  reportId: string,
  action: string,
  note?: string,
): Promise<AdminActionResponse> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_REPORT_ACTION(reportId));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...getAdminHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, note: note ?? null }),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminActionResponse>(res);
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