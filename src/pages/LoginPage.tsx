import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { login } from '@/lib/storage';
import { motion } from 'framer-motion';
import AppToast from '@/components/AppToast';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as const });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const result = login(email, password);
    if (result.success) {
      navigate('/home');
    } else {
      setToast({ show: true, message: result.error!, type: 'error' });
    }
  };

  const handleSocialLogin = (provider: string) => {
    setToast({ show: true, message: `${provider} login coming soon — requires Lovable Cloud`, type: 'error' });
  };

  const inputCls = "w-full rounded-xl bg-secondary pl-10 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-shadow";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 relative overflow-hidden">
      {/* Background decoration */}
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
              <input type={showPw ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl bg-secondary pl-10 pr-10 py-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
          </div>

          <div className="text-right">
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot Password?</Link>
          </div>

          <button type="submit" className="w-full gradient-primary rounded-xl py-3.5 text-sm font-semibold text-primary-foreground shadow-glow ripple-container transition-transform active:scale-[0.98]">
            Sign In
          </button>
        </form>

        {/* Social Login with real logos */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or continue with</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {/* Google */}
            <button onClick={() => handleSocialLogin('Google')}
              className="flex items-center justify-center rounded-xl glass-card py-3.5 hover:shadow-glow transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </button>
            {/* Facebook */}
            <button onClick={() => handleSocialLogin('Facebook')}
              className="flex items-center justify-center rounded-xl glass-card py-3.5 hover:shadow-glow transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </button>
            {/* LinkedIn */}
            <button onClick={() => handleSocialLogin('LinkedIn')}
              className="flex items-center justify-center rounded-xl glass-card py-3.5 hover:shadow-glow transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account? <Link to="/signup" className="text-primary font-medium hover:underline">Sign Up</Link>
        </p>
      </motion.div>
    </div>
  );
}
