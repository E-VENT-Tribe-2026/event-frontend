import { getAuthToken } from '@/lib/auth';
import { readSuspension } from '@/lib/suspension';

// Account refusals (ticket #294, Part 6).
//
// Backend contract:
//   - a suspended account gets 403 with
//       detail: { code: 'account_suspended', message, reason: string | null }
//     on every authenticated request;
//   - a user who became an administrator gets 403 with detail equal to
//       'Administrator accounts cannot perform user actions.'
//     on user-only endpoints.
// The watcher wraps window.fetch once, spots these 403s for the current
// session, and announces them with ACCOUNT_REFUSED_EVENT. Callers always get
// the original response, undelayed.

/** Fired on window with `detail: AccountRefusal`. */
export const ACCOUNT_REFUSED_EVENT = 'eventapp:account-refused';

export type AccountRefusal =
  | { kind: 'suspended'; reason: string | null }
  | { kind: 'administrator' };

const ADMINISTRATOR_REFUSAL = 'Administrator accounts cannot perform user actions.';

const WRAPPED = Symbol.for('eventapp.accountRefusalWatcher');

type WatchedFetch = typeof fetch & { [WRAPPED]?: true };

/** The bearer token of a request: init headers win over the Request's own, as in fetch itself. */
function bearerToken(input: RequestInfo | URL, init?: RequestInit): string {
  const headers = init?.headers ?? (input instanceof Request ? input.headers : undefined);
  if (!headers) return '';
  const value = new Headers(headers).get('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1].trim() : '';
}

function refusalFrom(body: unknown): AccountRefusal | null {
  const detail = (body as { detail?: unknown } | null)?.detail;
  const suspension = readSuspension(detail);
  if (suspension) return { kind: 'suspended', reason: suspension.reason };
  if (detail === ADMINISTRATOR_REFUSAL) return { kind: 'administrator' };
  return null;
}

/** Reads a copy of the body in the background; never throws, never delays the caller. */
function inspect(res: Response, token: string) {
  try {
    res.clone().json()
      .then((body: unknown) => {
        const refusal = refusalFrom(body);
        // The session may have changed while the body was read.
        if (!refusal || getAuthToken() !== token) return;
        window.dispatchEvent(new CustomEvent<AccountRefusal>(ACCOUNT_REFUSED_EVENT, { detail: refusal }));
      })
      .catch(() => {});
  } catch {
    /* ignore: the caller still gets the original response */
  }
}

/** Wraps window.fetch once; calling it again does nothing. */
export function installAccountRefusalWatcher() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const original = window.fetch as WatchedFetch;
  if (original[WRAPPED]) return;

  const watched: WatchedFetch = (input, init) =>
    original.call(window, input, init).then((res) => {
      if (res.status === 403) {
        try {
          const token = bearerToken(input, init);
          if (token && token === getAuthToken()) inspect(res, token);
        } catch {
          /* ignore: the caller still gets the original response */
        }
      }
      return res;
    });
  watched[WRAPPED] = true;
  window.fetch = watched;
}
