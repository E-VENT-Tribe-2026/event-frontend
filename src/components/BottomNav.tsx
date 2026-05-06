import { Link, useLocation } from 'react-router-dom';
import { Home, Map, PlusCircle, MessageCircle, User, LayoutDashboard } from 'lucide-react';
import { getCurrentUser, setCurrentUserFromOAuth } from '@/lib/storage';
import { UserAvatar } from '@/components/UserAvatar';
import { getAuthToken } from '@/lib/auth';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { useEffect, useState } from 'react';

export default function BottomNav() {
  const location = useLocation();
  const [user, setUser] = useState(getCurrentUser);

  useEffect(() => {
    const sync = () => setUser(getCurrentUser());
    window.addEventListener('eventapp:user-updated', sync);
    return () => window.removeEventListener('eventapp:user-updated', sync);
  }, []);

  // Fetch profile on mount to load avatar
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    fetch(getApiUrl(API_ENDPOINTS.PROFILE_ME), {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data: Record<string, unknown>) => {
        const p = (data.data || data.user || data) as Record<string, unknown>;
        if (!p.id) return;
        // Use setCurrentUserFromOAuth so it works even if user isn't in memory yet
        setCurrentUserFromOAuth({
          id: String(p.id),
          email: String(p.email || ''),
          name: String(p.full_name || p.name || ''),
          avatar: String(p.avatar_url || ''),
          bio: String(p.bio || ''),
          interests: Array.isArray(p.interests) ? p.interests as string[] : [],
        });
        setUser(getCurrentUser());
        window.dispatchEvent(new CustomEvent('eventapp:user-updated'));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount

  const isOrganizer = user?.role === 'organizer';

  const navItems = isOrganizer
    ? [
        { path: '/home', icon: Home, label: 'Home' },
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/create', icon: PlusCircle, label: 'Create' },
        { path: '/chat', icon: MessageCircle, label: 'Chat' },
        { path: '/profile', icon: User, label: 'Profile' },
      ]
    : [
        { path: '/home', icon: Home, label: 'Home' },
        { path: '/map', icon: Map, label: 'Map' },
        { path: '/create', icon: PlusCircle, label: 'Create' },
        { path: '/chat', icon: MessageCircle, label: 'Chat' },
        { path: '/profile', icon: User, label: 'Profile' },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-around px-4 py-2">
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          const isCreate = path === '/create';
          const baseText =
            active && !isCreate ? 'text-primary' : 'text-muted-foreground hover:text-foreground';

          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors ${baseText}`}
            >
              {isCreate ? (
                <div className="flex items-center justify-center rounded-full gradient-primary h-14 w-14 shadow-glow -mt-6 border-4 border-background">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
              ) : path === '/profile' && user ? (
                <UserAvatar
                  src={user.profilePhoto}
                  srcSecondary={user.avatar}
                  seed={user.id}
                  name={user.name}
                  email={user.email}
                  size="sm"
                  className={active ? 'ring-2 ring-primary' : ''}
                />
              ) : (
                <Icon className="h-5 w-5" />
              )}
              <span
                className={`text-[10px] font-medium ${
                  isCreate && active ? 'text-primary' : ''
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
