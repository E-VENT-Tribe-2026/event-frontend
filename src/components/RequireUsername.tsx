import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthToken } from '@/lib/auth';
import { getApiUrl } from '@/lib/api';
import { hasChosenUsername } from '@/lib/username';
import { getPendingAdminVerification } from '@/lib/adminAuth';

/** Signed-in accounts without a username stay on the selection step. */
export default function RequireUsername({ children }: { children: React.ReactNode }) {
  const token = getAuthToken();
  const [state, setState] = useState<'checking' | 'ok' | 'need'>(token ? 'checking' : 'ok');

  useEffect(() => {
    if (!token || getPendingAdminVerification()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl('/api/profile/me'), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        const profile = await res.json().catch(() => ({} as { username?: string }));
        if (cancelled) return;
        setState(res.ok && hasChosenUsername(profile.username) ? 'ok' : 'need');
      } catch {
        if (!cancelled) setState('need');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Ticket #247: an administrator who hasn't completed sign-in verification
  // yet cannot reach any other screen of the application — checked ahead of
  // the username check below, since this is the stricter gate.
  if (token && getPendingAdminVerification()) {
    return <Navigate to="/admin-verify" replace />;
  }

  if (!token) return <>{children}</>;
  if (state === 'checking') return null;
  if (state === 'need') return <Navigate to="/choose-username" replace />;
  return <>{children}</>;
}
