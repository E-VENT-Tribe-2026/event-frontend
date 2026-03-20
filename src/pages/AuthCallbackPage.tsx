import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { setCurrentUserFromOAuth } from '@/lib/storage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8001';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env');
      return;
    }

    const run = async () => {
      let session: { access_token: string; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null = null;

      const code = searchParams.get('code');
      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
        session = data.session;
      } else {
        const { data: { session: s }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setError(sessionError.message);
          return;
        }
        session = s;
      }

      if (!session) {
        setError('No session found. Please try signing in again.');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      const token = session.access_token;
      localStorage.setItem('api_token', token);

      const user = session.user;
      const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User';
      const avatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;

      setCurrentUserFromOAuth({
        id: user.id,
        email: user.email ?? '',
        name,
        avatar,
      });

      // Navigate immediately; don't block on backend sync.
      navigate('/home', { replace: true });

      // Ensure profile exists in backend (for Supabase profiles table), best-effort with timeout.
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      fetch(`${API_BASE_URL}/api/auth/ensure-profile`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeout));
    };

    run();
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <p className="text-destructive text-center">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-4 text-primary hover:underline"
        >
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <p className="text-muted-foreground">Signing you in...</p>
    </div>
  );
}
