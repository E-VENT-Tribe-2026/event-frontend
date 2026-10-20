import { getApiUrl } from '@/lib/api';
import { notifyAuthExpired } from '@/lib/auth';

// ─────────────────────────────────────────────────────────────────────────────
// User-side warnings API (ticket #294, Stage A).
//
// ⚠ PLACEHOLDER CONTRACT — replace when backend issue #191 ships.
// The backend has not published the user-side warning endpoints yet. Every
// detail below that depends on the real contract is OUR GUESS, not a
// documented format:
//   - the endpoint paths,
//   - the HTTP methods (GET for pending, POST for acknowledge),
//   - the response envelopes and field names of the pending list,
//   - the success statuses (any 2xx; the acknowledge response body is ignored),
//   - the "no longer pending" statuses on acknowledge (409 / 410),
//   - the assumption that an unshipped endpoint answers 404.
// Everything that depends on the real contract lives in this one file so it
// can be swapped in a single place.
//
// While the endpoints do not exist the server is expected to answer 404, which
// we treat as "no warnings", so real users never see a dialog. Never add
// sample or mock warnings here.
//
// Pending warnings are deliberately NOT cached: no cachedFetch, no React Query
// (React Query is persisted to localStorage in this app). Every request uses
// a plain fetch with cache: 'no-store'.
// ─────────────────────────────────────────────────────────────────────────────

/** PLACEHOLDER (#191): paths are guesses until the backend publishes them. */
export const WARNINGS_ENDPOINTS = {
  PENDING: '/api/me/warnings/pending',
  ACKNOWLEDGE: (warningId: string) => `/api/me/warnings/${encodeURIComponent(warningId)}/acknowledge`,
} as const;

/**
 * PLACEHOLDER (#191): acknowledge statuses we assume mean "this warning is no
 * longer pending" — already acknowledged elsewhere (409 / 410). Retrying could
 * never succeed, so they count as done. 404 is NOT in this list: it could also
 * mean a wrong route, and a silent "done" would hide that the backend never
 * recorded the acknowledgement. Re-check when #191 ships.
 */
const NO_LONGER_PENDING_STATUSES = new Set([409, 410]);

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
 * PLACEHOLDER (#191): field names (`id`, `reason`) and the envelope shapes
 * (bare array, `{ data: [...] }`, `{ warnings: [...] }`) are guesses.
 * Rows without an id cannot be acknowledged, so they are dropped. Rows without
 * a reason are kept (the user must still acknowledge them) and logged, since
 * that usually means the real field name differs from our guess.
 */
export function parsePendingWarnings(body: unknown): UserWarning[] {
  const b = body as { data?: unknown; warnings?: unknown } | null;
  const rows: unknown[] = Array.isArray(body) ? body
    : Array.isArray(b?.data) ? b.data
    : Array.isArray(b?.warnings) ? b.warnings
    : [];
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
 * Resolves to [] when the endpoint answers 404 (not shipped yet), or when a
 * 2xx body is not valid JSON (logged).
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
  if (res.status === 404) return [];
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
 * PLACEHOLDER (#191): POST, any 2xx = acknowledged (response body ignored),
 * 409 / 410 = no longer pending (acknowledged elsewhere), which also counts as done. 
 * Any other status, 404 included, can be retried.
 * Once the backend records it, the warning is meant to stop appearing on all devices.
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
  if (res.ok || NO_LONGER_PENDING_STATUSES.has(res.status)) return;
  failOnStatus(res, 'acknowledge warning', signal);
}
