import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AtSign, Eye, EyeOff, Mail, Lock, User, ChevronDown } from 'lucide-react';
import { setCurrentUserFromOAuth } from '@/lib/storage';
import { motion, AnimatePresence } from 'framer-motion';
import AppToast from '@/components/AppToast';
import { getApiUrl } from '@/lib/api';
import { setAuthToken } from '@/lib/auth';
import { fetchAuthUserFromToken } from '@/lib/authProfile';
import { getOAuthCallbackUrl } from '@/lib/oauthRedirect';
import { supabase } from '@/lib/supabase';
import { ALL_INTERESTS } from '@/lib/interests';
import { sanitizeEmail } from '@/lib/sanitize';
import {
  FULL_NAME_RULES_HINT,
  USERNAME_RULES_HINT,
  getFullNameValidationError,
  getUsernameValidationError,
  normalizeFullName,
  normalizeUsername,
} from '@/lib/username';
import { pickDefaultIconUrl } from '@/lib/uploadAvatar';

const MIN_AGE = 18;
const EMAIL_RATE_LIMIT_COOLDOWN_SECONDS = 60;

export default function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as 'error' | 'success' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryInSeconds, setRetryInSeconds] = useState(0);
  const [showInterests, setShowInterests] = useState(false);

  const usernameErrorLive = username ? getUsernameValidationError(username) : null;
  const nameErrorLive = name ? getFullNameValidationError(name) : null;

  const toggleInterest = (i: string) => {
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const isAtLeastAge = (isoDate: string, minAge: number) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    if (!y || !m || !d) return false;
    const dobDate = new Date(y, m - 1, d);
    if (Number.isNaN(dobDate.getTime())) return false;
    const today = new Date();
    const cutoff = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
    return dobDate <= cutoff;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const usernameIssue = getUsernameValidationError(username);
    if (usernameIssue) e.username = usernameIssue;
    const nameIssue = getFullNameValidationError(name);
    if (nameIssue) e.name = nameIssue;
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Minimum 8 characters';
    else if (!/[A-Z]/.test(password)) e.password = 'Must contain at least one uppercase letter';
    else if (!/[0-9]/.test(password)) e.password = 'Must contain at least one number';
    if (password !== confirmPw) e.confirmPw = 'Passwords do not match';
    if (!dob) e.dob = 'Date of birth is required';
    else if (!isAtLeastAge(dob, MIN_AGE)) e.dob = `You must be at least ${MIN_AGE} years old`;
    if (!gender) e.gender = 'Gender is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const isRateLimitError = (message: string) => /rate limit|too many|email rate/i.test(message);

  const conflictMessage = (backendMessage: string) => {
    const lowered = backendMessage.toLowerCase();
    if (lowered.includes('username')) return 'This username is already in use.';
    if (lowered.includes('email')) return 'This email address is already in use.';
    return backendMessage || 'This email address or username is already in use.';
  };

  const applyConflictToFields = (message: string) => {
    const lowered = message.toLowerCase();
    if (lowered.includes('username') && !lowered.includes('email')) {
      setErrors(prev => ({ ...prev, username: message }));
    } else if (lowered.includes('email') && !lowered.includes('username')) {
      setErrors(prev => ({ ...prev, email: message }));
    }
  };

  const startRetryCooldown = () => {
    setRetryInSeconds(EMAIL_RATE_LIMIT_COOLDOWN_SECONDS);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting || retryInSeconds > 0) return;
    setIsSubmitting(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    const normalizedUsername = normalizeUsername(username);
    const defaultIconUrl = pickDefaultIconUrl();
    const cleanedName = normalizeFullName(name);

    try {
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sanitizeEmail(email),
          password,
          username: normalizedUsername,
          full_name: cleanedName,
          avatar_url: defaultIconUrl,
          dob,
          gender,
          interests,
        }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const rawDetail = data.detail ?? data.message ?? '';
        const backendMessage = (typeof rawDetail === 'string' ? rawDetail : '').trim();
        const isExisting = res.status === 409 || /already|in use|exists/i.test(backendMessage);
        const isRateLimited = isRateLimitError(backendMessage);
        if (isRateLimited) {
          startRetryCooldown();
        }
        const shown = isExisting
          ? conflictMessage(backendMessage)
          : isRateLimited
            ? 'Too many email requests. Please wait 1 minute before trying again.'
            : (backendMessage || 'Signup failed');
        if (isExisting) {
          applyConflictToFields(shown);
        } else if (res.status === 400 && /username/i.test(backendMessage)) {
          setErrors(prev => ({ ...prev, username: backendMessage }));
        }
        setToast({
          show: true,
          message: shown,
          type: 'error',
        });
        return;
      }

      const accessToken = typeof data.access_token === 'string' ? data.access_token : '';
      const refreshToken = typeof data.refresh_token === 'string' ? data.refresh_token : '';

      if (!accessToken) {
        setToast({
          show: true,
          message: data.message || 'Check your email to confirm your account, then sign in.',
          type: 'success',
        });
        setIsSubmitting(false);
        window.clearTimeout(timeout);
        navigate('/login');
        return;
      }

      setAuthToken(accessToken);
      if (supabase && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }

      const me = await fetchAuthUserFromToken(accessToken);
      if (!me?.id) {
        setToast({
          show: true,
          message: 'Account created but profile id could not be loaded. Try signing in.',
          type: 'error',
        });
        setIsSubmitting(false);
        window.clearTimeout(timeout);
        navigate('/login');
        return;
      }

      const avatarUrl = defaultIconUrl;

      setCurrentUserFromOAuth({
        id: me.id,
        email: me.email || email,
        name: cleanedName,
        avatar: avatarUrl,
        interests,
      });
      setPassword('');
      setConfirmPw('');
      navigate('/home');
    } catch {
      setToast({ show: true, message: 'Server unreachable. Please try again later.', type: 'error' });
    } finally {
      window.clearTimeout(timeout);
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getOAuthCallbackUrl('/home'),
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      setToast({ show: true, message: 'Google sign-up failed', type: 'error' });
    }
  };

  const inputCls = "w-full rounded-xl bg-secondary pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all";

