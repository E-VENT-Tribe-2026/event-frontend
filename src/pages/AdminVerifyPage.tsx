import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, KeyRound, LogOut } from 'lucide-react';
import AppToast from '@/components/AppToast';
import { setAuthToken, clearAuthToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { logout, setCurrentUserFromOAuth } from '@/lib/storage';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { fetchAuthUserFromToken } from '@/lib/authProfile';
import { destinationAfterSignIn } from '@/lib/username';
import {
  getPendingAdminVerification,
  clearPendingAdminVerification,
  enrollMfa,
  verifyMfaCode,
  type MfaEnrollResult,
} from '@/lib/adminAuth';

/**
 * Shown to an administrator account after sign-in, before any
 * other screen, until a correct authenticator-app code is entered.
 */
export default function AdminVerifyPage() {
  const navigate = useNavigate();
  const pending = useRef(getPendingAdminVerification());

  const [enrollment, setEnrollment] = useState<MfaEnrollResult | null>(null);
  const [factorId, setFactorId] = useState<string | undefined>(pending.current?.factorId);
  const [code, setCode] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as 'error' | 'success' });

  // Nothing to verify (direct navigation).
  useEffect(() => {
    if (!pending.current) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // First-time linking: fetch the QR code once, per ticket's Scenario B.
  useEffect(() => {
    if (!pending.current || pending.current.hasMfaLinked) return;
    setIsEnrolling(true);
    enrollMfa(pending.current.accessToken).then((result) => {
      setIsEnrolling(false);
      if ('error' in result) {
        setToast({ show: true, message: result.error, type: 'error' });
        return;
      }
      setEnrollment(result);
      setFactorId(result.factor_id);
    });
  }, []);

  if (!pending.current) return null;
  const hasMfaLinked = pending.current.hasMfaLinked;

  const handleGoBackToSignIn = () => {
    logout();
    clearAuthToken();
    clearPendingAdminVerification();
    navigate('/login', { replace: true });
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending.current || isVerifying) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setToast({ show: true, message: 'Enter the 6-digit code from your authenticator app.', type: 'error' });
      return;
    }

    setIsVerifying(true);
    const result = await verifyMfaCode(pending.current.accessToken, code.trim(), factorId);
    if ('error' in result) {
      setToast({ show: true, message: result.error, type: 'error' });
      setIsVerifying(false);
      return;
    }

    // Verified — this is now an upgraded aal2 token. Continue exactly like a normal sign-in would
    setAuthToken(result.accessToken);
    if (supabase) {
      await supabase.auth.setSession({ access_token: result.accessToken, refresh_token: '' }).catch(() => {});
    }
    clearPendingAdminVerification();

    const me = await fetchAuthUserFromToken(result.accessToken);
    let avatarUrl = '';
    let fullName = me?.email?.split('@')[0] || 'Administrator';
    let bio = '';
    let interests: string[] = [];
    let username: string | undefined;
    try {
      const profileRes = await fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
        headers: { Authorization: `Bearer ${result.accessToken}`, Accept: 'application/json' },
      });
      const profileData = await profileRes.json().catch(() => ({} as Record<string, unknown>));
      const p = (profileData.data || profileData.user || profileData) as Record<string, unknown>;
      avatarUrl = String(p.avatar_url || '');
      fullName = String(p.full_name || p.name || fullName);
      bio = String(p.bio || '');
      interests = Array.isArray(p.interests) ? (p.interests as string[]) : [];
      username = typeof p.username === 'string' ? p.username : undefined;
    } catch {
      /* use defaults */
    }

    if (me?.id) {
      setCurrentUserFromOAuth({ id: me.id, email: me.email || '', name: fullName, username: username ?? '', avatar: avatarUrl, bio, interests });
    }
    navigate(destinationAfterSignIn(username), { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 relative overflow-hidden">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast((t) => ({ ...t, show: false }))} />

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[350px] rounded-full bg-accent/10 blur-[140px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm z-10">
        <div className="rounded-3xl glass-card p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-glow">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gradient">Administrator Verification</h1>
            <p className="text-sm text-muted-foreground">
              {hasMfaLinked
                ? 'Enter the code from your authenticator app to continue.'
                : 'Link an authenticator app to continue signing in as an administrator.'}
            </p>
          </div>

          {!hasMfaLinked && (
            <div className="space-y-3 text-center">
              {isEnrolling && <p className="text-xs text-muted-foreground">Preparing your QR code...</p>}
              {enrollment && (
                <>
                  <img
                    src={enrollment.totp.qr_code}
                    alt="Scan this QR code with your authenticator app"
                    className="mx-auto h-44 w-44 rounded-xl bg-white p-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Can't scan it? Enter this key manually:
                  </p>
                  <code className="block rounded-lg bg-secondary px-3 py-2 text-xs font-mono text-foreground break-all">
                    {enrollment.totp.secret}
                  </code>
                </>
              )}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-xl bg-secondary pl-10 pr-4 py-3.5 text-sm text-foreground outline-none border border-border/50 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors tracking-widest"
              />
            </div>
            <button
              type="submit"
              disabled={isVerifying || (!hasMfaLinked && !enrollment)}
              className="w-full gradient-primary rounded-xl py-3.5 text-sm font-bold text-white shadow-glow active:scale-[0.98] transition-transform disabled:opacity-70"
            >
              {isVerifying ? 'Verifying...' : 'Verify and Continue'}
            </button>
          </form>

          <button
            type="button"
            onClick={handleGoBackToSignIn}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Back to Sign In
          </button>
        </div>
      </motion.div>
    </div>
  );
}
