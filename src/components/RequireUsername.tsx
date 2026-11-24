import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAuthToken, notifyAuthExpired } from '@/lib/auth';
import { fetchMyProfile, ProfileMeError } from '@/lib/profileMe';
import { hasChosenUsername, profileFromMeResponse } from '@/lib/username';
import { getPendingAdminVerification } from '@/lib/adminAuth';
import { getCurrentUser } from '@/lib/storage';
import { isAdministratorRole } from '@/lib/adminApi';

/** Paths that administrators are allowed to stay on without being redirected to /admin. */
const ADMIN_EXEMPT_PATHS = ['/admin', '/admin-verify'];

/** Signed-in accounts without a username stay on the selection step. */
export default function RequireUsername({ children }: { children: React.ReactNode }) {
  const token = getAuthToken();
  const location = useLocation();
  const [state, setState] = useState<'checking' | 'ok' | 'need'>(token ? 'checking' : 'ok');
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!token || getPendingAdminVerification()) return;
    let cancelled = false;
    (async () => {
      try {
        const body = await fetchMyProfile(token);
        if (cancelled) return;
        const profile = profileFromMeResponse(body);
        if (typeof profile.role === 'string') setRole(profile.role);
        const username = typeof profile.username === 'string' ? profile.username : null;
        setState(hasChosenUsername(username) ? 'ok' : 'need');
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ProfileMeError && error.status === 401) {
          notifyAuthExpired();
          return;
        }
        // 403 = profile setup required. Other failures must not bounce a
        // signed-in user to /choose-username on refresh.
        if (error instanceof ProfileMeError && error.status === 403) {
          setState('need');
          return;
        }
        setState('ok');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // An administrator who hasn't completed sign-in verification
  // yet cannot reach any other screen of the application.
  if (token && getPendingAdminVerification()) {
    return <Navigate to="/admin-verify" replace />;
  }

  if (!token) return <Navigate to="/login" replace />;
  if (state === 'checking') return null;

  const isAdmin = isAdministratorRole(role) || isAdministratorRole(getCurrentUser()?.role);
  // A verified administrator must reach the admin panel, not choose-username / password setup.
  if (state === 'need' && !isAdmin) return <Navigate to="/choose-username" replace />;

  // Redirect verified administrators away from non-admin pages
  if (isAdmin && !ADMIN_EXEMPT_PATHS.includes(location.pathname)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
