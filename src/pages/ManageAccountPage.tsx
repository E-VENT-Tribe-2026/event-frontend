import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AtSign,
  Ban,
  Bell,
  Calendar,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import TopBar from '@/components/TopBar';
import BottomNav from '@/components/BottomNav';
import { UserAvatar } from '@/components/UserAvatar';
import AppToast from '@/components/AppToast';
import LocationSearchInput, { type LocationResult } from '@/components/LocationSearchInput';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { getCurrentUser, logout, updateUser } from '@/lib/storage';
import { clearAuthToken, getAuthToken } from '@/lib/auth';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { profileFromMeResponse } from '@/lib/username';
import { fetchBlockedUsers, unblockUser, userAvatarUrl, userProfilePath, type BlockedUserItem } from '@/lib/friendsApi';
import { clearCache } from '@/lib/queryCache';
import { clearAllQueries } from '@/lib/queries';
import { stopSessionTimeout } from '@/lib/sessionTimeout';
import {
  changeAccountPassword,
  deleteAccount,
  homeLocationFromSearch,
  readHomeLocation,
  readNotificationPrefs,
  sendPasswordResetEmail,
  signInMethodFromMe,
  writeHomeLocation,
  writeNotificationPrefs,
  type HomeLocation,
  type NotificationPrefKey,
  type NotificationPrefs,
  type SignInMethod,
} from '@/lib/accountSettings';

