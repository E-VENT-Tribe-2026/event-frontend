import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { hasChosenUsername } from '@/lib/username';

/** Signed-in accounts without a username stay on the selection step. */
export default function RequireUsername({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'wait' | 'ok' | 'need'>('wait');

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setState('ok');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
          headers: { Authorization: `Bearer ${token}` },
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
  }, []);

  if (state === 'wait') return null;
  if (state === 'need') return <Navigate to="/choose-username" replace />;
  return <>{children}</>;
}
