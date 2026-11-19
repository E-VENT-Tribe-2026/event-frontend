import { Link, useLocation } from 'react-router-dom';
import { User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/storage';
import { UserAvatar } from '@/components/UserAvatar';

/** Profile avatar for sticky headers. Replaces the bottom-nav Profile tab. */
export default function TopNavProfile() {
  const location = useLocation();
  const [user, setUser] = useState(getCurrentUser);
  const active = location.pathname === '/profile';

  useEffect(() => {
    const sync = () => setUser(getCurrentUser());
    window.addEventListener('eventapp:user-updated', sync);
    return () => window.removeEventListener('eventapp:user-updated', sync);
  }, []);

  return (
    <Link
      to="/profile"
      aria-label="Profile"
      title="Profile"
      className="shrink-0 rounded-full"
    >
      {user ? (
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
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
          <User className="h-4 w-4 text-muted-foreground" />
        </span>
      )}
    </Link>
  );
}
