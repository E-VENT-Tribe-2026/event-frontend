import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountRefusalGate, { type SignOutOptions } from '@/components/AccountRefusalGate';
import SessionTimeoutModal from '@/components/SessionTimeoutModal';
import WarningsGate from '@/components/WarningsGate';
import { announceAccountRefusal } from '@/lib/accountRefusal';
import { isSuspendedAccount } from '@/lib/adminApi';
import { AUTH_EXPIRED_EVENT, AUTH_TOKEN_EVENT, clearAuthToken, getAuthToken } from '@/lib/auth';
import { applyMyProfileToSession, fetchMyProfile } from '@/lib/profileMe';
import { clearCache } from '@/lib/queryCache';
import { clearAllQueries, prefetchSignedInQueries } from '@/lib/queries';
import { extendSession, startSessionTimeout, stopSessionTimeout } from '@/lib/sessionTimeout';
import { getCurrentUser, logout } from '@/lib/storage';
import { syncSupabaseSession } from '@/lib/supabase';
import { profileFromMeResponse } from '@/lib/username';

/**
 * App-wide session: load profile once, warn before idle logout, leave on 401.
 * Must render inside the router.
 */
export default function SessionGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);

  const loadSignedInProfile = useCallback(() => {
    const token = getAuthToken();
    if (!token) return;
    void syncSupabaseSession(token);
    void fetchMyProfile(token)
      .then((body) => {
        applyMyProfileToSession(body);
        const profile = profileFromMeResponse(body);
        if (isSuspendedAccount(profile)) {
          const raw = profile.suspension;
          const reason =
            raw && typeof raw === 'object' && typeof (raw as { reason?: unknown }).reason === 'string'
              ? ((raw as { reason: string }).reason.trim() || null)
              : null;
          announceAccountRefusal({ kind: 'suspended', reason });
          return;
        }
        void prefetchSignedInQueries(getCurrentUser()?.id);
      })
      .catch(() => { /* keep the cached session user */ });
  }, []);

  useEffect(() => {
    loadSignedInProfile();
    const onTokenChanged = () => loadSignedInProfile();
    window.addEventListener(AUTH_TOKEN_EVENT, onTokenChanged);
    return () => window.removeEventListener(AUTH_TOKEN_EVENT, onTokenChanged);
  }, [loadSignedInProfile]);

  useEffect(() => {
    if (!getAuthToken()) return;

    startSessionTimeout({
      onWarning: (secs) => {
        setSecondsLeft(secs);
        setShowWarning(true);
      },
      onLogout: () => {
        setShowWarning(false);
        handleLogout();
      },
    });

    return () => stopSessionTimeout();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const hasToken = Boolean(getAuthToken());
      if (hasToken && !showWarning) {
        startSessionTimeout({
          onWarning: (secs) => {
            setSecondsLeft(secs);
            setShowWarning(true);
          },
          onLogout: () => {
            setShowWarning(false);
            handleLogout();
          },
        });
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [showWarning]);

  const handleLogout = useCallback((state?: SignOutOptions) => {
    stopSessionTimeout();
    logout();
    clearAuthToken();
    clearCache();
    clearAllQueries();
    const to = state?.to ?? '/login';
    navigate(
      to,
      to === '/login' && state?.suspension
        ? { replace: true, state: { suspension: state.suspension } }
        : { replace: true },
    );
  }, [navigate]);

  useEffect(() => {
    const onExpired = () => {
      setShowWarning(false);
      handleLogout();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    // handleLogout is created each render; the listener is mounted once on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {children}
      <WarningsGate yieldFocus={showWarning} />
      <AccountRefusalGate onSignOut={handleLogout} />
      <SessionTimeoutModal
        show={showWarning}
        secondsLeft={secondsLeft}
        onStay={() => {
          setShowWarning(false);
          extendSession();
        }}
        onLogout={handleLogout}
      />
    </>
  );
}
