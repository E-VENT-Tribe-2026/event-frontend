/**
 * Event check-in endpoints (logged-in onboarded user, Authorization: Bearer).
 *
 * GET  /api/events/{event_id}/check-in-code  — organizer only
 *   { event_id, code, qr_content }
 *   403 anyone else
 *
 * POST /api/events/{event_id}/check-in       — participant only
 *   { code } or { qr_content }  (same six-digit value)
 *   { checked_in, already_checked_in, checked_in_at }
 *   403 not a participant
 *   400 wrong code / outside window (start − 3h to start + 12h) / cancelled
 *   429 after 10 wrong codes per user per event per minute
 *
 * GET  /api/events/{event_id}/check-ins      — organizer or participant
 *   Organizer: include_times true and checked_in_at on items
 *   Participant: include_times false, no checked_in_at
 *   403 anyone else
 *
 * Event GET/POST/PUT never include check_in_code or check_in_qr_content.
 */

import { getApiUrl } from './api';
import { API_ENDPOINTS } from './apiUrls';
import { getAuthToken, notifyAuthExpired } from './auth';

export type CheckinPerson = {
  user_id: string;
  full_name?: string | null;
  username?: string | null;
  checked_in_at?: string | null;
};

export type EventCheckinCode = {
  event_id: string;
  code: string;
  qr_content: string;
};

export type EventCheckinSummary = {
  event_id?: string;
  code?: string | null;
  qr_content?: string | null;
  checked_in_count: number;
  participant_count: number;
  viewer_checked_in: boolean;
  include_times: boolean;
  checkins: CheckinPerson[];
};

export type EventCheckinResult = {
  checked_in: boolean;
  already_checked_in: boolean;
  checked_in_at?: string | null;
};

export class CheckinApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'CheckinApiError';
    this.status = status;
    this.code = code;
  }
}

function detailText(body: unknown): { message: string; code?: string } {
  if (!body || typeof body !== 'object') return { message: '' };
  const row = body as Record<string, unknown>;
  const detail = row.detail ?? row.message ?? row.error;
  if (typeof detail === 'string') return { message: detail.trim() };
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const nested = detail as { message?: unknown; code?: unknown };
    return {
      message: typeof nested.message === 'string' ? nested.message.trim() : '',
      code: typeof nested.code === 'string' ? nested.code : undefined,
    };
  }
  return { message: '' };
}

export function messageForCheckinStatus(status: number, body?: unknown): string {
  const { message, code } = detailText(body);
  if (code === 'already_checked_in' || status === 409) {
    return message || 'You are already checked in.';
  }
  if (status === 429) {
    return message || 'Too many wrong codes. Wait a minute and try again.';
  }
  if (status === 403) {
    return message || 'Only people who joined this event can check in.';
  }
  if (status === 400) {
    return message || 'That code is not valid, the event is cancelled, or check-in is closed.';
  }
  if (status === 404) return message || 'Check-in is not available for this event yet.';
  return message || 'Could not check in. Please try again.';
}

function personFrom(raw: unknown): CheckinPerson | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const user = row.user && typeof row.user === 'object' ? (row.user as Record<string, unknown>) : null;
  const id = String(row.user_id ?? row.userId ?? user?.id ?? '').trim();
  if (!id) return null;
  const at = row.checked_in_at ?? row.checked_in_at_iso ?? row.at;
  return {
    user_id: id,
    full_name:
      (typeof row.full_name === 'string' && row.full_name) ||
      (typeof user?.full_name === 'string' && user.full_name) ||
      (typeof user?.display_name === 'string' && user.display_name) ||
      (typeof row.name === 'string' && row.name) ||
      null,
    username:
      (typeof row.username === 'string' && row.username) ||
      (typeof user?.username === 'string' && user.username) ||
      null,
    checked_in_at: typeof at === 'string' && at.trim() ? at : null,
  };
}

export function parseCheckinList(body: unknown): EventCheckinSummary {
  const row = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const rawList = Array.isArray(row.items) ? row.items : Array.isArray(row.checkins) ? row.checkins : [];
  const checkins = rawList.map(personFrom).filter((p): p is CheckinPerson => Boolean(p));
  const includeTimes = row.include_times === true;
  return {
    event_id: typeof row.event_id === 'string' ? row.event_id : undefined,
    checked_in_count: Number(row.checked_in_count ?? checkins.length) || checkins.length,
    participant_count: Number(row.participant_count) || 0,
    viewer_checked_in: row.viewer_checked_in === true,
    include_times: includeTimes,
    checkins: includeTimes
      ? checkins
      : checkins.map((c) => ({ ...c, checked_in_at: null })),
  };
}

async function readBody(res: Response): Promise<unknown> {
  const contentType = typeof res.headers?.get === 'function' ? res.headers.get('content-type') : '';
  const isJson = !contentType || contentType.includes('application/json');
  return isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => '');
}

async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(getApiUrl(path), { ...init, headers });
}

function throwIfFailed(res: Response, body: unknown): void {
  if (res.status === 401) notifyAuthExpired();
  if (!res.ok) {
    throw new CheckinApiError(messageForCheckinStatus(res.status, body), res.status, detailText(body).code);
  }
}

export async function fetchEventCheckinCode(eventId: string): Promise<EventCheckinCode | null> {
  const res = await authorizedFetch(API_ENDPOINTS.EVENT_CHECKIN_CODE(eventId));
  const body = await readBody(res);
  if (res.status === 403 || res.status === 404) return null;
  throwIfFailed(res, body);
  const row = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const code = typeof row.code === 'string' ? row.code.trim() : '';
  const qr = typeof row.qr_content === 'string' ? row.qr_content.trim() : code;
  if (!code && !qr) return null;
  return {
    event_id: typeof row.event_id === 'string' ? row.event_id : eventId,
    code: code || qr,
    qr_content: qr || code,
  };
}

export async function fetchEventCheckins(eventId: string): Promise<EventCheckinSummary | null> {
  const res = await authorizedFetch(API_ENDPOINTS.EVENT_CHECKINS(eventId));
  const body = await readBody(res);
  if (res.status === 403 || res.status === 404) return null;
  throwIfFailed(res, body);
  return parseCheckinList(body);
}

export async function submitEventCheckin(
  eventId: string,
  value: string,
  via: 'code' | 'qr_content' = 'code',
): Promise<EventCheckinResult> {
  const trimmed = value.trim();
  const res = await authorizedFetch(API_ENDPOINTS.EVENT_CHECKIN(eventId), {
    method: 'POST',
    body: JSON.stringify(via === 'qr_content' ? { qr_content: trimmed } : { code: trimmed }),
  });
  const body = await readBody(res);
  throwIfFailed(res, body);
  const row = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  return {
    checked_in: row.checked_in === true || row.already_checked_in === true,
    already_checked_in: row.already_checked_in === true,
    checked_in_at: typeof row.checked_in_at === 'string' ? row.checked_in_at : null,
  };
}
