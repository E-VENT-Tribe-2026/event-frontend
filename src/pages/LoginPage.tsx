import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Ensure your router import is correct
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { setCurrentUserFromOAuth } from '@/lib/storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { motion } from 'framer-motion';
import AppToast from '@/components/AppToast';
import { getApiUrl } from '@/lib/api';
import { setAuthToken } from '@/lib/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as const });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;
    setIsSubmitting(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    try {
      // 1. Call your custom backend login
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setToast({ 
          show: true, 
          message: (err.detail || 'Invalid email or password') as string, 
          type: 'error' 
        });
        setIsSubmitting(false);
        return;
      }

      const data = await res.json();
      const accessToken = data?.access_token;
      const refreshToken = data?.refresh_token; // Highly recommended to return this from backend

      if (!accessToken) {
        throw new Error('Login successful but no access token received.');
      }

      // 2. Sync the token with your Auth utility
      setAuthToken(accessToken);

      // 3. IMPORTANT: Manually tell Supabase about this session
      // This allows supabase.auth.getSession() to work in CreateEventPage
      if (supabase && accessToken) {
        // If your backend doesn't provide a refresh token, 
        // Supabase will work but won't be able to auto-refresh the session.
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '', 
        });
      }

      // 4. Map backend user data to your local storage
      const backendUser = data?.user ?? {};
      const userId = backendUser?.id ?? data?.user_id ?? `user_${Date.now()}`;
      const userName = backendUser?.full_name ?? backendUser?.name ?? email.split('@')[0];
      const avatar = backendUser?.avatar_url ?? backendUser?.picture;

      setCurrentUserFromOAuth({
        id: String(userId),
        email,
        name: String(userName),
        avatar: avatar ? String(avatar) : undefined,
      });

      navigate('/home');
    } catch (err: any) {
      const isAbort = err.name === 'AbortError';
      setToast({ 
        show: true, 
        message: isAbort ? 'Server took too long to respond.' : 'Cannot reach server. Is the backend running?', 
        type: 'error' 
      });
    } finally {
      setIsSubmitting(false);
      window.clearTimeout(timeout);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setToast({ show: true, message: 'Supabase is not configured in .env', type: 'error' });
      return;
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) setToast({ show: true, message: error.message, type: 'error' });
  };

  const inputCls = "w-full rounded-xl bg-secondary pl-10 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-shadow";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-accent/10 blur-[100px]" />

      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-8 relative z-10">
        <div className="text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
            className="mx-auto mb-4 h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
            <span className="text-2xl font-bold text-primary-foreground">E</span>
          </motion.div>
          <h1 className="text-3xl font-bold text-gradient">E-VENT</h1>
          <p className="mt-2 text-sm text-muted-foreground">Welcome back! Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
            </div>
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
          </div>

          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type={showPw ? 'text' : 'password'} 
                placeholder="Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl bg-secondary pl-10 pr-10 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50" 
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
          </div>

          <div className="text-right">
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot Password?</Link>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full gradient-primary rounded-xl py-3.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-60" 
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or continue with</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <button 
            type="button" 
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center rounded-xl glass-card py-3.5 hover:shadow-glow transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" className="mr-2">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-sm font-medium">Google</span>
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account? <Link to="/signup" className="text-primary font-medium hover:underline">Sign Up</Link>
        </p>
      </motion.div>
    </div>
  );
}