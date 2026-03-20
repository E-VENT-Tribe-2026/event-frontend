import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Camera, Calendar, ChevronDown } from 'lucide-react';
import { signup } from '@/lib/storage';
import { motion, AnimatePresence } from 'framer-motion';
import AppToast from '@/components/AppToast';

const ALL_INTERESTS = ['Music', 'Sports', 'Gaming', 'Movies', 'Study', 'Travel', 'Tech', 'Art', 'Fitness', 'Coffee', 'Networking', 'Food', 'Wellness'];
const MIN_AGE = 18;

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
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as const });
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    // isoDate expected "YYYY-MM-DD" from <input type="date" />
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;
    setIsSubmitting(true);

    // Register on backend/Supabase before considering signup complete.
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8001';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          full_name: name,
          dob,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = (data && (data.detail || data.message)) || 'Signup failed on server';
        setToast({ show: true, message, type: 'error' });
        setIsSubmitting(false);
        return;
      }

      const data = await res.json().catch(() => null);
      const token = data?.access_token;
      if (token) localStorage.setItem('api_token', token);

      // Keep local app profile in sync only after server signup succeeds.
      const result = signup({ role: 'participant', name, email, password, profilePhoto, dob, gender, interests });
      if (!result.success) {
        setToast({ show: true, message: result.error!, type: 'error' });
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      navigate('/login');
    } catch {
      setToast({ show: true, message: 'Cannot reach server. Start backend and try again.', type: 'error' });
      setIsSubmitting(false);
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const inputCls = "w-full rounded-xl bg-secondary pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-8">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />
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
          <div>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
            </div>
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
            </div>
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key="signup-fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
              {/* DOB */}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Date of Birth</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input type="date" value={dob} onChange={e => setDob(e.target.value)} className={inputCls} />
                </div>
                {errors.dob && <p className="mt-1 text-xs text-destructive">{errors.dob}</p>}
              </div>
              {/* Gender */}
              <div>
                <div className="relative">
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <select value={gender} onChange={e => setGender(e.target.value)} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50 appearance-none">
                    <option value="" disabled>Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {errors.gender && <p className="mt-1 text-xs text-destructive">{errors.gender}</p>}
              </div>
              {/* Interests */}
              <div>
                <button type="button" onClick={() => setShowInterests(!showInterests)}
                  className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-left flex items-center justify-between text-foreground">
                  <span className={interests.length ? 'text-foreground' : 'text-muted-foreground'}>
                    {interests.length ? interests.join(', ') : 'Select Interests'}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showInterests ? 'rotate-180' : ''}`} />
                </button>
                {showInterests && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 flex flex-wrap gap-2 rounded-xl bg-secondary p-3">
                    {ALL_INTERESTS.map(i => (
                      <button key={i} type="button" onClick={() => toggleInterest(i)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${interests.includes(i) ? 'gradient-primary text-primary-foreground shadow-glow' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                        {i}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Password */}
          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type={showPw ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl bg-secondary pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type={showConfirmPw ? 'text' : 'password'} placeholder="Confirm Password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="w-full rounded-xl bg-secondary pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50" />
              <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPw && <p className="mt-1 text-xs text-destructive">{errors.confirmPw}</p>}
          </div>

          <button type="submit" className="w-full gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow ripple-container transition-transform active:scale-[0.98] disabled:opacity-60" disabled={isSubmitting}>
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign In</Link>
        </p>
      </motion.div>
    </div>
  );
}
