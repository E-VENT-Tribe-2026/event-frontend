import { Search, Bell, Settings, LogOut, User, ShieldCheck } from 'lucide-react';
import ColorSchemePicker from '@/components/ColorSchemePicker';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, updateUser, logout } from '@/lib/storage';
import { UserAvatar } from '@/components/UserAvatar';
import { getAuthToken, clearAuthToken } from '@/lib/auth';
import { fetchNotifications, NOTIFICATIONS_CHANGED_EVENT } from '@/lib/notificationsApi';
import { fetchIncomingRequestCount, FRIENDS_CHANGED_EVENT } from '@/lib/friendsApi';
import { useEffect, useState, useRef } from 'react';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import AppLogo from '@/components/AppLogo';
import TopNavProfile from '@/components/TopNavProfile';
import { motion, AnimatePresence } from 'framer-motion';

interface TopBarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
}

export default function TopBar({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search events...',
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

  // Fetch profile on mount to ensure avatar is up to date after refresh
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data: Record<string, unknown>) => {
        const profile = (data.data || data.user || data) as Record<string, unknown>;
        if (!profile.id) return;
        updateUser({
          name: String(profile.full_name || profile.name || ''),
          avatar: String(profile.avatar_url || ''),
          profilePhoto: String(profile.avatar_url || ''),
          bio: String(profile.bio || ''),
          interests: Array.isArray(profile.interests) ? profile.interests as string[] : [],
        });
        setUser(getCurrentUser());
        window.dispatchEvent(new CustomEvent('eventapp:user-updated'));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    // Badge count is unread notifications; pending friend requests still light the
    // bell when the notification list itself is empty.
    let cancelled = false;
    const check = () => {
      Promise.all([
        fetchNotifications(token).then((rows) => rows.filter((n) => !n.read).length).catch(() => 0),
        fetchIncomingRequestCount().catch(() => 0),
      ]).then(([unread, pending]) => {
        if (!cancelled) setUnreadCount(unread || pending);
      });
    };

    check();
    window.addEventListener(FRIENDS_CHANGED_EVENT, check);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, check);
    window.addEventListener('focus', check);
    return () => {
      cancelled = true;
      window.removeEventListener(FRIENDS_CHANGED_EVENT, check);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, check);
      window.removeEventListener('focus', check);
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

        {/* Search */}
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
            className="shrink-0 rounded-full p-2 hover:bg-secondary/80 transition-colors"
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          </button>

          <AnimatePresence>
            {showSettingsMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-56 rounded-2xl glass-card bg-background border border-border p-1.5 shadow-xl z-50 space-y-1"
              >
                <div className="px-3 py-2 border-b border-border/40 mb-1">
                  <p className="text-xs font-bold text-foreground truncate">{user?.name || 'My Account'}</p>
                  <p className="text-[10px] text-muted-foreground truncate">Manage preferences</p>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setShowSettingsMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                >
                  <User className="h-4 w-4 text-primary" />
                  Profile
                </Link>

                <button
                  type="button"
                  onClick={() => { setShowSettingsMenu(false); navigate('/profile'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-secondary transition-colors text-left"
                >
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  Manage Account
                </button>

                <div className="my-1 border-t border-border/40" />

                <ColorSchemePicker compact />

                <div className="my-1 border-t border-border/40" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors text-left"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}