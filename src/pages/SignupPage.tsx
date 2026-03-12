import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ChevronDown, Building2, X } from 'lucide-react';
import { signup, type SignupPayload } from '@/lib/api';
import type { UserRole } from '@/lib/storage';
import { motion, AnimatePresence } from 'framer-motion';
import AppToast from '@/components/AppToast';

const ORG_CATEGORIES = ['Entertainment', 'Education', 'Tech', 'Sports', 'Food & Beverage', 'Art & Culture', 'Nonprofit', 'Corporate'];

interface SignupPageProps {
  onClose?: () => void;
}

export default function SignupPage({ onClose }: SignupPageProps) {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>('participant');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [gender, setGender] = useState('');
  const [orgCategory, setOrgCategory] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as const });
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(-1);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = role === 'organizer' ? 'Organization name required' : 'Name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Minimum 6 characters';
    if (password !== confirmPw) e.confirmPw = 'Passwords do not match';
    if (role === 'participant' && !gender) e.gender = 'Gender is required';
    if (role === 'organizer' && !orgCategory) e.orgCategory = 'Category is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || loading) return;

    const payload: SignupPayload = {
      role,
      name,
      email,
      password,
      profilePhoto: '',
      dob: '',
      gender,
      interests: [],
      orgCategory: role === 'organizer' ? orgCategory : undefined,
    };

    setLoading(true);
    const result = await signup(payload);
    setLoading(false);

    if (result.success) {
      navigate('/home');
    } else {
      setToast({ show: true, message: result.error || 'Signup failed', type: 'error' });
    }
  };

  const inputCls = "w-full rounded-xl bg-secondary pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="relative w-full max-w-sm space-y-6 rounded-2xl bg-card p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Create Account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Join E-VENT and discover events</p>
        </div>

        {/* Role Toggle */}
        <div className="flex rounded-xl bg-secondary p-1">
          {(['participant', 'organizer'] as UserRole[]).map(r => {
            const isIndividual = r === 'participant';
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                  role === r ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-muted-foreground hover:text-foreground'
                } flex items-center justify-center gap-1`}
              >
                {isIndividual ? <User className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                <span>{isIndividual ? 'Individual' : 'Organization'}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Name */}
          <div>
            <div className="relative">
              {role === 'organizer' ? <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /> : <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
              <input type="text" placeholder={role === 'organizer' ? 'Organization Name' : 'Full Name'} value={name} onChange={e => setName(e.target.value)} className={inputCls} />
            </div>
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="email" placeholder={role === 'organizer' ? 'Contact Email' : 'Email'} value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
            </div>
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
          </div>

          <AnimatePresence mode="wait">
            {role === 'participant' ? (
              <motion.div
                key="participant-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                {/* Gender */}
                <div>
                  <div className="relative">
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <select
                      value={gender}
                      onChange={e => setGender(e.target.value)}
                      className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                    >
                      <option value="" disabled>
                        Select Gender
                      </option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {errors.gender && <p className="mt-1 text-xs text-destructive">{errors.gender}</p>}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="organizer-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                {/* Org Category */}
                <div>
                  <div className="relative">
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <select
                      value={orgCategory}
                      onChange={e => setOrgCategory(e.target.value)}
                      className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                    >
                      <option value="" disabled>
                        Organization Category
                      </option>
                      {ORG_CATEGORIES.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.orgCategory && <p className="mt-1 text-xs text-destructive">{errors.orgCategory}</p>}
                </div>
              </motion.div>
            )}
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

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground shadow-glow ripple-container transition-transform active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : role === 'organizer' ? 'Create Organization' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign In</Link>
        </p>
      </motion.div>
    </div>
  );
}
