import { Search, Bell, Settings, LogOut, User, ShieldCheck } from 'lucide-react';
import ColorSchemePicker from '@/components/ColorSchemePicker';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, logout } from '@/lib/storage';
import { UserAvatar } from '@/components/UserAvatar';
import { AUTH_TOKEN_EVENT, getAuthToken, clearAuthToken } from '@/lib/auth';
import { countBellUnreads, fetchNotifications, NOTIFICATIONS_CHANGED_EVENT } from '@/lib/notificationsApi';
import { fetchIncomingRequestCount, FRIENDS_CHANGED_EVENT } from '@/lib/friendsApi';
import { applyMyProfileToSession, fetchMyProfile } from '@/lib/profileMe';
import { invalidatePrefix } from '@/lib/queryCache';
import { useEffect, useState, useRef } from 'react';
import AppLogo from '@/components/AppLogo';
import TopNavProfile from '@/components/TopNavProfile';
import PlanBadge from '@/components/PlanBadge';
import { motion, AnimatePresence } from 'framer-motion';

interface TopBarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
}

export default function TopBar({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search events...',
  showSearch = true,
}: TopBarProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setUser(getCurrentUser());
    window.addEventListener('eventapp:user-updated', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('eventapp:user-updated', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Shared cached profile — TopBar remounts on every page, so do not hit the network each time.
  useEffect(() => {
    if (!getAuthToken()) return;
    void fetchMyProfile()
      .then((body) => {
        applyMyProfileToSession(body);
        setUser(getCurrentUser());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = (bust = false) => {
      const token = getAuthToken();
      if (!token) {
        if (!cancelled) setUnreadCount(0);
        return;
      }
      if (bust) {
        invalidatePrefix('/api/notifications');
        invalidatePrefix('/api/friends/requests');
      }
      Promise.all([
        fetchNotifications(token).catch(() => [] as Awaited<ReturnType<typeof fetchNotifications>>),
        fetchIncomingRequestCount().catch(() => 0),
      ]).then(([rows, pending]) => {
        if (!cancelled) setUnreadCount(countBellUnreads(rows, pending));
      });
    };

    check(false);
    const onLive = () => check(true);
    const onFocus = () => check(false);
    window.addEventListener(FRIENDS_CHANGED_EVENT, onLive);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onLive);
    window.addEventListener(AUTH_TOKEN_EVENT, onLive);
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener(FRIENDS_CHANGED_EVENT, onLive);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onLive);
      window.removeEventListener(AUTH_TOKEN_EVENT, onLive);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.id]);

  const handleLogout = () => {
    logout();
    clearAuthToken();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        {/* Logo */}
        <AppLogo size="sm" linkTo="/home" className="shrink-0 hover:opacity-90 transition-opacity" />

        {showSearch ? (
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              value={search}
              onChange={e => onSearchChange?.(e.target.value)}
              className="w-full rounded-full border border-border/50 bg-secondary pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-all"
            />
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Notifications */}
        <Link
          to="/notifications"
          className="relative shrink-0 rounded-full p-2 hover:bg-secondary/80 transition-colors"
          title="Notifications"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground shadow-accent animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        <TopNavProfile />

        {/* Settings Menu Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            aria-label="Settings"
            aria-expanded={showSettingsMenu}
            aria-haspopup="menu"
            title="Settings"
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 ${
              showSettingsMenu
                ? 'gradient-primary text-primary-foreground shadow-glow'
                : 'glass-card text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <motion.span
              className="flex"
              animate={{ rotate: showSettingsMenu ? 90 : 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            >
              <Settings className="h-4 w-4" strokeWidth={2.4} />
            </motion.span>
          </button>

          <AnimatePresence>
            {showSettingsMenu && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                className="absolute right-0 z-50 mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border border-border/70 bg-background/95 p-0 shadow-xl backdrop-blur-xl"
              >
                <div className="flex items-center gap-3 border-b border-border/50 px-3.5 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-glow shrink-0">
                    <Settings className="h-4 w-4 text-primary-foreground" strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground leading-tight">Settings</p>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-[11px] text-muted-foreground truncate">
                        {user?.name || 'Preferences'}
                      </p>
                      {user ? <PlanBadge plan={user} /> : null}
                    </div>
                  </div>
                </div>

                <div className="p-2 space-y-0.5">
                  <Link
                    role="menuitem"
                    to="/profile"
                    onClick={() => setShowSettingsMenu(false)}
                    className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary shrink-0">
                      <User className="h-4 w-4" />
                    </span>
                    Profile
                  </Link>

                  <Link
                    role="menuitem"
                    to="/account"
                    onClick={() => setShowSettingsMenu(false)}
                    className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent shrink-0">
                      <ShieldCheck className="h-4 w-4" />
                    </span>
                    Manage account
                  </Link>
                </div>

                <div className="border-t border-border/50 px-3 py-3">
                  <ColorSchemePicker compact />
                </div>

                <div className="border-t border-border/50 p-2">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors text-left"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 shrink-0">
                      <LogOut className="h-4 w-4" />
                    </span>
                    Log out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}