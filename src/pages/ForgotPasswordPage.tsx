import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import AppToast from '@/components/AppToast';
import { getApiUrl } from '@/lib/api';
import { getOAuthRedirectBaseUrl } from '@/lib/oauthRedirect';

const SUCCESS_RESEND_COOLDOWN_SECONDS = 60;
const DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS = 120;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetAccessToken = useMemo(() => {
    const queryToken = searchParams.get('access_token') || searchParams.get('token') || '';
    if (queryToken.trim()) return queryToken.trim();
    if (typeof window === 'undefined') return '';
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hashType = hashParams.get('type') || '';
    const hashToken = hashParams.get('access_token') || hashParams.get('token') || '';
    if (hashType.toLowerCase() === 'recovery' && hashToken.trim()) {
      return hashToken.trim();
    }
    return '';
  }, [searchParams]);
  const isResetMode = useMemo(() => resetAccessToken.trim().length > 0, [resetAccessToken]);

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [retryInSeconds, setRetryInSeconds] = useState(0);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });

  const isRateLimitError = (message: string) => /rate limit|too many|email rate/i.test(message);
  const parseRetryAfter = (value: string | null): number | null => {
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.max(30, Math.min(Math.floor(parsed), 1800));
  };

  const startRetryCooldown = (seconds: number) => {
    setRetryInSeconds(seconds);
    const timer = window.setInterval(() => {
      setRetryInSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || retryInSeconds > 0) return;
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          redirect_origin: getOAuthRedirectBaseUrl(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = String(data?.detail || 'Unable to send reset link');
        const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
        throw { message, status: res.status, retryAfter };
      }
      startRetryCooldown(SUCCESS_RESEND_COOLDOWN_SECONDS);
      setToast({ show: true, message: 'Password reset link sent. Check your email.', type: 'success' });
    } catch (err: unknown) {
      const errorObj = err as { message?: string; status?: number; retryAfter?: number };
      const message = String(errorObj?.message || 'Unable to send reset link.');
      const isRateLimited = errorObj?.status === 429 || isRateLimitError(message);
      if (isRateLimited) {
        startRetryCooldown(errorObj?.retryAfter || DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS);
      }
      setToast({
        show: true,
        message: isRateLimited
          ? 'Too many reset attempts. Please wait before trying again.'
          : message,
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: resetAccessToken,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || 'Failed to reset password');
      }
      setToast({ show: true, message: 'Password updated successfully. Redirecting to login...', type: 'success' });
      window.setTimeout(() => navigate('/login', { replace: true }), 1300);
    } catch (err: any) {
      setToast({ show: true, message: err?.message || 'Failed to reset password.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 relative overflow-hidden">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/3 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(hsl(213 30% 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(213 30% 60%) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm z-10">
        <div className="rounded-3xl glass-card p-8 space-y-8">
          {/* Logo + heading */}
          <div className="text-center space-y-3">
            <div className="relative mx-auto h-16 w-16 flex items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-2xl border-2 border-primary/50"
                animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2.2, repeat: Infinity }}
              />
              <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center text-white text-2xl font-bold shadow-glow">E</div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gradient">{isResetMode ? 'Set New Password' : 'Reset Password'}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {isResetMode ? 'Enter and confirm your new password' : 'Enter your email to receive a reset link'}
              </p>
            </div>
          </div>

        {!isResetMode ? (
          <form onSubmit={handleRequestSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-xl bg-secondary pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
            </div>
            <button type="submit" disabled={submitting || retryInSeconds > 0} className="w-full gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow ripple-container transition-transform active:scale-[0.98] disabled:opacity-60">
              {submitting ? 'Sending...' : retryInSeconds > 0 ? `Try again in ${retryInSeconds}s` : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="New password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full rounded-xl bg-secondary pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button type="button" onClick={() => setShowNewPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl bg-secondary pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
            </div>
            <button type="submit" disabled={submitting || !newPassword || !confirmPassword} className="w-full gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow ripple-container transition-transform active:scale-[0.98] disabled:opacity-60">
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary font-medium hover:underline">← Back to Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
