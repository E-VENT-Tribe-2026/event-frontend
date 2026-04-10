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

      if (!res.ok) {
        setToast({ show: true, message: 'Invalid credentials', type: 'error' });
        setIsSubmitting(false);
        return;
      }

      const data = await res.json();
      setAuthToken(data.access_token);
      if (supabase) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token || '',
        });
      }

      const me = await fetchAuthUserFromToken(data.access_token);
      if (!me?.id) {
        setToast({
          show: true,
          message: 'Signed in but could not load your account id. Try again or contact support.',
          type: 'error',
        });
        setIsSubmitting(false);
        return;
      }

      setCurrentUserFromOAuth({
        id: me.id,
        email: me.email || email,
        name: email.split('@')[0],
      });
      navigate('/home');
    } catch {
      setToast({ show: true, message: 'Connection failed', type: 'error' });
      setIsSubmitting(false);
    }
  };

  const inputCls = "w-full rounded-xl bg-secondary pl-10 pr-4 py-3.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 relative overflow-hidden">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-8 z-10">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center text-white text-2xl font-bold">E</div>
          <h1 className="text-3xl font-bold text-gradient">E-VENT</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} /></div>
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
          </div>
          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type={showPw ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full gradient-primary rounded-xl py-3.5 text-sm font-bold text-white shadow-glow">{isSubmitting ? 'Signing In...' : 'Sign In'}</button>
        </form>

        <p className="text-center text-sm text-muted-foreground">Don't have an account? <Link to="/signup" className="text-primary font-medium hover:underline">Sign Up</Link></p>
      </motion.div>
    </div>
  );
}
