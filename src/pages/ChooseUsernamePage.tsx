import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AtSign, User } from 'lucide-react';
import { motion } from 'framer-motion';
import AppToast from '@/components/AppToast';
import { getAuthToken } from '@/lib/auth';
import { getApiUrl } from '@/lib/api';
import {
  FULL_NAME_RULES_HINT,
  USERNAME_RULES_HINT,
  getFullNameValidationError,
  getUsernameValidationError,
  hasChosenUsername,
  normalizeFullName,
  normalizeUsername,
} from '@/lib/username';

const GOOGLE_NAME_KEY = 'eventapp:google-name';

/** Prefill only. The name is not saved until the user confirms it on this step. */
export function rememberGoogleName(name: string | null | undefined) {
  const trimmed = (name || '').trim();
  if (trimmed) sessionStorage.setItem(GOOGLE_NAME_KEY, trimmed);
  else sessionStorage.removeItem(GOOGLE_NAME_KEY);
}

export function readRememberedGoogleName(): string {
  return (sessionStorage.getItem(GOOGLE_NAME_KEY) || '').trim();
}

export default function ChooseUsernamePage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' as const });

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl('/api/profile/me'), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        const profile = await res.json().catch(() => ({} as { username?: string; full_name?: string }));
        if (cancelled) return;
        if (res.ok && hasChosenUsername(profile.username)) {
          navigate('/home', { replace: true });
          return;
        }
        const existing = typeof profile.full_name === 'string' ? profile.full_name.trim() : '';
        setFullName(existing || readRememberedGoogleName());
      } catch {
        if (!cancelled) setFullName(readRememberedGoogleName());
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const nextErrors: Record<string, string> = {};
    const usernameProblem = getUsernameValidationError(username);
    const nameProblem = getFullNameValidationError(fullName);
    if (usernameProblem) nextErrors.username = usernameProblem;
    if (nameProblem) nextErrors.fullName = nameProblem;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const token = getAuthToken();
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    setSaving(true);
    try {
      const nameRes = await fetch(getApiUrl('/api/profile/me'), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ full_name: normalizeFullName(fullName) }),
      });
      const nameData = await nameRes.json().catch(() => ({} as { detail?: string }));
      if (!nameRes.ok) {
        const detail = String(nameData.detail || 'Full name could not be saved');
        setErrors({ fullName: detail });
        setToast({ show: true, message: detail, type: 'error' });
        return;
      }

      const usernameRes = await fetch(getApiUrl('/api/profile/username'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ username: normalizeUsername(username) }),
      });
      const usernameData = await usernameRes.json().catch(() => ({} as { detail?: string }));
      if (!usernameRes.ok) {
        const detail = String(usernameData.detail || 'Username could not be saved');
        setErrors({ username: detail });
        setToast({ show: true, message: detail, type: 'error' });
        return;
      }

      sessionStorage.removeItem(GOOGLE_NAME_KEY);
      navigate('/home', { replace: true });
    } catch {
      setToast({ show: true, message: 'Could not save. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const inputCls =
    'w-full rounded-xl bg-secondary pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-8">
      <AppToast message={toast.message} type={toast.type} show={toast.show} onClose={() => setToast((t) => ({ ...t, show: false }))} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="rounded-3xl glass-card p-8 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Choose your name</h1>
            <p className="text-sm text-muted-foreground">Pick a username and confirm your full name to continue.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  autoComplete="username"
                  aria-label="Username"
                  aria-describedby="choose-username-rules"
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errors.username) setErrors((prev) => ({ ...prev, username: '' }));
                  }}
                  className={inputCls}
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
                  placeholder="Full name"
                  value={fullName}
                  autoComplete="name"
                  aria-label="Full name"
                  aria-describedby="choose-full-name-rules"
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                  }}
                  className={inputCls}
                />
              </div>
              <p id="choose-full-name-rules" className="text-[11px] text-muted-foreground px-1">{FULL_NAME_RULES_HINT}</p>
              {errors.fullName && <p className="text-xs text-destructive px-1">{errors.fullName}</p>}
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl gradient-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
