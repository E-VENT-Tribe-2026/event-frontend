import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import AppToast from '@/components/AppToast';
import { getApiUrl } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { setCurrentUserFromOAuth } from '@/lib/storage';
import {
  FULL_NAME_RULES_HINT,
  USERNAME_RULES_HINT,
  fullNameError,
  hasChosenUsername,
  normalizeUsername,
  usernameError,
} from '@/lib/username';

const GOOGLE_NAME_KEY = 'eventapp:google-name';

export function rememberGoogleName(name: string) {
  const trimmed = name.trim();
  if (trimmed) sessionStorage.setItem(GOOGLE_NAME_KEY, trimmed);
  else sessionStorage.removeItem(GOOGLE_NAME_KEY);
}

export default function ChooseUsernamePage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as 'error' | 'success' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profile = await res.json().catch(() => ({} as { username?: string; full_name?: string }));
      if (cancelled) return;
      if (hasChosenUsername(profile.username)) {
        navigate('/home', { replace: true });
        return;
      }
      const savedName = typeof profile.full_name === 'string' ? profile.full_name.trim() : '';
      const googleName = sessionStorage.getItem(GOOGLE_NAME_KEY)?.trim() || '';
      setFullName(savedName || googleName);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    const nameProblem = fullNameError(fullName);
    const usernameProblem = usernameError(username);
    if (nameProblem) nextErrors.fullName = nameProblem;
    if (usernameProblem) nextErrors.username = usernameProblem;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || isSubmitting) return;

    const token = getAuthToken();
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    setIsSubmitting(true);
    const typedName = fullName.trim();
    try {
      const nameRes = await fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ full_name: typedName }),
      });
      const nameData = await nameRes.json().catch(() => ({} as { detail?: string }));
      if (!nameRes.ok) {
        const detail = String(nameData.detail || 'Full name could not be saved');
        setErrors({ fullName: detail });
        setToast({ show: true, message: detail, type: 'error' });
        setIsSubmitting(false);
        return;
      }

      const usernameRes = await fetch(getApiUrl('/api/profile/username'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: normalizeUsername(username) }),
      });
      const usernameData = await usernameRes.json().catch(() => ({} as { detail?: string }));
      if (!usernameRes.ok) {
        const detail = String(usernameData.detail || 'Username could not be saved');
        setErrors({ username: detail });
        setToast({ show: true, message: detail, type: 'error' });
        setIsSubmitting(false);
        return;
      }

      sessionStorage.removeItem(GOOGLE_NAME_KEY);
      setCurrentUserFromOAuth({
        id: String((nameData as { id?: string }).id || ''),
        email: '',
        name: typedName,
      });
      navigate('/home', { replace: true });
    } catch {
      setToast({ show: true, message: 'Connection failed', type: 'error' });
      setIsSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading your account...</p>
      </div>
    );
  }

  const inputCls = 'w-full rounded-xl bg-secondary pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-8">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast(t => ({ ...t, show: false }))} />
      <div className="w-full max-w-sm rounded-3xl glass-card p-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-gradient">Choose your name</h1>
          <p className="text-sm text-muted-foreground">Pick a username and confirm your full name to continue.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className={inputCls}
                aria-describedby="choose-username-rules"
              />
            </div>
            <p id="choose-username-rules" className="text-[11px] text-muted-foreground px-1">{USERNAME_RULES_HINT}</p>
            {errors.username && <p className="text-xs text-destructive px-1">{errors.username}</p>}
          </div>
          <div className="space-y-1">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className={inputCls}
                aria-describedby="choose-full-name-rules"
              />
            </div>
            <p id="choose-full-name-rules" className="text-[11px] text-muted-foreground px-1">{FULL_NAME_RULES_HINT}</p>
            {errors.fullName && <p className="text-xs text-destructive px-1">{errors.fullName}</p>}
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full gradient-primary rounded-xl py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-70">
            {isSubmitting ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
