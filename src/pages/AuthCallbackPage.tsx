import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { setAuthToken } from '@/lib/auth';
import { setCurrentUserFromOAuth } from '@/lib/storage';

function normalizeNextPath(raw: string | null): string {
  const fallback = '/home';
  if (!raw || !raw.trim()) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) return fallback;
  // Avoid open redirects: only allow same-origin paths (no "//", no ":")
  if (trimmed.startsWith('//') || trimmed.includes('://')) return fallback;
  if (trimmed === '/') return fallback;
  return trimmed;
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

      setCurrentUserFromOAuth({
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '',
      });

      navigate(nextPath, { replace: true });
    };

    void handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground text-sm">Signing you in...</p>
    </div>
  );
}
