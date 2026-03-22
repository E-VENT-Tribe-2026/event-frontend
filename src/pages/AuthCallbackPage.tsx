import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { setCurrentUserFromOAuth } from '@/lib/storage';
import { setAuthToken } from '@/lib/auth';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  
  // Prevent React 18 Strict Mode from running the exchange logic twice
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    
    if (!isSupabaseConfigured() || !supabase) {
      setError('Supabase is not configured. Check your environment variables.');
      return;
    }

    const handleAuth = async () => {
      initialized.current = true;

      try {
        let session = null;
        const code = searchParams.get('code');

        // 1. Exchange the temporary code for a real session
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          session = data.session;
        } else {
          // Fallback check if session already exists
          const { data: { session: s }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          session = s;
        }

        if (!session) {
          throw new Error('No session found. Please try signing in again.');
        }

        // 2. Setup Auth State
        const { access_token, user } = session;
        setAuthToken(access_token);

        const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User';
        const avatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;

        setCurrentUserFromOAuth({
          id: user.id,
          email: user.email ?? '',
          name,
          avatar,
        });

        // 3. Sync Profile to Database (The "Ensure Profile" step)
        // This ensures /api/profile/me won't 404 when the user lands on /home
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email,
            full_name: name,
            avatar_url: avatar,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });

        if (upsertError) {
          console.error('Profile sync failed:', upsertError.message);
          // We continue anyway, but the user might see a 404 on the next page
        }

        // 4. Final Redirect
        navigate('/home', { replace: true });

      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'An unexpected error occurred during sign-in.');
        
        // Auto-redirect to login after a delay if no session was found
        if (err.message.includes('No session')) {
          setTimeout(() => navigate('/login'), 3000);
        }
      }
    };

    handleAuth();
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="max-w-md space-y-4">
          <h2 className="text-2xl font-bold text-destructive">Authentication Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center space-y-4">
        {/* You could add a Spinner component here */}
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="text-muted-foreground animate-pulse">Completing secure sign-in...</p>
      </div>
    </div>
  );
}