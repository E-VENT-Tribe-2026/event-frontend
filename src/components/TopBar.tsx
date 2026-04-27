import { useEffect, useState } from 'react';
import { Search, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCurrentUser } from '@/lib/storage';
import { UserAvatar } from '@/components/UserAvatar';
import { getAuthToken } from '@/lib/auth';
import { fetchNotifications } from '@/lib/notificationsApi';

interface TopBarProps {
  search: string;
  onSearchChange: (v: string) => void;
}

export default function TopBar({ search, onSearchChange }: TopBarProps) {
  const user = getCurrentUser();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    let cancelled = false;
    fetchNotifications(token)
      .then((rows) => {
        if (!cancelled) setHasUnread(rows.some((n) => !n.read));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <h1 className="text-xl font-bold text-gradient shrink-0">E-VENT</h1>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full rounded-full bg-secondary pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
          />
        </div>
        <Link to="/notifications" className="relative shrink-0 p-1">
          <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          {hasUnread && (
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-accent" />
          )}
        </Link>
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
