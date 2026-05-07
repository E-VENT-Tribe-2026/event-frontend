import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, XCircle, Loader } from 'lucide-react';
import { motion } from 'framer-motion';
import AppToast from '@/components/AppToast';
import AppLogo from '@/components/AppLogo';
import { getApiUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';

type VerifyState = 'verifying' | 'valid' | 'invalid';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Token comes from the email link in multiple possible formats:
  // 1. Query param: /reset-password?token=xxx or ?access_token=xxx
  // 2. Hash fragment: /reset-password#access_token=xxx&type=recovery (Supabase implicit flow)
  // 3. PKCE code: /reset-password?code=xxx (Supabase PKCE flow — exchanged for session below)
  const token = useMemo(() => {
    const fromQuery = searchParams.get('token') || searchParams.get('access_token') || '';
    if (fromQuery) return fromQuery;
    if (typeof window !== 'undefined') {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      return hashParams.get('access_token') || hashParams.get('token') || '';
    }
    return '';
  }, [searchParams]);

  const pkceCode = searchParams.get('code') || '';

  const [verifyState, setVerifyState] = useState<VerifyState>('verifying');
  const [verifyError, setVerifyError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });

  // Step 1: Verify/exchange the token as soon as the page loads
  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      // Case 1: PKCE code — exchange it for a session via Supabase
      if (pkceCode && supabase) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(pkceCode);
          if (cancelled) return;
          if (error || !data?.session?.access_token) {
            setVerifyState('invalid');
            setVerifyError('This reset link is invalid or has expired. Please request a new one.');
            return;
          }
          // Store the access token so the reset submit can use it
          (window as any).__resetToken = data.session.access_token;
          setVerifyState('valid');
        } catch {
          if (!cancelled) {
            setVerifyState('invalid');
            setVerifyError('Could not verify the reset link. Please try again.');
          }
        }
        return;
      }

      // Case 2: Direct token (query param or hash)
      if (!token) {
        setVerifyState('invalid');
        setVerifyError('No reset token found. Please request a new password reset link.');
        return;
      }

      // Supabase JWTs are long (>100 chars) — skip the verify endpoint, go straight to form
      if (token.length > 100) {
        setVerifyState('valid');
        return;
      }

      // Custom backend token — call verify endpoint
      setVerifyState('verifying');
      try {
        const res = await fetch(getApiUrl(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`), {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (cancelled) return;
        if (res.ok) {
          setVerifyState('valid');
        } else {
          const data = await res.json().catch(() => ({}));
          setVerifyState('invalid');
          setVerifyError(String(data?.detail || data?.message || 'This reset link is invalid or has expired.'));
        }
      } catch {
        if (!cancelled) {
          setVerifyState('invalid');
          setVerifyError('Could not verify the reset link. Please try again.');
        }
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [token, pkceCode]);

  // Step 2: Submit new password
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError('Must contain at least one uppercase letter.');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError('Must contain at least one number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      // Use the PKCE-exchanged token if available, otherwise use the direct token
      const effectiveToken = (window as any).__resetToken || token;
      const res = await fetch(getApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: effectiveToken,
          access_token: effectiveToken,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(data?.detail || data?.message || 'Failed to reset password.'));
      }
      setToast({ show: true, message: 'Password updated! Redirecting to sign in…', type: 'success' });
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err: unknown) {
      setToast({
        show: true,
        message: err instanceof Error ? err.message : 'Failed to reset password.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full rounded-xl bg-secondary pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border/50 focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-colors';

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
        <div className="rounded-3xl glass-card p-8 space-y-7">

          {/* Logo */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <AppLogo size="lg" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient">Set New Password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {verifyState === 'verifying' ? 'Verifying your reset link…' :
                 verifyState === 'valid' ? 'Enter your new password below' :
                 'Reset link issue'}
              </p>
            </div>
          </div>

          {/* Verifying state */}
          {verifyState === 'verifying' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Checking your reset link…</p>
            </div>
          )}

          {/* Invalid token state */}
          {verifyState === 'invalid' && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-destructive/10 border border-destructive/20 p-5 text-center">
                <XCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm font-semibold text-foreground">Link invalid or expired</p>
                <p className="text-xs text-muted-foreground">{verifyError}</p>
              </div>
              <Link
                to="/forgot-password"
                className="block w-full text-center rounded-2xl gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow active:scale-[0.98] transition-transform"
              >
                Request a new link
              </Link>
            </div>
          )}

          {/* Valid token — show password form */}
          {verifyState === 'valid' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-3 py-2">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                <p className="text-xs text-green-600 dark:text-green-400">Reset link verified — set your new password</p>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type={showNew ? 'text' : 'password'}
                      placeholder="New password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className={inputCls}
                    />
                    <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground px-1">Min 8 chars, one uppercase, one number</p>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={inputCls}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {error && <p className="text-xs text-destructive px-1">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting || !newPassword || !confirmPassword}
                className="w-full gradient-primary rounded-2xl py-3 text-sm font-bold text-primary-foreground shadow-glow ripple-container active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {submitting ? 'Updating…' : 'Update Password'}
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
