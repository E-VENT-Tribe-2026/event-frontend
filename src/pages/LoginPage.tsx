import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';
import { setCurrentUserFromOAuth } from '@/lib/storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import AppToast from '@/components/AppToast';
import { getApiUrl } from '@/lib/api';
import { setAuthToken } from '@/lib/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as const });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Check if we were redirected back because account doesn't exist
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('error') === 'user_not_found') {
      setShowSignupModal(true);
    }
  }, [location]);

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

      if (!res.ok) {
        setToast({ show: true, message: 'Invalid credentials', type: 'error' });
        setIsSubmitting(false);
        return;
      }

      const data = await res.json();
      setAuthToken(data.access_token);
      if (supabase) await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token || '' });
      
      setCurrentUserFromOAuth({
        id: String(data.user?.id || Date.now()),
        email,
        name: data.user?.full_name || email.split('@')[0],
      });
      navigate('/home');
    } catch {
      setToast({ show: true, message: 'Connection failed', type: 'error' });
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setToast({ show: true, message: 'Supabase not configured', type: 'error' });
      return;
    }
    const redirectTo = `${window.location.origin}/auth/callback?check_exists=true`;
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  };

  const inputCls = "w-full rounded-xl bg-secondary pl-10 pr-4 py-3.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 relative overflow-hidden">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />
      
      {/* Modal for non-existent users */}
      <AnimatePresence>
        {showSignupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-xs rounded-2xl bg-card border border-border p-6 text-center shadow-2xl">
              <AlertCircle className="mx-auto h-10 w-10 text-primary mb-4" />
              <h3 className="text-lg font-bold">No Account Found</h3>
              <p className="mt-2 text-sm text-muted-foreground">We couldn't find an account for this Google profile. Create one now?</p>
              <div className="mt-6 flex flex-col gap-2">
                <button onClick={() => navigate('/signup')} className="w-full gradient-primary py-2.5 rounded-xl text-sm font-bold text-white">Sign Up</button>
                <button onClick={() => setShowSignupModal(false)} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-8 z-10">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center text-white text-2xl font-bold">E</div>
          <h1 className="text-3xl font-bold text-gradient">E-VENT</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type={showPw ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full gradient-primary rounded-xl py-3.5 text-sm font-bold text-white shadow-glow">{isSubmitting ? 'Signing In...' : 'Sign In'}</button>
        </form>

        <div className="space-y-4">
          <div className="flex items-center gap-3"><div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">or continue with</span><div className="flex-1 h-px bg-border" /></div>
          <button onClick={handleGoogleLogin} className="flex w-full items-center justify-center gap-3 rounded-xl glass-card py-3.5 hover:shadow-glow transition-all">
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            <span className="text-sm font-medium">Google</span>
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground">Don't have an account? <Link to="/signup" className="text-primary font-medium hover:underline">Sign Up</Link></p>
      </motion.div>
    </div>
  );
}