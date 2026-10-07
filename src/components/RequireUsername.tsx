import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAuthToken } from '@/lib/auth';
import { getApiUrl } from '@/lib/api';
import { hasChosenUsername } from '@/lib/username';
import { getPendingAdminVerification } from '@/lib/adminAuth';

/** Paths that administrators are allowed to stay on without being redirected to /admin. */
const ADMIN_EXEMPT_PATHS = ['/admin', '/admin-verify', '/choose-username'];

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
        const res = await fetch(getApiUrl('/api/profile/me'), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        const profile = await res.json().catch(() => ({} as { username?: string; role?: string }));
        if (cancelled) return;
        if (res.ok && typeof profile.role === 'string') {
          setRole(profile.role);
        }
        setState(res.ok && hasChosenUsername(profile.username) ? 'ok' : 'need');
      } catch {
        if (!cancelled) setState('need');
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

  if (!token) return <>{children}</>;
  if (state === 'checking') return null;
  if (state === 'need') return <Navigate to="/choose-username" replace />;

  // Redirect verified administrators away from non-admin pages
  if (
    role === 'administrator' &&
    !ADMIN_EXEMPT_PATHS.includes(location.pathname)
  ) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
