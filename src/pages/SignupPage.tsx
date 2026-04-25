import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Camera, ChevronDown } from 'lucide-react';
import { setCurrentUserFromOAuth } from '@/lib/storage';
import { motion, AnimatePresence } from 'framer-motion';
import AppToast from '@/components/AppToast';
import { getApiUrl } from '@/lib/api';
import { setAuthToken } from '@/lib/auth';
import { fetchAuthUserFromToken } from '@/lib/authProfile';
import { getOAuthCallbackUrl } from '@/lib/oauthRedirect';
import { supabase } from '@/lib/supabase';
import { ALL_INTERESTS } from '@/lib/interests';

const MIN_AGE = 18;
const EMAIL_RATE_LIMIT_COOLDOWN_SECONDS = 60;

export default function SignupPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [profilePhoto, setProfilePhoto] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as 'error' | 'success' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryInSeconds, setRetryInSeconds] = useState(0);
  const [showInterests, setShowInterests] = useState(false);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfilePhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

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
    if (!name.trim()) e.name = 'Name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Minimum 6 characters';
    if (password !== confirmPw) e.confirmPw = 'Passwords do not match';
    if (!dob) e.dob = 'Date of birth is required';
    else if (!isAtLeastAge(dob, MIN_AGE)) e.dob = `You must be at least ${MIN_AGE} years old`;
    if (!gender) e.gender = 'Gender is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const isRateLimitError = (message: string) => /rate limit|too many|email rate/i.test(message);

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
    
    try {
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: name, dob, gender, interests }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const isExisting = res.status === 409 || data.message?.toLowerCase().includes('exists');
        const backendMessage = String(data.detail || data.message || '').trim();
        const isRateLimited = isRateLimitError(backendMessage);
        if (isRateLimited) {
          startRetryCooldown();
        }
        setToast({ 
          show: true, 
          message: isExisting
            ? 'An account with this email already exists.'
            : isRateLimited
              ? 'Too many email requests. Please wait 1 minute before trying again.'
              : (backendMessage || 'Signup failed'),
          type: 'error' 
        });
        setIsSubmitting(false);
        return;
      }

      if (!data.access_token) {
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
          message: 'Account created but profile id could not be loaded. Try signing in.',
          type: 'error',
        });
        setIsSubmitting(false);
        window.clearTimeout(timeout);
        navigate('/login');
        return;
      }

      setCurrentUserFromOAuth({
        id: me.id,
        email: me.email || email,
        name,
        avatar: profilePhoto || undefined,
        interests,
      });

      navigate('/home');
    } catch {
      setToast({ show: true, message: 'Server unreachable. Please try again later.', type: 'error' });
      setIsSubmitting(false);
    } finally {
      window.clearTimeout(timeout);
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-8 relative">
      <AppToast 
        message={toast.message} 
        type={toast.type} 
        show={toast.show} 
        onClose={() => setToast(t => ({ ...t, show: false }))} 
      />
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gradient">Create Account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Join E-VENT and discover events</p>
        </div>

        {/* Profile Photo */}
        <div className="flex justify-center">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative h-20 w-20 rounded-full bg-secondary ring-2 ring-primary/30 overflow-hidden group">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Camera className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            )}
            <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="h-5 w-5 text-foreground" />
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Name */}
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </div>
          {errors.name && <p className="text-xs text-destructive px-1">{errors.name}</p>}

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
          <button type="button" onClick={() => setShowInterests(!showInterests)} className="w-full rounded-xl bg-secondary px-4 py-3 text-xs text-left flex justify-between items-center hover:bg-secondary/80 transition-colors">
            <span className="truncate">
              {interests.length ? interests.join(', ') : 'Select Interests'}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showInterests ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {showInterests && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex flex-wrap gap-2 p-3 bg-secondary/50 rounded-xl border border-border/50">
                  {ALL_INTERESTS.map(i => (
                    <button key={i} type="button" onClick={() => toggleInterest(i)} className={`px-3 py-1 text-[10px] font-medium rounded-full transition-all ${interests.includes(i) ? 'bg-primary text-primary-foreground shadow-glow' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                      {i}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
      </motion.div>
    </div>
)
}