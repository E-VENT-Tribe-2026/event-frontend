import { Link, useLocation } from 'react-router-dom';
import { Home, Map, PlusCircle, MessageCircle, LayoutDashboard, Users, Shield } from 'lucide-react';
import { getCurrentUser, setCurrentUserFromOAuth } from '@/lib/storage';
import { getAuthToken } from '@/lib/auth';
import { getApiUrl } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/apiUrls';
import { useEffect, useState } from 'react';
import {
  CHAT_UNREAD_CHANGED_EVENT,
  countUnreadChats,
} from '@/lib/chatUnread';
import { fetchIncomingRequestCount, FRIENDS_CHANGED_EVENT } from '@/lib/friendsApi';
import { CHAT_MESSAGES_CHANGED_EVENT } from '@/lib/realtimeEvents';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function BottomNav() {
  const location = useLocation();
  const [user, setUser] = useState(getCurrentUser);
  const { isVerifiedAdmin } = useAdminAuth();

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
          email: String(p.email || getCurrentUser()?.email || ''),
          name: String(p.full_name || p.name || ''),
          username: typeof p.username === 'string' ? p.username : getCurrentUser()?.username,
          avatar: String(p.avatar_url || ''),
          bio: String(p.bio || ''),
          interests: Array.isArray(p.interests) ? p.interests as string[] : [],
        });
        setUser(getCurrentUser());
        window.dispatchEvent(new CustomEvent('eventapp:user-updated'));
      })
      .catch(() => {});
  }, []); // once on mount

  // Pending incoming friend requests, refreshed on every screen load and after friendship changes.
  const [requestCount, setRequestCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!getAuthToken()) return;
      fetchIncomingRequestCount()
        .then((count) => { if (!cancelled) setRequestCount(count); })
        .catch(() => {});
    };
    refresh();
    window.addEventListener(FRIENDS_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(FRIENDS_CHANGED_EVENT, refresh);
    };
  }, [location.pathname]);

  const [unreadChats, setUnreadChats] = useState(() => countUnreadChats(getCurrentUser()?.id));
  useEffect(() => {
    const refresh = () => setUnreadChats(countUnreadChats(getCurrentUser()?.id));
    refresh();
    window.addEventListener(CHAT_UNREAD_CHANGED_EVENT, refresh);
    window.addEventListener(CHAT_MESSAGES_CHANGED_EVENT, refresh);
    window.addEventListener('eventapp:user-updated', refresh);
    return () => {
      window.removeEventListener(CHAT_UNREAD_CHANGED_EVENT, refresh);
      window.removeEventListener(CHAT_MESSAGES_CHANGED_EVENT, refresh);
      window.removeEventListener('eventapp:user-updated', refresh);
    };
  }, [location.pathname]);

  const isOrganizer = user?.role === 'organizer';

  const baseItems = isOrganizer
    ? [
        { path: '/home', icon: Home, label: 'Home' },
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/create', icon: PlusCircle, label: 'Create' },
        { path: '/chat', icon: MessageCircle, label: 'Chat' },
        { path: '/friends', icon: Users, label: 'Friends' },
      ]
    : [
        { path: '/home', icon: Home, label: 'Home' },
        { path: '/map', icon: Map, label: 'Map' },
        { path: '/create', icon: PlusCircle, label: 'Create' },
        { path: '/chat', icon: MessageCircle, label: 'Chat' },
        { path: '/friends', icon: Users, label: 'Friends' },
      ];

  const adminItem = isVerifiedAdmin
    ? [{ path: '/admin', icon: Shield, label: 'Admin' }]
    : [];

  const navItems = [...baseItems, ...adminItem];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-around px-2 py-2">
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path || (path === '/admin' && location.pathname.startsWith('/admin'));
          const isCreate = path === '/create';
          const baseText =
            active && !isCreate ? 'text-primary' : 'text-muted-foreground hover:text-foreground';

          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-1 px-2 py-1 transition-colors ${baseText}`}
              aria-label={
                path === '/friends' && requestCount > 0
                  ? `Friends, ${requestCount} pending requests`
                  : path === '/chat' && unreadChats > 0
                    ? `Chat, ${unreadChats} new chats`
                    : undefined
              }
            >
              {isCreate ? (
                <div className="flex items-center justify-center rounded-full gradient-primary h-14 w-14 shadow-glow -mt-6 border-4 border-background">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
              ) : path === '/friends' ? (
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {requestCount > 0 && (
                    <span
                      data-testid="friends-badge"
                      className="absolute -right-2.5 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground shadow-accent animate-pulse"
                    >
                      {requestCount > 99 ? '99+' : requestCount}
                    </span>
                  )}
                </span>
              ) : path === '/chat' ? (
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {unreadChats > 0 && (
                    <span
                      data-testid="chat-badge"
                      className="absolute -right-2.5 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground shadow-accent animate-pulse"
                    >
                      {unreadChats > 99 ? '99+' : unreadChats}
                    </span>
                  )}
                </span>
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
