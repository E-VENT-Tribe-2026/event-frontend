import { getApiUrl } from './api';
import { API_ENDPOINTS } from './apiUrls';
import { getAuthToken } from './auth';
import { getPendingAdminVerification } from './adminAuth';

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
  target_id?: string | null;
  target_type?: string | null;
  details?: string | null;
  created_at: string;
}

export interface AdminAuditResponse {
  items: AdminAuditEntry[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
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
  return handleAdminResponse<AdminUsersResponse>(res);
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
  return handleAdminResponse<AdminUserDetailsFull>(res);
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

/**
 * Issues a warning to a user.
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
 * Withdraws (removes) a previously issued warning from a user.
 */
export async function withdrawWarning(userId: string, warningId: string): Promise<AdminActionResponse> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_USER_WITHDRAW_WARNING(userId));
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      ...getAdminHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ warning_id: warningId }),
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
 * Lifts a suspension from a user account.
 */
export async function liftSuspension(userId: string): Promise<AdminActionResponse> {
  const url = getApiUrl(API_ENDPOINTS.ADMIN_USER_LIFT(userId));
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...getAdminHeaders(),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  return handleAdminResponse<AdminActionResponse>(res);
}

/**
 * Fetches paginated events for the admin panel.
 */
export async function fetchAdminEvents(
  page = 1,
  limit = 20,
  search?: string,
  catParam?: string,
): Promise<AdminEventsResponse> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (search?.trim()) {
    params.set('search', search.trim());
  }
  if (catParam?.trim()) {
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

/**
 * Fetches the paginated admin audit log.
 */
export async function fetchAdminAudit(
  page = 1,
  limit = 20,
): Promise<AdminAuditResponse> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  const url = `${getApiUrl(API_ENDPOINTS.ADMIN_AUDIT)}?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: getAdminHeaders(),
    cache: 'no-store',
  });
  return handleAdminResponse<AdminAuditResponse>(res);
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