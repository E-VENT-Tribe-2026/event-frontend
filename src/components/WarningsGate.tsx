import { useCallback, useEffect, useRef, useState } from 'react';
import WarningDialog from '@/components/WarningDialog';
import { AUTH_TOKEN_EVENT, getAuthToken } from '@/lib/auth';
import { acknowledgeWarning, fetchPendingWarnings, type UserWarning } from '@/lib/warningsApi';
import { NOTIFICATIONS_CHANGED_EVENT } from '@/lib/notificationsApi';
import { invalidateNotifications } from '@/lib/queries';

const ACK_ERROR = "We couldn't confirm that you read this warning. Check your connection and try again.";

/** Give up on a pending-warnings request after this long so later checks are not blocked. */
const LOAD_TIMEOUT_MS = 10_000;

type LoadRequest = { token: string; controller: AbortController };

function errorText(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

interface WarningsGateProps {
  /** Hand the keyboard to another modal shown on top (e.g. the session timeout). */
  yieldFocus?: boolean;
}

/**
 * Shows the signed-in user's unacknowledged warnings one after another and
 * blocks the app until each is acknowledged (ticket #294, Stage A).
 * Checks on app open / sign-in and when the tab becomes visible again.
 * The queue lives only in component state — never in a client-side cache.
 */
export default function WarningsGate({ yieldFocus = false }: WarningsGateProps) {
  const [queue, setQueue] = useState<UserWarning[]>([]);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs so event listeners see the latest state without re-subscribing.
  const showingRef = useRef(false);
  const requestRef = useRef<LoadRequest | null>(null);
  const ackControllerRef = useRef<AbortController | null>(null);
  const tokenRef = useRef<string | null>(null);

  const abortLoad = useCallback(() => {
    requestRef.current?.controller.abort();
    requestRef.current = null;
  }, []);

  const abortAcknowledge = useCallback(() => {
    ackControllerRef.current?.abort();
    ackControllerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    showingRef.current = false;
    setQueue([]);
    setIndex(0);
    setSubmitting(false);
    setError(null);
  }, []);

  const load = useCallback(async () => {
    const token = getAuthToken();
    if (!token || showingRef.current) return;
    // One request per token: a check for the same token is already on its way;
    // a request for an older token is replaced so the new session is checked.
    if (requestRef.current?.token === token) return;
    abortLoad();

    const request: LoadRequest = { token, controller: new AbortController() };
    requestRef.current = request;
    const timer = setTimeout(() => request.controller.abort(), LOAD_TIMEOUT_MS);
    try {
      const pending = await fetchPendingWarnings(token, request.controller.signal);
      // Ignore the answer if it was replaced, or the user signed out or switched accounts.
      if (requestRef.current !== request || getAuthToken() !== token || pending.length === 0) return;
      showingRef.current = true;
      setQueue(pending);
      setIndex(0);
      setError(null);
    } catch (err) {
      // Never block the app over a failed check; the next check retries.
      if (requestRef.current === request) console.warn('[warnings] pending check failed:', errorText(err));
    } finally {
      clearTimeout(timer);
      if (requestRef.current === request) requestRef.current = null;
    }
  }, [abortLoad]);

  useEffect(() => {
    // Read the token here, not at render: a route may have signed in before this effect ran.
    tokenRef.current = getAuthToken();
    void load();

    const onTokenChanged = () => {
      const token = getAuthToken();
      if (token === tokenRef.current) return;
      tokenRef.current = token;
      abortLoad();
      abortAcknowledge();
      reset();
      if (token) void load();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load();
    };
    // A new notification may be a new warning: show it at once. load() still
    // skips while a warning is showing or a check is in flight.
    const onNotificationsChanged = () => { void load(); };

    window.addEventListener(AUTH_TOKEN_EVENT, onTokenChanged);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
    return () => {
      window.removeEventListener(AUTH_TOKEN_EVENT, onTokenChanged);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
      abortLoad();
      abortAcknowledge();
    };
  }, [load, reset, abortLoad, abortAcknowledge]);

  const current = queue[index] ?? null;

  const handleAcknowledge = async () => {
    const token = getAuthToken();
    if (!current || !token || submitting) return;
    const controller = new AbortController();
    ackControllerRef.current = controller;
    setSubmitting(true);
    setError(null);
    // The session changed while this request was in flight: its outcome belongs to the old session.
    const stale = () => controller.signal.aborted || getAuthToken() !== token;
    try {
      await acknowledgeWarning(token, current.id, controller.signal);
      if (stale()) return;
      // Refresh the notification list (the warning is now read). Called while the
      // warning still counts as showing, so the change event does not re-check here.
      invalidateNotifications();
      if (index + 1 < queue.length) {
        setIndex(index + 1);
        setSubmitting(false);
      } else {
        reset();
      }
    } catch (err) {
      if (stale()) return;
      // A 401 has already triggered the app-wide sign-out; other failures can be retried.
      console.warn('[warnings] acknowledge failed:', errorText(err));
      setError(ACK_ERROR);
      setSubmitting(false);
    } finally {
      if (ackControllerRef.current === controller) ackControllerRef.current = null;
    }
  };

  return (
    <WarningDialog
      warning={current}
      mode="acknowledge"
      position={index + 1}
      total={queue.length}
      submitting={submitting}
      error={error}
      onAcknowledge={() => void handleAcknowledge()}
      trapFocus={!yieldFocus}
    />
  );
}