return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-8 relative overflow-hidden">
      <AppToast 
        message={toast.message} 
        type={toast.type} 
        show={toast.show} 
        onClose={() => setToast(t => ({ ...t, show: false }))} 
      />

      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 right-1/4 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(hsl(213 30% 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(213 30% 60%) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm z-10">
        <div className="rounded-3xl glass-card p-8 space-y-6">
        <div className="text-center space-y-1">
          <div className="mx-auto mb-3 relative h-16 w-16 flex items-center justify-center">
            <motion.div
              className="absolute inset-0 rounded-2xl border-2 border-primary/50"
              animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            />
            <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center text-white text-2xl font-bold shadow-glow">E</div>
          </div>
          <h1 className="text-3xl font-bold text-gradient">Create Account</h1>
          <p className="text-sm text-muted-foreground">Join E-VENT and discover events</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Username (required) */}
          <div className="space-y-1">
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="signup-username"
                type="text"
                placeholder="Username"
                value={username}
                autoComplete="username"
                aria-required="true"
                aria-invalid={Boolean(errors.username || usernameErrorLive)}
                onChange={e => {
                  setUsername(e.target.value);
                  if (errors.username) setErrors(prev => ({ ...prev, username: '' }));
                }}
                className={inputCls}
                aria-describedby="username-rules"
              />
            </div>
            <p id="username-rules" className="text-[10px] text-muted-foreground px-1 leading-snug">
              {USERNAME_RULES_HINT}
            </p>
            {(errors.username || usernameErrorLive) && (
              <p className="text-xs text-destructive px-1">{errors.username || usernameErrorLive}</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="signup-full-name"
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                }}
                aria-invalid={Boolean(errors.name || nameErrorLive)}
                aria-describedby="full-name-rules"
                className={inputCls}
              />
            </div>
            <p id="full-name-rules" className="text-[10px] text-muted-foreground px-1 leading-snug">
              {FULL_NAME_RULES_HINT}
            </p>
            {(errors.name || nameErrorLive) && (
              <p className="text-xs text-destructive px-1">{errors.name || nameErrorLive}</p>
            )}
          </div>

          {/* Email */}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </div>
          {errors.email && <p className="text-xs text-destructive px-1">{errors.email}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="signup-dob" className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5 mb-1">
                Birthdate
              </label>
              <input
                id="signup-dob"
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                className="w-full rounded-xl bg-secondary px-3 py-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/50"
              />
              {errors.dob && <p className="text-xs text-destructive mt-1">{errors.dob}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="signup-gender" className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
                Gender
              </label>
              <select
                id="signup-gender"
                value={gender}
                onChange={e => setGender(e.target.value)}
                className="h-[42px] w-full rounded-xl bg-secondary px-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
              >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            </div>
          </div>

          {/* Interests */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowInterests(!showInterests)}
              className="w-full rounded-xl bg-secondary px-4 py-3 text-xs text-left flex justify-between items-center hover:bg-secondary/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">Interests</span>
                {interests.length > 0 && (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {interests.length} selected
                  </span>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showInterests ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showInterests && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {ALL_INTERESTS.map((i) => {
                      const emoji: Record<string, string> = {
                        Music: '🎵', Sports: '⚽', Gaming: '🎮', Movies: '🎬',
                        Study: '📚', Travel: '✈️', Tech: '💻', Art: '🎨',
                        Fitness: '💪', Coffee: '☕', Networking: '🤝', Food: '🍕', Wellness: '🧘',
                      };
                      const selected = interests.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleInterest(i)}
                          className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center transition-all active:scale-95 ${
                            selected
                              ? 'bg-primary/20 border border-primary/50 shadow-sm'
                              : 'bg-secondary/60 border border-transparent hover:border-border'
                          }`}
                        >
                          <span className="text-xl">{emoji[i] ?? '✨'}</span>
                          <span className={`text-[10px] font-medium leading-tight ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                            {i}
                          </span>
                          {selected && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Password */}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type={showPw ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive px-1">{errors.password}</p>}

          {/* Confirm Password */}
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type={showConfirmPw ? 'text' : 'password'} placeholder="Confirm Password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={inputCls} />
            <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPw && <p className="text-xs text-destructive px-1">{errors.confirmPw}</p>}

          <button type="submit" disabled={isSubmitting || retryInSeconds > 0} className="w-full gradient-primary rounded-xl py-3 text-sm font-bold text-primary-foreground shadow-glow transition-all active:scale-[0.98] disabled:opacity-70">
            {isSubmitting ? 'Creating Account...' : retryInSeconds > 0 ? `Try again in ${retryInSeconds}s` : 'Create Account'}
          </button>
        </form>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or join with</span></div>
        </div>
        
        <button onClick={handleGoogleSignup} className="w-full flex items-center justify-center gap-3 rounded-xl glass-card py-3 hover:shadow-glow transition-all active:scale-[0.98]">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="text-sm font-medium">Google</span>
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign In</Link>
        </p>
        </div>
      </motion.div>
    </div>
)
}
