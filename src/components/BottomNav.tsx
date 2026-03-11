import { Link, useLocation } from 'react-router-dom';
import { Home, Map, PlusCircle, MessageCircle, User, LayoutDashboard } from 'lucide-react';
import { getCurrentUser } from '@/lib/storage';

export default function BottomNav() {
  const location = useLocation();
  const user = getCurrentUser();
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
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <Link key={path} to={path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              {path === '/create' ? (
                <div className="gradient-primary rounded-full p-2 -mt-4 shadow-glow">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
              ) : (
                <Icon className="h-5 w-5" />
              )}
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
