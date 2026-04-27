import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { setCurrentUserFromOAuth } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import AppToast from '@/components/AppToast';
import { getApiUrl } from '@/lib/api';
import { setAuthToken } from '@/lib/auth';
import { fetchAuthUserFromToken } from '@/lib/authProfile';
import { getOAuthCallbackUrl } from '@/lib/oauthRedirect';

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
    if (!email.trim()) e.email = 'Email required';
    if (!password) e.password = 'Password required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const detail = String((data as any)?.detail || (data as any)?.message || '').trim();
        const lowered = detail.toLowerCase();
        const message = lowered.includes('not confirmed')
          ? 'Your email is not confirmed yet. Check your inbox/spam for the verification email.'
          : detail || 'Invalid credentials';
        setToast({ show: true, message, type: 'error' });
        setIsSubmitting(false);
        return;
      }
      setAuthToken(data.access_token);
      if (supabase) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token || '',
        });
      }
      const me = await fetchAuthUserFromToken(data.access_token);
      if (!me?.id) {
        setToast({ show: true, message: 'Signed in but could not load your account. Try again.', type: 'error' });
        setIsSubmitting(false);
        return;
      }
      setCurrentUserFromOAuth({ id: me.id, email: me.email || email, name: email.split('@')[0] });
      navigate('/home');
    } catch {
      setToast({ show: true, message: 'Connection failed', type: 'error' });
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getOAuthCallbackUrl('/home'),
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) setToast({ show: true, message: 'Google sign-in failed', type: 'error' });
  };

  const inputCls =
    'w-full rounded-xl bg-secondary pl-10 pr-4 py-3.5 text-sm text-foreground outline-none border border-border/50 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 relative overflow-hidden">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute top-1/2 -right-32 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[350px] rounded-full bg-primary/10 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(hsl(213 30% 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(213 30% 60%) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm z-10"
      >
        <div className="rounded-3xl glass-card p-8 space-y-7">
          {/* Logo */}
          <div className="text-center space-y-3">
            <div className="relative mx-auto h-20 w-20 flex items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-3xl border-2 border-primary/50"
                animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2.2, repeat: Infinity }}
              />
              <div className="absolute inset-0 rounded-3xl border border-primary/30 shadow-glow" />
              <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center text-white text-3xl font-bold shadow-glow">
                E
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gradient">Welcome back</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your E-VENT account</p>
            </div>
          </div>

          {/* Form */}
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
                <input type={showPw ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
              <div className="mt-2 text-right">
                <Link to="/forgot-password" className="text-sm text-primary font-semibold hover:underline">Forgot my password?</Link>
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full gradient-primary rounded-xl py-3.5 text-sm font-bold text-white shadow-glow ripple-container active:scale-[0.98] transition-transform disabled:opacity-70">
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Google */}
          <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 rounded-xl border border-border bg-secondary py-3.5 text-sm font-medium text-foreground hover:bg-secondary/80 active:scale-[0.98] transition-all">
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account? <Link to="/signup" className="text-primary font-medium hover:underline">Sign Up</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