function memberSince(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

const PREF_ROWS: Array<{ key: NotificationPrefKey; label: string; hint: string }> = [
  { key: 'friend_requests', label: 'Friend requests', hint: 'When someone wants to connect' },
  { key: 'invitations', label: 'Invitations', hint: 'When a friend invites you to an event' },
  { key: 'event_chat', label: 'Event chat', hint: 'New messages in events you joined' },
  { key: 'reminders', label: 'Reminders', hint: 'Upcoming events you are going to' },
];

export default function ManageAccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser);
  const [details, setDetails] = useState({
    email: user?.email ?? '',
    username: user?.username ?? '',
  });
  const [signInMethod, setSignInMethod] = useState<SignInMethod>('unknown');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const [blocked, setBlocked] = useState<BlockedUserItem[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<NotificationPrefs>(() => readNotificationPrefs(user?.id));
  const [home, setHome] = useState<HomeLocation | null>(() => readHomeLocation(user?.id));
  const [homeQuery, setHomeQuery] = useState(() => readHomeLocation(user?.id)?.name ?? '');

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

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
        if (cancelled) return;
        setSignInMethod(signInMethodFromMe(me));
        if (email || username) {
          setDetails((prev) => ({
            email: email || prev.email,
            username: username || prev.username,
          }));
          updateUser({
            ...(email ? { email } : {}),
            ...(username ? { username } : {}),
          });
        }
      } catch {
        /* keep the last known local values */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBlockedLoading(true);
    fetchBlockedUsers(1, 50)
      .then((page) => {
        if (!cancelled) setBlocked(page.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setBlocked([]);
      })
      .finally(() => {
        if (!cancelled) setBlockedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  if (!user) return null;

  const leaveSession = () => {
    stopSessionTimeout();
    logout();
    clearAuthToken();
    clearCache();
    clearAllQueries();
    navigate('/login', { replace: true });
  };

  const handleChangePassword = async () => {
    const token = getAuthToken();
    if (!token) return;
    if (!currentPassword.trim()) {
      setToast({ show: true, message: 'Enter your current password.', type: 'error' });
      return;
    }
    if (newPassword.length < 8) {
      setToast({ show: true, message: 'New password must be at least 8 characters.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ show: true, message: 'The new passwords do not match.', type: 'error' });
      return;
    }
    setPasswordBusy(true);
    try {
      await changeAccountPassword(token, currentPassword, newPassword, confirmPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setToast({ show: true, message: 'Password updated.', type: 'success' });
    } catch (err) {
      setToast({ show: true, message: err instanceof Error ? err.message : 'Failed to update password.', type: 'error' });
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleSendReset = async () => {
    if (!details.email.trim()) {
      setToast({ show: true, message: 'No email on this account to send a reset to.', type: 'error' });
      return;
    }
    setResetBusy(true);
    try {
      await sendPasswordResetEmail(details.email);
      setToast({ show: true, message: 'Reset link sent. Check your email.', type: 'success' });
    } catch (err) {
      setToast({ show: true, message: err instanceof Error ? err.message : 'Unable to send a reset link.', type: 'error' });
    } finally {
      setResetBusy(false);
    }
  };

  const handleUnblock = async (item: BlockedUserItem) => {
    setUnblockingId(item.user.id);
    try {
      await unblockUser(item.user.id);
      setBlocked((prev) => prev.filter((row) => row.user.id !== item.user.id));
      setToast({ show: true, message: `@${item.user.username || item.user.display_name} unblocked.`, type: 'success' });
    } catch (err) {
      setToast({ show: true, message: err instanceof Error ? err.message : 'Could not unblock.', type: 'error' });
    } finally {
      setUnblockingId(null);
    }
  };

  const togglePref = (key: NotificationPrefKey, on: boolean) => {
    const next = { ...prefs, [key]: on };
    setPrefs(next);
    writeNotificationPrefs(user.id, next);
  };

  const handleHomeSelect = (result: LocationResult) => {
    const next = homeLocationFromSearch(result.displayName, result.lat, result.lng);
    setHome(next);
    setHomeQuery(result.displayName);
    writeHomeLocation(user.id, next);
    setToast({ show: true, message: `Home city set to ${next.city}.`, type: 'success' });
  };

  const handleClearHome = () => {
    setHome(null);
    setHomeQuery('');
    writeHomeLocation(user.id, null);
  };

  const handleDelete = async () => {
    const token = getAuthToken();
    if (!token) return;
    setDeleteBusy(true);
    try {
      await deleteAccount(token);
      leaveSession();
    } catch (err) {
      setDeleteBusy(false);
      setToast({ show: true, message: err instanceof Error ? err.message : 'Could not delete this account.', type: 'error' });
    }
  };

  const deletePhrase = details.username || details.email || 'DELETE';
  const canDelete = deleteTyped.trim().toLowerCase() === deletePhrase.trim().toLowerCase();
  const inputCls = 'w-full rounded-xl bg-secondary px-4 py-3 pr-10 text-sm text-foreground outline-none border border-border/50';

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
          <p className="text-xs text-muted-foreground mt-0.5">Sign-in, privacy and how E-VENT finds events for you</p>
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
            <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
            {details.username ? (
              <p className="text-xs text-muted-foreground mt-0.5">@{details.username}</p>
            ) : null}
          </div>
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
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-secondary text-muted-foreground shrink-0">
                <KeyRound className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sign-in</p>
                <p data-testid="account-signin-method" className="text-sm text-foreground">
                  {signInMethod === 'google' ? 'Google' : signInMethod === 'email' ? 'Email and password' : 'Email'}
                </p>
              </div>
            </div>
          </div>
          <Link to="/profile" className="inline-flex text-xs font-semibold text-primary hover:underline">
            Edit public profile
          </Link>
        </section>

        <section className="rounded-2xl glass-card p-4" data-testid="account-signin">
          <Collapsible open={passwordOpen} onOpenChange={setPasswordOpen}>
            <CollapsibleTrigger
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Change password</h2>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${passwordOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              {signInMethod === 'google' ? (
                <p className="text-xs text-muted-foreground">
                  This account uses Google. You can still set a password with a reset email if you also have an email sign-in.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Change your password here, or send a reset link to {details.email || 'your email'}.</p>
              )}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    aria-label="Current password"
                    className={inputCls}
                  />
                  <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Toggle current password">
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 characters)"
                    aria-label="New password"
                    className={inputCls}
                  />
                  <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Toggle new password">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  aria-label="Confirm new password"
                  className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none border border-border/50"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void handleChangePassword()}
                  disabled={passwordBusy}
                  className="flex-1 rounded-xl gradient-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
                >
                  {passwordBusy ? 'Updating…' : 'Update password'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendReset()}
                  disabled={resetBusy}
                  className="flex-1 rounded-xl border border-border bg-secondary py-2.5 text-xs font-semibold text-foreground disabled:opacity-60"
                >
                  {resetBusy ? 'Sending…' : 'Send reset email'}
                </button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>

        <section className="rounded-2xl glass-card p-4 space-y-3" data-testid="account-blocked">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Blocked people</h2>
          </div>
          {blockedLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : blocked.length === 0 ? (
            <p className="text-xs text-muted-foreground">You have not blocked anyone.</p>
          ) : (
            <ul className="space-y-2">
              {blocked.map((row) => (
                <li key={row.user.id} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2">
                  <button type="button" onClick={() => navigate(userProfilePath(row.user.id, user.id))} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <UserAvatar src={userAvatarUrl(row.user)} seed={row.user.id} name={row.user.full_name || row.user.username} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-foreground">{row.user.full_name || row.user.display_name}</span>
                      {row.user.username ? <span className="text-[11px] text-muted-foreground">@{row.user.username}</span> : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUnblock(row)}
                    disabled={unblockingId === row.user.id}
                    aria-label={`Unblock ${row.user.display_name || row.user.username || 'user'}`}
                    className="shrink-0 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold disabled:opacity-60"
                  >
                    {unblockingId === row.user.id ? '…' : 'Unblock'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl glass-card p-4 space-y-3" data-testid="account-notifications">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Notifications</h2>
          </div>
          <p className="text-xs text-muted-foreground">Choose what appears in your bell. Warnings from administrators always show.</p>
          <ul className="space-y-3">
            {PREF_ROWS.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{row.label}</p>
                  <p className="text-[11px] text-muted-foreground">{row.hint}</p>
                </div>
                <Switch
                  checked={prefs[row.key]}
                  onCheckedChange={(on) => togglePref(row.key, on)}
                  aria-label={row.label}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl glass-card p-4 space-y-3" data-testid="account-home-city">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Home city</h2>
          </div>
          <p className="text-xs text-muted-foreground">Home and Map open around this place instead of a worldwide view.</p>
          <LocationSearchInput
            value={homeQuery}
            onChange={setHomeQuery}
            onSelect={handleHomeSelect}
            placeholder="Search a city or neighbourhood…"
            locateOnMount={false}
          />
          {home ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2">
              <p className="text-xs text-foreground truncate">{home.city}</p>
              <button type="button" onClick={handleClearHome} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                Clear
              </button>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl glass-card p-4 space-y-3 border border-destructive/20" data-testid="account-danger">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-bold text-foreground">Danger zone</h2>
          </div>
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-secondary/60 px-3 py-2.5 text-sm font-medium text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Log out of this device
          </button>
          <button
            type="button"
            onClick={() => { setDeleteTyped(''); setDeleteOpen(true); }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete account
          </button>
        </section>
      </motion.main>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>You will need to sign in again on this device.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Stay signed in</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={leaveSession}>Log out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Type <span className="font-semibold text-foreground">{deletePhrase}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            value={deleteTyped}
            onChange={(e) => setDeleteTyped(e.target.value)}
            aria-label="Type to confirm account deletion"
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Keep account</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canDelete || deleteBusy}
              className="rounded-xl bg-destructive text-destructive-foreground"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleteBusy ? 'Deleting…' : 'Delete forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
