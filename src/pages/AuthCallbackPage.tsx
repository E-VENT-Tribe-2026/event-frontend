import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { setAuthToken } from '@/lib/auth';
import { setCurrentUserFromOAuth } from '@/lib/storage';
import { getApiUrl } from '@/lib/api';
import { destinationAfterSignIn } from '@/lib/username';
import { pickDefaultIconUrl } from '@/lib/uploadAvatar';
import { rememberGoogleName } from '@/pages/ChooseUsernamePage';

function normalizeNextPath(raw: string | null): string {
  const fallback = '/home';
  if (!raw?.trim()) return fallback;
  try {
    // Use URL API to robustly detect cross-origin redirects
    const url = new URL(raw.trim(), window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    const path = url.pathname;
    // Only allow known app routes — reject bare '/' and anything suspicious
    if (path === '/' || path.length > 200) return fallback;
    return path + url.search;
  } catch {
    return fallback;
  }
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(window.location.search);
      const recoveryType = hashParams.get('type') || queryParams.get('type');
      const nextPath = normalizeNextPath(queryParams.get('next'));
      const recoveryToken =
        hashParams.get('access_token') ||
        queryParams.get('access_token') ||
        queryParams.get('token');

      if (recoveryType === 'recovery' && recoveryToken) {
        navigate(`/forgot-password?access_token=${encodeURIComponent(recoveryToken)}`, { replace: true });
        return;
      }

      if (!supabase) {
        navigate('/login', { replace: true });
        return;
      }

      const pkceCode = queryParams.get('code');
      let session = null as Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

      if (pkceCode) {
        const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(pkceCode);
        if (exchangeError || !exchanged?.session) {
          navigate('/login', { replace: true });
          return;
        }
        session = exchanged.session;
      } else {
        const { data, error } = await supabase.auth.getSession();
        if (recoveryType === 'recovery' && data?.session?.access_token) {
          navigate(`/forgot-password?access_token=${encodeURIComponent(data.session.access_token)}`, { replace: true });
          return;
        }
        if (error || !data.session) {
          navigate('/login', { replace: true });
          return;
        }
        session = data.session;
      }

      if (recoveryType === 'recovery' && session?.access_token) {
        navigate(`/forgot-password?access_token=${encodeURIComponent(session.access_token)}`, { replace: true });
        return;
      }

      setAuthToken(session.access_token);

      const googleName = String(
        session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
      ).trim();
      rememberGoogleName(googleName);

      setCurrentUserFromOAuth({
        id: session.user.id,
        email: session.user.email || '',
        name: googleName || session.user.email?.split('@')[0] || '',
      });

      const profileRes = await fetch(getApiUrl('/api/profile/me'), {
        headers: { Authorization: `Bearer ${session.access_token}`, Accept: 'application/json' },
      });
      const profile = await profileRes.json().catch(() => ({} as { username?: string; avatar_url?: string }));
      const avatar = String(profile.avatar_url || session.user.user_metadata?.avatar_url || '');
      if (/googleusercontent|ggpht\.com/i.test(avatar)) {
        await fetch(getApiUrl('/api/profile/me'), {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ avatar_url: pickDefaultIconUrl() }),
        });
      }

      const dest = destinationAfterSignIn(profile.username);
      navigate(dest === '/home' ? nextPath : dest, { replace: true });
    };

    void handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground text-sm">Signing you in...</p>
    </div>
  );
}
