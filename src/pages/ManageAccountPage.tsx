import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Crown, Mail, AtSign, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import PlanBadge from '@/components/PlanBadge';
import { UserAvatar } from '@/components/UserAvatar';
import AppToast from '@/components/AppToast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getCurrentUser, updateUser } from '@/lib/storage';
import { getAuthToken } from '@/lib/auth';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { profileFromMeResponse } from '@/lib/username';
import { accountPlanFrom, BASIC_PERKS, PRO_PERKS, PRO_PRICE_LABEL } from '@/lib/accountPlan';

function memberSince(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function ManageAccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as const });
  const [details, setDetails] = useState({
    email: user?.email ?? '',
    username: user?.username ?? '',
  });

  useEffect(() => {
    const sync = () => {
      const next = getCurrentUser();
      setUser(next);
      if (next?.email || next?.username) {
        setDetails((prev) => ({
          email: next.email || prev.email,
          username: next.username || prev.username,
        }));
      }
    };
    window.addEventListener('eventapp:user-updated', sync);
    return () => window.removeEventListener('eventapp:user-updated', sync);
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
        const [profileRes, meRes] = await Promise.all([
          fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), { headers }),
          fetch(getApiUrl('/api/auth/me'), { headers }),
        ]);
        const profile = profileRes.ok ? profileFromMeResponse(await profileRes.json()) : {};
        const me = meRes.ok ? ((await meRes.json()) as Record<string, unknown>) : {};
        const email = String(me.email || profile.email || '').trim();
        const username = String(profile.username || '').trim();
        if (cancelled || (!email && !username)) return;
        setDetails((prev) => ({
          email: email || prev.email,
          username: username || prev.username,
        }));
        updateUser({
          ...(email ? { email } : {}),
          ...(username ? { username } : {}),
        });
      } catch {
        /* keep the last known local values */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  if (!user) return null;

  const plan = accountPlanFrom(user);
  const isPro = plan === 'pro';

  const handleCancelSubscription = () => {
    updateUser({ isPremium: false });
    window.dispatchEvent(new CustomEvent('eventapp:user-updated'));
    setUser(getCurrentUser());
    setConfirmCancel(false);
    setToast({ show: true, message: 'Subscription cancelled. You are back on Basic.', type: 'success' });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppToast
        message={toast.message}
        type={toast.type}
        show={toast.show}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />
      <TopBar showSearch={false} />

      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-lg space-y-5 px-4 py-5"
      >
        <div>
          <h1 className="text-lg font-bold text-foreground">Manage account</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Plan, email and how you appear on E-VENT</p>
        </div>

        <section className="rounded-2xl glass-card p-4 flex items-center gap-3">
          <UserAvatar
            src={user.profilePhoto}
            srcSecondary={user.avatar}
            seed={user.id}
            name={user.name}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
              <PlanBadge plan={plan} />
            </div>
            {details.username ? (
              <p className="text-xs text-muted-foreground mt-0.5">@{details.username}</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl glass-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-foreground">Your plan</h2>
            <PlanBadge plan={plan} />
          </div>
          <p className="text-xs text-muted-foreground">
            {isPro
              ? 'Pro unlocks custom banners, recurring events and unlimited AI.'
              : 'You are on Basic — 5 AI asks a day, friend activity, and everything you need to find events.'}
          </p>
          <ul className="space-y-1.5">
            {(isPro ? [...BASIC_PERKS, ...PRO_PERKS] : BASIC_PERKS).map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-xs text-foreground">
                <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                {perk}
              </li>
            ))}
          </ul>
          {isPro ? (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-muted-foreground">Thanks for being on Pro.</p>
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="w-full rounded-xl border border-border/70 bg-secondary/60 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                Cancel subscription
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-primary" />
                Pro
              </p>
              <ul className="space-y-1">
                {PRO_PERKS.map((perk) => (
                  <li key={perk} className="text-[11px] text-muted-foreground">· {perk}</li>
                ))}
              </ul>
              <Link
                to="/premium"
                className="flex w-full items-center justify-center rounded-xl gradient-primary py-2.5 text-xs font-bold text-primary-foreground shadow-glow"
              >
                Upgrade to Pro · {PRO_PRICE_LABEL}
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-2xl glass-card p-4 space-y-3">
          <h2 className="text-sm font-bold text-foreground">Account details</h2>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground shrink-0">
                <Mail className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</p>
                <p data-testid="account-email" className="text-sm text-foreground truncate">{details.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground shrink-0">
                <AtSign className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Username</p>
                <p data-testid="account-username" className="text-sm text-foreground truncate">{details.username ? `@${details.username}` : '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground shrink-0">
                <Calendar className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Member since</p>
                <p className="text-sm text-foreground">{memberSince(user.createdAt)}</p>
              </div>
            </div>
          </div>
          <Link
            to="/profile"
            className="inline-flex text-xs font-semibold text-primary hover:underline"
          >
            Edit public profile
          </Link>
        </section>
      </motion.main>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent className="rounded-3xl glass-card border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              You will go back to Basic right away. Custom banners, recurring events and unlimited AI will be locked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Keep Pro</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              className="rounded-2xl bg-destructive text-destructive-foreground"
            >
              Switch to Basic
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
