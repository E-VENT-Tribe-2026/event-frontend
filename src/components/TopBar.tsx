import { Search, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCurrentUser, updateUser } from '@/lib/storage';
import { UserAvatar } from '@/components/UserAvatar';
import { getAuthToken } from '@/lib/auth';
import { fetchNotifications } from '@/lib/notificationsApi';
import { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import AppLogo from '@/components/AppLogo';

interface TopBarProps {
  search: string;
  onSearchChange: (v: string) => void;
}

export default function TopBar({ search, onSearchChange }: TopBarProps) {
  const [user, setUser] = useState(getCurrentUser);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const sync = () => setUser(getCurrentUser());
    window.addEventListener('eventapp:user-updated', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('eventapp:user-updated', sync);
      window.removeEventListener('focus', sync);
    };
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const check = () => {
      fetchNotifications(token)
        .then((rows) => setHasUnread(rows.some((n) => !n.read)))
        .catch(() => {});
    };

    check();
    return () => {};
  }, [user?.id]);

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
            placeholder="Search events..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full rounded-full border border-border/50 bg-secondary pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-all"
          />
        </div>

        {/* Notifications */}
        <Link to="/notifications" className="relative shrink-0 rounded-full p-2 hover:bg-secondary/80 transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          {hasUnread && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent shadow-accent animate-pulse" />
          )}
        </Link>

        {/* Avatar */}
        {user && (
          <Link to="/profile" className="shrink-0 rounded-full ring-2 ring-transparent hover:ring-primary/40 transition-all">
            <UserAvatar
              src={user.profilePhoto}
              srcSecondary={user.avatar}
              seed={user.id}
              name={user.name}
              email={user.email}
              size="sm"
            />
          </Link>
        )}
      </div>
    </header>
  );
}
