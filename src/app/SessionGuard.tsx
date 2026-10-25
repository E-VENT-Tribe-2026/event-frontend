import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import AccountRefusalGate from '@/components/AccountRefusalGate';
import SessionTimeoutModal from '@/components/SessionTimeoutModal';
import { AUTH_EXPIRED_EVENT, clearAuthToken, getAuthToken } from '@/lib/auth';
import { applyMyProfileToSession, fetchMyProfile } from '@/lib/profileMe';
import { clearCache } from '@/lib/queryCache';
import { clearAllQueries } from '@/lib/queries';
import { extendSession, startSessionTimeout, stopSessionTimeout } from '@/lib/sessionTimeout';
import { logout } from '@/lib/storage';
import { syncSupabaseSession } from '@/lib/supabase';
import type { SuspensionNotice } from '@/lib/suspension';

/**
 * App-wide session: load profile once, warn before idle logout, leave on 401.
 * Must render inside the router.
 */
export default function SessionGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(120);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    void syncSupabaseSession(token);
    void fetchMyProfile(token)
      .then((body) => {
        applyMyProfileToSession(body);
      })
      .catch(() => { /* keep the cached session user */ });
  }, []);

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

  const handleLogout = useCallback((state?: { suspension: SuspensionNotice }) => {
    stopSessionTimeout();
    logout();
    clearAuthToken();
    clearCache();
    clearAllQueries();
    navigate('/login', state ? { replace: true, state } : { replace: true });
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
