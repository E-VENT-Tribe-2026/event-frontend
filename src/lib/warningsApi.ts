import { getApiUrl } from '@/lib/api';
import { notifyAuthExpired } from '@/lib/auth';

// ─────────────────────────────────────────────────────────────────────────────
// User-side warnings API (ticket #294, Stage A).
//
// Backend contract (event-backend #191):
//   - GET  /api/warnings/pending
//       → 200 { items: [{ id: number, created_at, reason, about }] }, oldest first.
//   - POST /api/warnings/{id}/acknowledge
//       → 200, also when repeated (acknowledging twice is safe).
//       → 404 when the warning is not found; the user can retry.
// Everything that depends on the backend contract lives in this one file.
// Never add sample or mock warnings here.
//
// Pending warnings are deliberately NOT cached: no cachedFetch, no React Query
// (React Query is persisted to localStorage in this app). Every request uses
// a plain fetch with cache: 'no-store'.
// ─────────────────────────────────────────────────────────────────────────────

/** Backend contract (event-backend #191). */
export const WARNINGS_ENDPOINTS = {
  PENDING: '/api/warnings/pending',
  ACKNOWLEDGE: (warningId: string) => `/api/warnings/${encodeURIComponent(warningId)}/acknowledge`,
} as const;

export type UserWarning = {
  id: string;
  /** The administrator's reason. Always render as plain text, never as HTML. */
  reason: string;
};

/** A failed warnings request; `status` is 0 when no HTTP response was received. */
export class WarningsApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'WarningsApiError';
  }
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' } as const;
}

/**
 * Same 401 handling as the rest of the API layer: SessionGuard logs the user out.
 * Skipped for an aborted request, whose session has already been replaced.
 */
function failOnStatus(res: Response, what: string, signal?: AbortSignal): never {
  if (res.status === 401 && !signal?.aborted) notifyAuthExpired();
  throw new WarningsApiError(`Failed to ${what} (${res.status})`, res.status);
}

/** Aborts (replaced request, unmount, timeout) pass through unchanged so callers can tell them apart. */
function isAbort(err: unknown, signal?: AbortSignal) {
  return Boolean(signal?.aborted) || (err instanceof DOMException && err.name === 'AbortError');
}

/** fetch, with network failures turned into WarningsApiError (status 0). */
async function request(url: string, init: RequestInit, what: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    if (isAbort(err, init.signal ?? undefined)) throw err;
    throw new WarningsApiError(`Failed to ${what} (network)`, 0);
  }
}

/**
 * Backend contract (event-backend #191): reads only `items`, in the order the
 * server sends them (oldest first). The numeric `id` is kept as a string.
 * Rows without an id cannot be acknowledged, so they are dropped. Rows without
 * a reason are kept (the user must still acknowledge them) and logged.
 */
export function parsePendingWarnings(body: unknown): UserWarning[] {
  const items = (body as { items?: unknown } | null)?.items;
  const rows: unknown[] = Array.isArray(items) ? items : [];
  return rows.flatMap((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const id = row.id == null ? '' : String(row.id).trim();
    if (!id) return [];
    const reason = typeof row.reason === 'string' ? row.reason : '';
    if (!reason.trim()) console.warn('[warnings] pending warning without a reason:', id);
    return [{ id, reason }];
  });
}

/**
 * Loads the signed-in user's warnings that still wait for acknowledgement.
 * Resolves to [] when a 2xx body is not valid JSON (logged).
 * Rejects with WarningsApiError on HTTP and network failures (status 0 =
 * network); an aborted request rejects with the abort error unchanged.
 * Callers must not block the app on a rejection. A 401 also fires the
 * app-wide auth-expired event.
 */
export async function fetchPendingWarnings(token: string, signal?: AbortSignal): Promise<UserWarning[]> {
  const res = await request(getApiUrl(WARNINGS_ENDPOINTS.PENDING), {
    headers: authHeaders(token),
    cache: 'no-store',
    signal,
  }, 'load warnings');
  if (!res.ok) failOnStatus(res, 'load warnings', signal);
  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    if (isAbort(err, signal)) throw err;
    console.warn('[warnings] pending warnings response was not valid JSON');
    return [];
  }
  return parsePendingWarnings(body);
}

/**
 * Backend contract (event-backend #191): POST, 200 = acknowledged, also when
 * repeated (the response body is ignored). Any other status, 404 included,
 * can be retried. Once acknowledged, the warning stops appearing on all devices.
 * Rejects with WarningsApiError on HTTP and network failures (status 0 =
 * network); an aborted request rejects with the abort error unchanged.
 */
export async function acknowledgeWarning(token: string, warningId: string, signal?: AbortSignal): Promise<void> {
  const res = await request(getApiUrl(WARNINGS_ENDPOINTS.ACKNOWLEDGE(warningId)), {
    method: 'POST',
    headers: authHeaders(token),
    cache: 'no-store',
    signal,
  }, 'acknowledge warning');
  if (res.ok) return;
  failOnStatus(res, 'acknowledge warning', signal);
}
